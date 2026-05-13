"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: public_tasks.py
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from core.config import settings
from core.dependencies import get_current_user, get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================
# Source: public_tasks.py
# ============================================================

"""
公开任务访问API路由

处理发布任务的公开访问（无需登录）
"""
from app.models import (
    PublishedTask, ActionTask, Agent, Conversation, Message, ConversationAgent,
    ActionTaskAgent, ActionTaskEnvironmentVariable, AgentVariable, db
)
from werkzeug.security import check_password_hash
from datetime import datetime
from sqlalchemy import desc
import logging

# 创建Blueprint

# 设置日志
logger = logging.getLogger(__name__)


def verify_access(published_task, password=None):
    """
    验证访问权限

    Args:
        published_task: PublishedTask对象
        password: 访问密码（可选）

    Returns:
        tuple: (is_allowed, error_message)
    """
    # 检查是否启用
    if not published_task.is_active:
        return False, '此分享已被禁用'

    # 检查是否过期
    if published_task.expires_at:
        # 确保时区一致性：如果expires_at有时区信息，使用aware datetime比较
        # 如果没有时区信息，使用naive datetime比较
        current_time = datetime.utcnow()
        expires_at = published_task.expires_at

        # 如果expires_at是aware datetime，转换current_time为aware
        if expires_at.tzinfo is not None:
            from datetime import timezone
            current_time = datetime.now(timezone.utc)

        # 移除微秒进行比较，避免精度问题
        if expires_at.replace(microsecond=0) < current_time.replace(microsecond=0):
            return False, '此分享已过期'

    # 检查访问类型
    if published_task.access_type == 'password':
        if not password:
            return False, '需要密码访问'
        if not check_password_hash(published_task.access_password, password):
            return False, '密码错误'

    return True, None


