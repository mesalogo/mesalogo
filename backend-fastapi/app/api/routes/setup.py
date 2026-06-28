"""
首启引导（Setup）API 路由

两类接口：
- GET /setup/status   —— 常驻（正常模式也响应），前端据此判断是否进引导。
- POST /setup/test-db、/setup/test-redis、/setup/save
                      —— 仅在 Setup 模式下挂载（见 app/api/routes/__init__.py），
                         且 handler 内再次断言 SETUP_MODE，配置完成后彻底失效，
                         避免遗留无认证的改配置接口（参见提交 1d0a4de6 的教训）。

注意：Setup 模式下数据库尚不可用，本模块不得依赖任何 DB / ORM。
"""
import logging

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse

from core.config import settings

logger = logging.getLogger(__name__)

# 常驻路由：仅 GET /setup/status
status_router = APIRouter()

# 写路由：仅 Setup 模式挂载
setup_router = APIRouter()


@status_router.get('/setup/status')
def setup_status():
    """前端探活：返回是否处于 Setup 模式。"""
    return {'setup_mode': settings.SETUP_MODE}


def _ensure_setup_mode():
    """纵深防御：即便路由被误挂载，也拒绝在非 Setup 模式下改配置。"""
    if not settings.SETUP_MODE:
        raise HTTPException(status_code=410, detail='系统已完成初始化，引导接口不可用')


@setup_router.post('/setup/test-db')
async def setup_test_db(request: Request):
    """实测数据库连接。入参 {database_uri}。"""
    _ensure_setup_mode()
    body = await request.json()
    from core.setup_service import test_db
    result = test_db(body.get('database_uri', ''))
    if result['ok']:
        return {'success': True}
    return JSONResponse(status_code=400, content={'success': False, 'error': result['error']})


@setup_router.post('/setup/test-redis')
async def setup_test_redis(request: Request):
    """实测 Redis 连接。入参 {redis_url}。"""
    _ensure_setup_mode()
    body = await request.json()
    from core.setup_service import test_redis
    result = test_redis(body.get('redis_url', ''))
    if result['ok']:
        return {'success': True}
    return JSONResponse(status_code=400, content={'success': False, 'error': result['error']})


@setup_router.post('/setup/save')
async def setup_save(request: Request):
    """
    保存连接级配置到 config.conf 并调度后端自重启。

    入参：{database_uri(必填), redis_url?, host?, port?}
    保存前再测一次数据库连接，避免落盘一个连不上的配置把系统锁死在
    正常模式（重启后无引导、又连不上库）。
    """
    _ensure_setup_mode()
    body = await request.json()
    from core.setup_service import test_db, write_config, schedule_restart

    db_check = test_db(body.get('database_uri', ''))
    if not db_check['ok']:
        return JSONResponse(
            status_code=400,
            content={'success': False, 'error': f"数据库连接失败，未保存: {db_check['error']}"},
        )

    result = write_config(body)
    if not result['ok']:
        return JSONResponse(status_code=500, content={'success': False, 'error': result['error']})

    schedule_restart(delay=1.0)
    return {'success': True, 'message': '配置已保存，后端正在重启'}
