"""
认证 API 路由

处理用户登录、登出和认证相关的 API 请求

Flask → FastAPI 变更:
- Blueprint → APIRouter
- request.json → Pydantic model / Body
- jsonify() → 直接返回 dict
- current_app.config → settings
"""
import jwt
import datetime
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Depends, Body
from pydantic import BaseModel
from app.models import User, db
from core.config import settings
from core.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── 请求体模型 ───

class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    new_password: str


# ─── 路由 ───

@router.post('/login')
def login(body: LoginRequest):
    """用户登录 API"""
    if not body.username or not body.password:
        raise HTTPException(status_code=400, detail='用户名和密码不能为空')

    # 查询用户
    user = User.query.filter_by(username=body.username).first()

    # 验证用户和密码
    if not user or not user.check_password(body.password):
        raise HTTPException(status_code=401, detail='用户名或密码错误')

    # 检查用户状态
    if not user.is_active:
        raise HTTPException(status_code=403, detail='用户账号已被禁用')

    # 生成 JWT 令牌
    token_expiry = datetime.datetime.utcnow() + datetime.timedelta(days=1)
    token_payload = {
        'user_id': user.id,
        'username': user.username,
        'exp': token_expiry
    }
    token = jwt.encode(token_payload, settings.SECRET_KEY, algorithm='HS256')

    # 获取用户角色
    from app.services.user_permission_service import UserPermissionService
    user_roles = UserPermissionService.get_user_roles(user)

    return {
        'status': 'success',
        'message': '登录成功',
        'token': token,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_admin': user.is_admin,
            'is_active': user.is_active,
            'display_name': user.display_name,
            'roles': user_roles
        }
    }


@router.post('/logout')
def logout():
    """用户登出 API"""
    return {
        'status': 'success',
        'message': '登出成功'
    }


@router.get('/validate')
def validate_token(request: Request):
    """验证令牌有效性"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='未提供认证令牌')

    token = auth_header.split(' ')[1]

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        user_id = payload.get('user_id')
        user = User.query.get(user_id)

        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail='用户不存在或已被禁用')

        return {'status': 'success', 'message': '令牌有效', 'valid': True}

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='令牌已过期')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='无效的令牌')


@router.get('/user')
def get_current_user_info(request: Request):
    """获取当前登录用户信息"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='未提供认证令牌')

    token = auth_header.split(' ')[1]

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        user_id = payload.get('user_id')
        user = User.query.get(user_id)

        if not user:
            raise HTTPException(status_code=404, detail='用户不存在')
        if not user.is_active:
            raise HTTPException(status_code=403, detail='用户账号已被禁用')

        from app.services.user_permission_service import UserPermissionService
        user_roles = UserPermissionService.get_user_roles(user)

        return {
            'status': 'success',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_admin': user.is_admin,
                'is_active': user.is_active,
                'display_name': user.display_name,
                'roles': user_roles
            }
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='令牌已过期')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='无效的令牌')


@router.post('/change-password')
def change_password(body: ChangePasswordRequest, current_user=Depends(get_current_user)):
    """修改用户密码"""
    if not body.new_password:
        raise HTTPException(status_code=400, detail='新密码不能为空')
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail='密码长度不能少于6位')

    try:
        current_user.set_password(body.new_password)
        db.session.commit()
        return {'status': 'success', 'message': '密码修改成功'}
    except Exception as e:
        db.session.rollback()
        logger.error(f"修改密码失败: {str(e)}")
        raise HTTPException(status_code=500, detail='修改密码失败，请稍后再试')
