"""
OpenAI Export API — OpenAI 兼容的 Chat Completions 接口

提供三个维度的聊天接口：
- POST /action-tasks/v1/chat/completions  (行动任务维度)
- POST /agents/v1/chat/completions        (智能体维度)
- POST /roles/v1/chat/completions         (角色维度)

以及 API Key 管理：
- POST   /api-keys
- GET    /api-keys
- DELETE /api-keys/{key_id}
"""
import hashlib
import json
import logging
import queue
import secrets
import threading
import time
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse

from core.dependencies import get_current_user, get_user_from_api_key
from app.models import (
    db, Role, Agent, ActionTask, ActionTaskAgent,
    Conversation, ConversationAgent, Message, APIKey
)
from app.services.conversation_service import ConversationService

logger = logging.getLogger(__name__)

router = APIRouter()


# ═══════════════════════════════════════════════════════
# 工具函数
# ═══════════════════════════════════════════════════════

def hash_api_key(key: str) -> str:
    """计算 API Key 的 SHA-256 哈希"""
    return hashlib.sha256(key.encode('utf-8')).hexdigest()


def _generate_api_key() -> str:
    return f"sk-abm-{secrets.token_hex(24)}"


def _openai_error(message, code, param=None, status=400):
    """返回 (error_dict, status_code) 元组"""
    return {
        "error": {
            "message": message,
            "type": "invalid_request_error",
            "param": param,
            "code": code
        }
    }, status


def _format_completion(content, model_id, extra=None):
    """格式化为 OpenAI 非流式响应"""
    result = {
        "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model_id,
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": content},
            "finish_reason": "stop"
        }],
        "usage": {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0
        }
    }
    if extra:
        result["extra"] = extra
    return result


# ═══════════════════════════════════════════════════════
# 会话获取/创建辅助函数
# ═══════════════════════════════════════════════════════

def _get_or_create_conversation_for_role(role_id, user_id, session_id=None, conversation_id=None):
    """为角色维度获取或创建会话，返回 (conversation, action_task, agent, error_response)"""
    role = Role.query.get(role_id)
    if not role:
        return None, None, None, _openai_error(f"Role '{role_id}' not found", "model_not_found", "model", 404)

    if conversation_id:
        conv = Conversation.query.get(conversation_id)
        if conv:
            task = ActionTask.query.get(conv.action_task_id)
            conv_agents = ConversationAgent.query.filter_by(conversation_id=conv.id).all()
            if conv_agents:
                agent = Agent.query.get(conv_agents[0].agent_id)
                return conv, task, agent, None

    if session_id:
        existing = Conversation.query.filter_by(
            title=f"openai-export-session:{session_id}"
        ).first()
        if existing:
            task = ActionTask.query.get(existing.action_task_id)
            conv_agents = ConversationAgent.query.filter_by(conversation_id=existing.id).all()
            if conv_agents:
                agent = Agent.query.get(conv_agents[0].agent_id)
                return existing, task, agent, None

    task = ActionTask(
        title=f"OpenAI Export - {role.name}",
        description="Auto-created for OpenAI export API",
        user_id=user_id,
        status='active',
        mode='sequential'
    )
    db.session.add(task)
    db.session.flush()

    agent = Agent(
        name=role.name,
        description=role.description or '',
        role_id=role.id,
        status='active'
    )
    db.session.add(agent)
    db.session.flush()

    task_agent = ActionTaskAgent(
        action_task_id=task.id,
        agent_id=agent.id,
        is_default=True
    )
    db.session.add(task_agent)

    conv_title = f"openai-export-session:{session_id}" if session_id else f"OpenAI Export - {role.name}"
    conv = Conversation(
        title=conv_title,
        description='',
        action_task_id=task.id,
        mode='sequential',
        status='active'
    )
    db.session.add(conv)
    db.session.flush()

    conv_agent = ConversationAgent(
        conversation_id=conv.id,
        agent_id=agent.id,
        is_default=True
    )
    db.session.add(conv_agent)
    db.session.commit()

    return conv, task, agent, None


def _get_conversation_for_agent(agent_id, user_id, conversation_id=None):
    """为智能体维度获取或创建会话"""
    agent = Agent.query.get(agent_id)
    if not agent:
        return None, None, None, _openai_error(f"Agent '{agent_id}' not found", "model_not_found", "model", 404)

    if conversation_id:
        conv = Conversation.query.get(conversation_id)
        if conv:
            task = ActionTask.query.get(conv.action_task_id)
            return conv, task, agent, None

    task_agent = ActionTaskAgent.query.filter_by(agent_id=agent_id).first()
    if not task_agent:
        return None, None, None, _openai_error(
            f"Agent '{agent_id}' is not assigned to any action task", "model_not_found", "model", 404)

    task = ActionTask.query.get(task_agent.action_task_id)

    convs = Conversation.query.filter_by(action_task_id=task.id).order_by(Conversation.created_at.desc()).all()
    for c in convs:
        ca = ConversationAgent.query.filter_by(conversation_id=c.id, agent_id=agent_id).first()
        if ca:
            return c, task, agent, None

    conv = Conversation(
        title=f"OpenAI Export - {agent.name}",
        action_task_id=task.id,
        mode='sequential',
        status='active'
    )
    db.session.add(conv)
    db.session.flush()
    conv_agent = ConversationAgent(conversation_id=conv.id, agent_id=agent.id, is_default=True)
    db.session.add(conv_agent)
    db.session.commit()

    return conv, task, agent, None