@router.get('/public/task/{share_token}')
def get_published_task(share_token, request: Request):
    """
    获取发布的任务信息（公开访问，无需登录）
    
    查询参数:
    - password: 访问密码（如果需要）
    """
    try:
        # 查找发布的任务
        published_task = PublishedTask.query.filter_by(share_token=share_token).first()
        if not published_task:
            raise HTTPException(status_code=404, detail={'error': '分享不存在'})
        
        # 验证访问权限
        password = request.query_params.get('password')
        is_allowed, error_msg = verify_access(published_task, password)
        if not is_allowed:
            raise HTTPException(status_code=401, detail={'error': error_msg, 'requires_password': published_task.access_type == 'password'})
        
        # 更新访问统计
        published_task.view_count += 1
        published_task.last_viewed_at = datetime.utcnow()
        db.session.commit()
        
        # 获取任务信息
        task = ActionTask.query.get(published_task.action_task_id)
        if not task:
            raise HTTPException(status_code=404, detail={'error': '任务不存在'})
        
        # 构建响应数据
        response_data = {
            'task': {
                'id': task.id,
                'title': published_task.title or task.title,
                'description': published_task.description or task.description,
                'mode': published_task.mode,
                'status': task.status,
                'action_space_id': task.action_space_id,  # 添加行动空间ID
                'config': {
                    'show_messages': published_task.show_messages
                },
                'theme': published_task.theme,
                'branding': published_task.branding
            }
        }

        # 始终显示智能体列表
        agents_data = []
        # 获取任务的智能体
        from app.models import ActionTaskAgent
        task_agents = ActionTaskAgent.query.filter_by(action_task_id=task.id).all()

        for task_agent in task_agents:
            agent = Agent.query.get(task_agent.agent_id)
            if agent:
                agents_data.append({
                    'id': agent.id,
                    'name': agent.name,
                    'role_name': agent.role.name if agent.role else None,
                    'avatar': agent.avatar,
                    'is_default': task_agent.is_default
                })

        response_data['agents'] = agents_data
        
        # 如果允许显示消息
        if published_task.show_messages:
            conversations_data = []
            conversations = Conversation.query.filter_by(action_task_id=task.id).order_by(Conversation.created_at.desc()).all()
            
            for conv in conversations:
                conv_data = {
                    'id': conv.id,
                    'title': conv.title,
                    'created_at': conv.created_at.isoformat() if conv.created_at else None,
                    'messages': []
                }
                
                # 获取会话的消息
                messages = Message.query.filter_by(conversation_id=conv.id).order_by(Message.created_at).all()
                for msg in messages:
                    # 确定发送者类型
                    sender_type = 'user' if msg.role == 'human' else 'agent'

                    msg_data = {
                        'id': msg.id,
                        'content': msg.content,
                        'sender_type': sender_type,
                        'sender_id': msg.agent_id if msg.agent_id else msg.user_id,
                        'created_at': msg.created_at.isoformat() if msg.created_at else None
                    }

                    # 添加发送者信息
                    if msg.role == 'agent' and msg.agent_id:
                        agent = Agent.query.get(msg.agent_id)
                        if agent:
                            msg_data['sender_name'] = agent.name
                            msg_data['sender_avatar'] = agent.avatar
                    elif msg.role == 'human':
                        msg_data['sender_name'] = '用户'
                        msg_data['sender_type'] = 'user'

                    conv_data['messages'].append(msg_data)
                
                conversations_data.append(conv_data)
            
            response_data['conversations'] = conversations_data
        
        return response_data
        
    except Exception as e:
        logger.error(f"获取发布任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'获取发布任务失败: {str(e)}'})


@router.post('/public/task/{share_token}/verify')
async def verify_password(share_token, request: Request):
    """验证访问密码"""
    try:
        # 查找发布的任务
        published_task = PublishedTask.query.filter_by(share_token=share_token).first()
        if not published_task:
            raise HTTPException(status_code=404, detail={'error': '分享不存在'})
        
        data = await request.json() or {}
        password = data.get('password')
        
        # 验证访问权限
        is_allowed, error_msg = verify_access(published_task, password)
        if not is_allowed:
            raise HTTPException(status_code=401, detail={'error': error_msg, 'valid': False})
        
        return {
            'valid': True,
            'message': '验证成功'
        }
        
    except Exception as e:
        logger.error(f"验证密码失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'验证密码失败: {str(e)}'})


@router.get('/public/task/{share_token}/messages')
def get_published_task_messages(share_token, request: Request):
    """获取发布任务的消息列表"""
    try:
        # 查找发布的任务
        published_task = PublishedTask.query.filter_by(share_token=share_token).first()
        if not published_task:
            raise HTTPException(status_code=404, detail={'error': '分享不存在'})
        
        # 验证访问权限
        password = request.query_params.get('password')
        is_allowed, error_msg = verify_access(published_task, password)
        if not is_allowed:
            raise HTTPException(status_code=401, detail={'error': error_msg})
        
        # 检查是否允许显示消息
        if not published_task.show_messages:
            raise HTTPException(status_code=403, detail={'error': '不允许查看消息'})
        
        # 获取会话ID参数
        conversation_id = request.query_params.get('conversation_id')
        
        # 获取任务
        task = ActionTask.query.get(published_task.action_task_id)
        if not task:
            raise HTTPException(status_code=404, detail={'error': '任务不存在'})
        
        # 构建查询
        if conversation_id:
            messages = Message.query.filter_by(
                conversation_id=conversation_id,
                action_task_id=task.id
            ).order_by(Message.created_at).all()
        else:
            messages = Message.query.filter_by(
                action_task_id=task.id
            ).order_by(Message.created_at.desc()).limit(100).all()
        
        # 格式化消息
        messages_data = []
        for msg in messages:
            # 确定发送者类型
            sender_type = 'user' if msg.role == 'human' else 'agent'

            msg_data = {
                'id': msg.id,
                'content': msg.content,
                'sender_type': sender_type,
                'sender_id': msg.agent_id if msg.agent_id else msg.user_id,
                'conversation_id': msg.conversation_id,
                'created_at': msg.created_at.isoformat() if msg.created_at else None
            }

            # 添加发送者信息
            if msg.role == 'agent' and msg.agent_id:
                agent = Agent.query.get(msg.agent_id)
                if agent:
                    msg_data['sender_name'] = agent.name
                    msg_data['sender_avatar'] = agent.avatar
            elif msg.role == 'human':
                msg_data['sender_name'] = '用户'
                msg_data['sender_type'] = 'user'

            messages_data.append(msg_data)
        
        return {
            'messages': messages_data,
            'total': len(messages_data)
        }
        
    except Exception as e:
        logger.error(f"获取消息失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'获取消息失败: {str(e)}'})


@router.post('/public/task/{share_token}/send')
async def send_message_to_published_task(share_token, request: Request):
    """向发布的任务发送消息（仅交互模式）"""
    try:
        # 查找发布的任务
        published_task = PublishedTask.query.filter_by(share_token=share_token).first()
        if not published_task:
            raise HTTPException(status_code=404, detail={'error': '分享不存在'})

        # 验证访问权限
        data = await request.json() or {}
        password = data.get('password')
        is_allowed, error_msg = verify_access(published_task, password)
        if not is_allowed:
            raise HTTPException(status_code=401, detail={'error': error_msg})

        # 检查是否为交互模式
        if published_task.mode != 'interactive':
            raise HTTPException(status_code=403, detail={'error': '只读模式不允许发送消息'})
        
        # 获取任务
        task = ActionTask.query.get(published_task.action_task_id)
        if not task:
            raise HTTPException(status_code=404, detail={'error': '任务不存在'})
        
        # 获取或创建会话
        conversation_id = data.get('conversation_id')
        if conversation_id:
            conversation = Conversation.query.get(conversation_id)
            if not conversation or conversation.action_task_id != task.id:
                raise HTTPException(status_code=404, detail={'error': '会话不存在'})
        else:
            # 创建新会话
            conversation = Conversation(
                title='公开访问会话',
                action_task_id=task.id
            )
            db.session.add(conversation)
            db.session.flush()
        
        # 创建消息
        content = data.get('content')
        if not content:
            raise HTTPException(status_code=400, detail={'error': '消息内容不能为空'})

        message = Message(
            content=content,
            role='human',  # 使用role字段而不是sender_type
            conversation_id=conversation.id,
            action_task_id=task.id
        )
        
        db.session.add(message)
        db.session.commit()
        
        return JSONResponse(content={
            'success': True,
            'message_id': message.id,
            'conversation_id': conversation.id,
            'created_at': message.created_at.isoformat() if message.created_at else None
        }, status_code=201)
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"发送消息失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'发送消息失败: {str(e)}'})


@router.get('/public/task/{share_token}/variables')
def get_published_task_variables(share_token, request: Request):
    """
    获取发布任务的变量（公开访问，无需登录）

    查询参数:
    - password: 访问密码（如果需要）
    """
    try:
        # 查找发布的任务
        published_task = PublishedTask.query.filter_by(share_token=share_token).first()
        if not published_task:
            raise HTTPException(status_code=404, detail={'error': '分享不存在'})

        # 验证访问权限
        password = request.query_params.get('password')
        is_allowed, error_msg = verify_access(published_task, password)
        if not is_allowed:
            raise HTTPException(status_code=401, detail={'error': error_msg})

        # 获取任务信息
        task = ActionTask.query.get(published_task.action_task_id)
        if not task:
            raise HTTPException(status_code=404, detail={'error': '任务不存在'})

        # 获取环境变量
        env_vars = ActionTaskEnvironmentVariable.query.filter_by(action_task_id=task.id).all()
        environment_variables = []

        for var in env_vars:
            environment_variables.append({
                'id': var.id,
                'name': var.name,
                'label': getattr(var, 'label', var.name.replace('_', ' ').title()),
                'value': var.value,
                'history': var.history if var.history else [],
                'source': 'task'
            })

        # 获取所有智能体
        task_agents = ActionTaskAgent.query.filter_by(action_task_id=task.id).all()
        agent_variables = []

        # 一次性获取所有智能体变量
        agent_ids = [ta.agent_id for ta in task_agents]
        agents_dict = {agent.id: agent for agent in Agent.query.filter(Agent.id.in_(agent_ids)).all()}

        # 批量查询所有智能体变量
        all_agent_vars = AgentVariable.query.filter(AgentVariable.agent_id.in_(agent_ids)).all()

        for var in all_agent_vars:
            agent = agents_dict.get(var.agent_id)
            if agent:
                agent_variables.append({
                    'id': var.id,
                    'name': var.name,
                    'label': getattr(var, 'label', var.name.replace('_', ' ').title()),
                    'value': var.value,
                    'is_public': var.is_public,
                    'agent_id': agent.id,
                    'agent_name': agent.name,
                    'role_id': agent.role_id if hasattr(agent, 'role_id') else None,
                    'history': var.history if var.history else [],
                    'source': 'agent'
                })

        # 返回结果
        return {
            'environmentVariables': environment_variables,
            'agentVariables': agent_variables,
            'lastUpdated': datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"获取变量失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'获取变量失败: {str(e)}'})


