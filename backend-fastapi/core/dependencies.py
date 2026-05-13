"""
FastAPI 依赖注入

替代 Flask 的装饰器模式（@login_required, @admin_required, @api_key_required）
"""
import hashlib
import jwt
import logging
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from core.config import settings
from core.database import get_db

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════
# JWT 用户认证
# ═══════════════════════════════════════════════════════

def _extract_bearer_token(request: Request) -> str | None:
    """从 Authorization header 提取 Bearer token"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    return auth_header.split(' ', 1)[1].strip()


def get_current_user_optional(request: Request):
    """
    可选认证：返回 User 或 None（不报错）

    用于不强制登录但需要知道用户身份的接口
    """
    from app.models import User
    token = _extract_bearer_token(request)
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        user_id = payload.get('user_id')
        user = User.query.get(user_id)
        if user and user.is_active:
            return user
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        pass
    return None


def get_current_user(request: Request):
    """
    强制认证：返回 User 或抛出 401

    用法：
        @router.get('/items')
        def list_items(current_user: User = Depends(get_current_user)):
            ...
    """
    user = get_current_user_optional(request)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='需要登录'
        )
    return user


def get_admin_user(current_user=Depends(get_current_user)):
    """
    管理员认证：先验证登录，再检查 is_admin

    用法：
        @router.get('/admin/users')
        def list_users(admin: User = Depends(get_admin_user)):
            ...
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='需要管理员权限'
        )
    return current_user


# ═══════════════════════════════════════════════════════
# API Key 认证（OpenAI Export 接口用）
# ═══════════════════════════════════════════════════════

def get_user_from_api_key(request: Request):
    """
    API Key 认证依赖

    用法：
        @router.post('/openai-export/chat')
        def chat(user = Depends(get_user_from_api_key)):
            ...
    """
    from app.models import APIKey, User
    from app.extensions import db
    from app.utils.datetime_utils import get_current_time_with_timezone

    token = _extract_bearer_token(request)
    if not token or not token.startswith('sk-abm-'):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "message": "Invalid or missing API key",
                    "type": "authentication_error",
                    "code": "invalid_api_key"
                }
            }
        )

    key_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
    api_key = APIKey.query.filter_by(key_hash=key_hash, is_active=True).first()
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    user = User.query.get(api_key.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    api_key.last_used_at = get_current_time_with_timezone()
    db.session.commit()

    return user


# ═══════════════════════════════════════════════════════
# 多租户权限辅助
# ═══════════════════════════════════════════════════════

def filter_user_tasks(query, current_user):
    """根据用户权限过滤任务查询"""
    if current_user.is_admin:
        return query
    from app.models import ActionTask
    from sqlalchemy import or_
    return query.filter(
        or_(
            ActionTask.user_id == current_user.id,
            ActionTask.is_shared == True
        )
    )


def can_access_task(task, current_user) -> bool:
    """检查用户是否可以访问特定任务"""
    if current_user.is_admin:
        return True
    return task.user_id == current_user.id or task.is_shared


def clean_db_session():
    """
    FastAPI 依赖：确保 DB session 干净
    
    在每个请求开始时清理 session 状态。
    
    必要原因：
    1. FastAPI 的 sync def 路由运行在 AnyIO worker 线程池中，线程会被复用
    2. scoped_session 是 thread-local 的，复用线程 = 复用 session
    3. MySQL REPEATABLE READ 隔离级别下，同一事务内只看到事务开始时的快照
    4. 如果前一个请求的事务没有结束（没有 commit/rollback），
       当前请求会继承该事务的快照，看不到其他线程/连接提交的新数据
    5. rollback() 结束旧事务，下次查询时自动开始新事务，看到最新数据
    
    用法：
        router = APIRouter(dependencies=[Depends(clean_db_session)])
    """
    from core.database import ScopedSession
    try:
        # rollback 结束旧事务 → 下次查询开始新事务 → 看到最新数据
        ScopedSession().rollback()
    except Exception:
        pass
    yield
    # 请求结束后也清理（防止脏事务传播到同线程的下一个请求）
    try:
        ScopedSession().rollback()
    except Exception:
        pass
