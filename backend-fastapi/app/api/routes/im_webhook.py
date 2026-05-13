"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: im_webhook.py
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
# Source: im_webhook.py
# ============================================================

"""
IM Webhook 路由

接收各 IM 平台的 Webhook 回调，复用 openai_export 的会话链路处理消息。
"""
import logging


from app.models import (
    db, IMBotConfig, Agent, ActionTask, ActionTaskAgent,
    Conversation, ConversationAgent
)
from app.services.conversation_service import ConversationService
from app.services.im_integration.telegram_service import telegram_service
from app.services.im_integration.slack_service import slack_service

logger = logging.getLogger(__name__)



def _get_or_create_im_conversation(agent_id, user_id, session_key):
    """
    获取或创建 IM 会话，复用 openai_export 的模式：
    用 Conversation.title 做 session 映射。
    """
    agent = Agent.query.get(agent_id)
    if not agent:
        return None, None, None, f"Agent '{agent_id}' not found"

    existing = Conversation.query.filter_by(title=session_key).first()
    if existing:
        task = ActionTask.query.get(existing.action_task_id)
        return existing, task, agent, None

    task_agent = ActionTaskAgent.query.filter_by(agent_id=agent_id).first()
    if not task_agent:
        return None, None, None, f"Agent '{agent_id}' is not assigned to any action task"

    task = ActionTask.query.get(task_agent.action_task_id)

    conv = Conversation(
        title=session_key,
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


def _handle_im_message(platform_service, bot_config, parsed):
    """通用 IM 消息处理逻辑"""
    chat_id = parsed['chat_id']
    text = parsed['text']
    credentials = bot_config.credentials or {}

    config = bot_config.config or {}
    trigger_mode = config.get('trigger_mode', 'all')
    if trigger_mode == 'command' and not text.startswith('/'):
        return JSONResponse(content={'ok': True}, status_code=200)

    if text.startswith('/'):
        parts = text.split(None, 1)
        text = parts[1] if len(parts) > 1 else ''
        if not text:
            platform_service.send_reply(credentials, chat_id, 'Please provide a message after the command.')
            return JSONResponse(content={'ok': True}, status_code=200)

    session_key = f"im-{platform_service.platform_name}-{chat_id}"

    conv, task, agent, err = _get_or_create_im_conversation(
        bot_config.agent_id, bot_config.user_id, session_key
    )
    if err:
        logger.error(f'[IM Webhook] conversation error: {err}')
        platform_service.send_reply(credentials, chat_id, 'Bot configuration error. Please contact admin.')
        return JSONResponse(content={'ok': True}, status_code=200)

    try:
        message_data = {
            'content': text,
            'target_agent_id': agent.id,
            'user_id': bot_config.user_id,
            'send_target': 'task',
        }
        human_msg, agent_msg = ConversationService.add_message_to_conversation(
            conv.id, message_data
        )
        if agent_msg and agent_msg.content:
            platform_service.send_reply(credentials, chat_id, agent_msg.content)
        else:
            platform_service.send_reply(credentials, chat_id, 'Sorry, I could not generate a response.')
    except Exception as e:
        logger.error(f'[IM Webhook] process error: {e}', exc_info=True)
        platform_service.send_reply(credentials, chat_id, 'An error occurred while processing your message.')

    return JSONResponse(content={'ok': True}, status_code=200)


@router.post('/webhooks/telegram/{bot_id}')
async def telegram_webhook(bot_id, request: Request):
    bot_config = IMBotConfig.query.get(bot_id)
    if not bot_config or not bot_config.is_active:
        return JSONResponse(content={'ok': True}, status_code=200)

    try:
        payload = await request.json()
    except Exception:
        payload = {}
    parsed = telegram_service.parse_webhook(payload)
    if not parsed:
        return JSONResponse(content={'ok': True}, status_code=200)

    return _handle_im_message(telegram_service, bot_config, parsed)


@router.post('/webhooks/slack/{bot_id}')
async def slack_webhook(bot_id, request: Request):
    # 先取原始 body（签名验证需要），再解析 JSON
    raw_body = (await request.body()).decode('utf-8')
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    # Slack URL verification challenge
    if payload.get('type') == 'url_verification':
        return JSONResponse(content={'challenge': payload.get('challenge', '')}, status_code=200)

    # 忽略重试请求（Slack 会在 3 秒无响应时重试）
    if request.headers.get('X-Slack-Retry-Num'):
        return JSONResponse(content={'ok': True}, status_code=200)

    bot_config = IMBotConfig.query.get(bot_id)
    if not bot_config or not bot_config.is_active:
        return JSONResponse(content={'ok': True}, status_code=200)

    # 验证签名
    credentials = bot_config.credentials or {}
    signing_secret = credentials.get('signing_secret', '')
    if signing_secret:
        timestamp = request.headers.get('X-Slack-Request-Timestamp', '')
        signature = request.headers.get('X-Slack-Signature', '')
        if not slack_service.verify_signature(signing_secret, timestamp, raw_body, signature):
            logger.warning(f'[Slack Webhook] invalid signature for bot {bot_id}')
            raise HTTPException(status_code=403, detail={'error': 'invalid signature'})

    parsed = slack_service.parse_webhook(payload)
    if not parsed:
        return JSONResponse(content={'ok': True}, status_code=200)

    return _handle_im_message(slack_service, bot_config, parsed)

