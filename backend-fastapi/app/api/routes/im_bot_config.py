"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: im_bot_config.py
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
# Source: im_bot_config.py
# ============================================================

"""
IM Bot 配置 CRUD API

POST   /api/im-bots              创建
GET    /api/im-bots              列表
GET    /api/im-bots/:id          详情
PUT    /api/im-bots/:id          更新
DELETE /api/im-bots/:id          删除
POST   /api/im-bots/:id/test     测试连接
POST   /api/im-bots/:id/register-webhook  注册 Webhook
"""
import logging


from app.models import db, IMBotConfig, Agent
from app.services.im_integration.telegram_service import telegram_service
from app.services.im_integration.slack_service import slack_service
from config import BACKEND_URL

logger = logging.getLogger(__name__)


PLATFORM_SERVICES = {
    'telegram': telegram_service,
    'slack': slack_service,
}


@router.post('/im-bots')
async def create_im_bot(request: Request, current_user=Depends(get_current_user)):
    data = await request.json() or {}
    name = data.get('name', '').strip()
    platform = data.get('platform', '').strip()
    credentials = data.get('credentials', {})
    agent_id = data.get('agent_id')
    config = data.get('config', {})

    if not name:
        raise HTTPException(status_code=400, detail={'error': 'name is required'})
    if platform not in PLATFORM_SERVICES:
        raise HTTPException(status_code=400, detail={'error': f'Unsupported platform: {platform}'})

    if agent_id:
        agent = Agent.query.get(agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail={'error': 'Agent not found'})

    bot = IMBotConfig(
        name=name,
        platform=platform,
        credentials=credentials,
        agent_id=agent_id,
        user_id=current_user.id,
        config=config,
        is_active=True,
    )
    db.session.add(bot)
    db.session.commit()

    return JSONResponse(content=bot.to_dict(include_credentials=True), status_code=201)


@router.get('/im-bots')
def list_im_bots(current_user=Depends(get_current_user)):
    bots = IMBotConfig.query.filter_by(
        user_id=current_user.id
    ).order_by(IMBotConfig.created_at.desc()).all()
    return {'im_bots': [b.to_dict() for b in bots]}


@router.get('/im-bots/{bot_id}')
def get_im_bot(bot_id, current_user=Depends(get_current_user)):
    bot = IMBotConfig.query.filter_by(id=bot_id, user_id=current_user.id).first()
    if not bot:
        raise HTTPException(status_code=404, detail={'error': 'Bot not found'})
    return bot.to_dict(include_credentials=True)


@router.put('/im-bots/{bot_id}')
async def update_im_bot(bot_id, request: Request, current_user=Depends(get_current_user)):
    bot = IMBotConfig.query.filter_by(id=bot_id, user_id=current_user.id).first()
    if not bot:
        raise HTTPException(status_code=404, detail={'error': 'Bot not found'})

    data = await request.json() or {}

    if 'name' in data:
        bot.name = data['name'].strip()
    if 'credentials' in data:
        bot.credentials = data['credentials']
        bot.webhook_registered = False
    if 'agent_id' in data:
        if data['agent_id']:
            agent = Agent.query.get(data['agent_id'])
            if not agent:
                raise HTTPException(status_code=404, detail={'error': 'Agent not found'})
        bot.agent_id = data['agent_id']
    if 'config' in data:
        bot.config = data['config']
    if 'is_active' in data:
        bot.is_active = data['is_active']

    db.session.commit()
    return bot.to_dict(include_credentials=True)


@router.delete('/im-bots/{bot_id}')
def delete_im_bot(bot_id, current_user=Depends(get_current_user)):
    bot = IMBotConfig.query.filter_by(id=bot_id, user_id=current_user.id).first()
    if not bot:
        raise HTTPException(status_code=404, detail={'error': 'Bot not found'})

    # 尝试注销 webhook
    svc = PLATFORM_SERVICES.get(bot.platform)
    if svc and bot.webhook_registered and hasattr(svc, 'unregister_webhook'):
        try:
            svc.unregister_webhook(bot.credentials or {})
        except Exception as e:
            logger.warning(f'Failed to unregister webhook for bot {bot_id}: {e}')

    db.session.delete(bot)
    db.session.commit()
    return {'message': 'Bot deleted'}


@router.post('/im-bots/{bot_id}/test')
def test_im_bot(bot_id, current_user=Depends(get_current_user)):
    bot = IMBotConfig.query.filter_by(id=bot_id, user_id=current_user.id).first()
    if not bot:
        raise HTTPException(status_code=404, detail={'error': 'Bot not found'})

    svc = PLATFORM_SERVICES.get(bot.platform)
    if not svc:
        raise HTTPException(status_code=400, detail={'error': f'Unsupported platform: {bot.platform}'})

    success, message = svc.test_connection(bot.credentials or {})
    return {'success': success, 'message': message}


@router.post('/im-bots/{bot_id}/register-webhook')
def register_webhook(bot_id, current_user=Depends(get_current_user)):
    bot = IMBotConfig.query.filter_by(id=bot_id, user_id=current_user.id).first()
    if not bot:
        raise HTTPException(status_code=404, detail={'error': 'Bot not found'})

    svc = PLATFORM_SERVICES.get(bot.platform)
    if not svc:
        raise HTTPException(status_code=400, detail={'error': f'Unsupported platform: {bot.platform}'})

    webhook_url = f"{BACKEND_URL}/api/webhooks/{bot.platform}/{bot.id}"
    success, message = svc.register_webhook(bot.credentials or {}, webhook_url)

    if success:
        bot.webhook_registered = True
        db.session.commit()

    return {'success': success, 'message': message, 'webhook_url': webhook_url}

