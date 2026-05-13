"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: vnc.py
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
# Source: vnc.py
# ============================================================

"""
VNC 代理 API 路由

使用 websockify 子进程实现 WebSocket 代理
"""
import logging
from app.services.vnc_proxy import vnc_proxy
from app.models import MarketApp

logger = logging.getLogger(__name__)



def check_nextrpa_enabled() -> bool:
    """检查 NextRPA 应用是否启用"""
    app_record = MarketApp.query.filter_by(app_id='next-rpa').first()
    return app_record and app_record.enabled


@router.post('/market/apps/next-rpa/vnc/start')
async def start_vnc_session(request: Request):
    """启动 VNC 代理会话"""
    if not check_nextrpa_enabled():
        raise HTTPException(status_code=403, detail={'error': 'NextRPA 应用未启用'})
    
    data = await request.json() or {}
    target = data.get('target', '')
    
    try:
        host, port = target.rsplit(':', 1)
        int(port)
    except ValueError:
        raise HTTPException(status_code=400, detail={'error': 'Invalid target format, use host:port'})
    
    try:
        result = vnc_proxy.start(target)
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail={'error': str(e)})


@router.post('/market/apps/next-rpa/vnc/stop')
def stop_vnc_session(request: Request):
    """停止指定的 VNC 代理会话"""
    token = request.query_params.get('token', '')
    if not token:
        raise HTTPException(status_code=400, detail={'error': 'Token is required'})
    
    success = vnc_proxy.stop(token)
    return {'success': success}


@router.get('/market/apps/next-rpa/vnc/status')
def get_vnc_status():
    """获取 VNC 代理状态"""
    return {'active_sessions': vnc_proxy.get_active_count()}