def _get_conversation_for_task(task_id, user_id, agent_id=None, conversation_id=None):
    """为行动任务维度获取或创建会话"""
    task = ActionTask.query.get(task_id)
    if not task:
        return None, None, None, _openai_error(f"Action task '{task_id}' not found", "model_not_found", "model", 404)

    if agent_id:
        agent = Agent.query.get(agent_id)
        if not agent:
            return None, None, None, _openai_error(f"Agent '{agent_id}' not found", "model_not_found", "extra_body.agent_id", 404)
    else:
        task_agent = ActionTaskAgent.query.filter_by(action_task_id=task_id, is_default=True).first()
        if not task_agent:
            task_agent = ActionTaskAgent.query.filter_by(action_task_id=task_id).first()
        if not task_agent:
            return None, None, None, _openai_error("No agents in this action task", "model_not_found", "model", 404)
        agent = Agent.query.get(task_agent.agent_id)

    if conversation_id:
        conv = Conversation.query.get(conversation_id)
        if conv and conv.action_task_id == task_id:
            return conv, task, agent, None

    conv = Conversation.query.filter_by(action_task_id=task_id).order_by(Conversation.created_at.desc()).first()
    if not conv:
        conv = Conversation(
            title=f"OpenAI Export - {task.title}",
            action_task_id=task.id,
            mode='sequential',
            status='active'
        )
        db.session.add(conv)
        db.session.flush()
        for ta in ActionTaskAgent.query.filter_by(action_task_id=task_id).all():
            ca = ConversationAgent(
                conversation_id=conv.id,
                agent_id=ta.agent_id,
                is_default=ta.is_default
            )
            db.session.add(ca)
        db.session.commit()

    return conv, task, agent, None


# ═══════════════════════════════════════════════════════
# Chat Completion 核心处理
# ═══════════════════════════════════════════════════════

def handle_chat_completion(request_data, dimension, user):
    """
    统一处理 chat/completions 请求

    Args:
        request_data: 请求 JSON
        dimension: 'roles' | 'agents' | 'action-tasks'
        user: 当前用户对象

    Returns:
        JSONResponse | StreamingResponse
    """
    model_id = request_data.get('model')
    if not model_id:
        err, status = _openai_error("'model' is required", "missing_field", "model")
        return JSONResponse(content=err, status_code=status)

    messages = request_data.get('messages', [])
    if not messages:
        err, status = _openai_error("'messages' is required and cannot be empty", "missing_field", "messages")
        return JSONResponse(content=err, status_code=status)

    content = messages[-1].get('content', '') if messages else ''
    is_stream = request_data.get('stream', False)
    extra_body = request_data.get('extra_body', {})
    conversation_id = extra_body.get('conversation_id')

    if dimension == 'roles':
        session_id = extra_body.get('session_id')
        conv, task, agent, err = _get_or_create_conversation_for_role(
            model_id, user.id, session_id=session_id, conversation_id=conversation_id)
    elif dimension == 'agents':
        conv, task, agent, err = _get_conversation_for_agent(
            model_id, user.id, conversation_id=conversation_id)
    elif dimension == 'action-tasks':
        agent_id = extra_body.get('agent_id')
        conv, task, agent, err = _get_conversation_for_task(
            model_id, user.id, agent_id=agent_id, conversation_id=conversation_id)
    else:
        err, status = _openai_error("Invalid dimension", "invalid_request")
        return JSONResponse(content=err, status_code=status)

    if err:
        err_body, err_status = err
        return JSONResponse(content=err_body, status_code=err_status)

    message_data = {
        'content': content,
        'target_agent_id': agent.id,
        'user_id': user.id,
        'send_target': 'task',
    }

    if is_stream:
        return _handle_stream(task.id, conv.id, message_data, model_id, conv, task, agent)
    else:
        return _handle_sync(conv.id, message_data, model_id, conv, task, agent)


def _handle_sync(conversation_id, message_data, model_id, conv, task, agent):
    """非流式处理"""
    try:
        human_msg, agent_msg = ConversationService.add_message_to_conversation(
            conversation_id, message_data
        )
        if not agent_msg:
            err, status = _openai_error("Failed to get agent response", "internal_error", status=500)
            return JSONResponse(content=err, status_code=status)

        extra = {
            "conversation_id": conv.id,
            "action_task_id": task.id if task else None,
            "agent_id": agent.id if agent else None,
        }
        return JSONResponse(content=_format_completion(agent_msg.content, model_id, extra=extra))

    except Exception as e:
        logger.error(f"[OpenAI Export] sync error: {e}", exc_info=True)
        err, status = _openai_error(str(e), "internal_error", status=500)
        return JSONResponse(content=err, status_code=status)


def _handle_stream(task_id, conversation_id, message_data, model_id, conv, task, agent):
    """流式处理，返回 OpenAI SSE 格式"""

    result_queue = queue.Queue()
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    created = int(time.time())

    def run():
        # app_context 参数保留为 None（FastAPI 不需要，conversation_service 已忽略）
        ConversationService.process_stream_message(
            None, task_id, conversation_id, message_data, result_queue
        )

    thread = threading.Thread(target=run, daemon=True)
    thread.start()

    def generate():
        while True:
            try:
                msg = result_queue.get(timeout=120)
            except queue.Empty:
                break

            if msg is None:
                break

            if isinstance(msg, dict):
                content_text = msg.get('content')
                conn_status = msg.get('connectionStatus')

                if content_text and not conn_status:
                    chunk = {
                        "id": completion_id,
                        "object": "chat.completion.chunk",
                        "created": created,
                        "model": model_id,
                        "choices": [{
                            "index": 0,
                            "delta": {"content": content_text},
                            "finish_reason": None
                        }]
                    }
                    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"

                if conn_status in ('done', 'agentDone'):
                    final_chunk = {
                        "id": completion_id,
                        "object": "chat.completion.chunk",
                        "created": created,
                        "model": model_id,
                        "choices": [{
                            "index": 0,
                            "delta": {},
                            "finish_reason": "stop"
                        }]
                    }
                    yield f"data: {json.dumps(final_chunk, ensure_ascii=False)}\n\n"

                    extra_data = {
                        "conversation_id": conv.id,
                        "action_task_id": task.id if task else None,
                        "agent_id": agent.id if agent else None,
                    }
                    yield f"data: {json.dumps({'extra': extra_data}, ensure_ascii=False)}\n\n"

                elif conn_status == 'error':
                    error_chunk = {
                        "id": completion_id,
                        "object": "chat.completion.chunk",
                        "created": created,
                        "model": model_id,
                        "choices": [{
                            "index": 0,
                            "delta": {"content": f"\n[Error: {msg.get('error', 'unknown')}]"},
                            "finish_reason": "stop"
                        }]
                    }
                    yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no'
        }
    )


# ═══════════════════════════════════════════════════════
# Chat Completions 路由（三个维度）
# ═══════════════════════════════════════════════════════

@router.post('/openai-export/action-tasks/v1/chat/completions')
async def action_tasks_chat_completions(request: Request, current_user=Depends(get_user_from_api_key)):
    """行动任务维度 Chat Completions"""
    data = await request.json()
    if not data:
        raise HTTPException(status_code=400, detail={"error": {"message": "Request body is required", "type": "invalid_request_error", "code": "missing_body"}})
    return handle_chat_completion(data, 'action-tasks', current_user)


@router.post('/openai-export/agents/v1/chat/completions')
async def agents_chat_completions(request: Request, current_user=Depends(get_user_from_api_key)):
    """智能体维度 Chat Completions"""
    data = await request.json()
    if not data:
        raise HTTPException(status_code=400, detail={"error": {"message": "Request body is required", "type": "invalid_request_error", "code": "missing_body"}})
    return handle_chat_completion(data, 'agents', current_user)


@router.post('/openai-export/roles/v1/chat/completions')
async def roles_chat_completions(request: Request, current_user=Depends(get_user_from_api_key)):
    """角色维度 Chat Completions"""
    data = await request.json()
    if not data:
        raise HTTPException(status_code=400, detail={"error": {"message": "Request body is required", "type": "invalid_request_error", "code": "missing_body"}})
    return handle_chat_completion(data, 'roles', current_user)


# ═══════════════════════════════════════════════════════
# API Key CRUD 路由
# ═══════════════════════════════════════════════════════

@router.post('/openai-export/api-keys')
async def create_api_key(request: Request, current_user=Depends(get_current_user)):
    """创建新的 API Key"""
    data = await request.json() or {}
    name = data.get('name', '').strip()
    if not name:
        raise HTTPException(status_code=400, detail={'error': 'name is required'})

    raw_key = _generate_api_key()
    key_hash = hash_api_key(raw_key)
    key_prefix = raw_key[:12] + '...'

    api_key = APIKey(
        name=name,
        key_hash=key_hash,
        key_prefix=key_prefix,
        user_id=current_user.id,
    )
    db.session.add(api_key)
    db.session.commit()

    result = api_key.to_dict()
    result['key'] = raw_key
    return JSONResponse(content=result, status_code=201)


@router.get('/openai-export/api-keys')
def list_api_keys(current_user=Depends(get_current_user)):
    """列出当前用户的所有 API Keys"""
    keys = APIKey.query.filter_by(user_id=current_user.id).order_by(APIKey.created_at.desc()).all()
    return {'api_keys': [k.to_dict() for k in keys]}


@router.delete('/openai-export/api-keys/{key_id}')
def delete_api_key(key_id: int, current_user=Depends(get_current_user)):
    """删除指定的 API Key"""
    api_key = APIKey.query.filter_by(id=key_id, user_id=current_user.id).first()
    if not api_key:
        raise HTTPException(status_code=404, detail={'error': 'API key not found'})

    db.session.delete(api_key)
    db.session.commit()
    return {'message': 'API key deleted'}
