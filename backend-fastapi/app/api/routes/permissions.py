"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: permissions.py
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
# Source: permissions.py
# ============================================================

"""
权限管理API路由

处理角色和权限相关的API请求
"""
from app.models import UserRole, UserPermission, UserRoleAssignment, UserRolePermission
from app.extensions import db
from app.services.user_permission_service import UserPermissionService

# 创建Blueprint

@router.get('/user-roles')
def get_user_roles():
    """获取用户角色列表"""
    try:
        user_roles = UserRole.query.filter_by(is_active=True).all()
        return {
            'user_roles': [role.to_dict() for role in user_roles]
        }
    except Exception as e:
        logger.error(f"获取用户角色列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '获取用户角色列表失败'})

@router.post('/user-roles')
async def create_user_role(request: Request):
    """创建用户角色"""
    try:
        data = await request.json()
        if not data or not data.get('name') or not data.get('display_name'):
            raise HTTPException(status_code=400, detail={'error': '缺少必填字段'})

        # 检查角色名是否已存在
        existing = UserRole.query.filter_by(name=data['name']).first()
        if existing:
            raise HTTPException(status_code=400, detail={'error': '角色名已存在'})

        user_role = UserRole(
            name=data['name'],
            display_name=data['display_name'],
            description=data.get('description', ''),
            is_active=data.get('is_active', True)
        )

        db.session.add(user_role)
        db.session.commit()

        return JSONResponse(content={
            'message': '用户角色创建成功',
            'user_role': user_role.to_dict()
        }, status_code=201)

    except Exception as e:
        db.session.rollback()
        logger.error(f"创建用户角色失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '创建用户角色失败'})

@router.get('/user-permissions')
def get_user_permissions():
    """获取用户权限列表"""
    try:
        permissions = UserPermission.query.all()

        # 按类别分组
        grouped_permissions = {}
        for perm in permissions:
            category = perm.category
            if category not in grouped_permissions:
                grouped_permissions[category] = []
            grouped_permissions[category].append(perm.to_dict())

        return {
            'permissions': grouped_permissions,
            'all_permissions': [perm.to_dict() for perm in permissions]
        }
    except Exception as e:
        logger.error(f"获取用户权限列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '获取用户权限列表失败'})

@router.get('/user-roles/{user_role_id}/permissions')
def get_user_role_permissions(user_role_id):
    """获取用户角色的权限"""
    try:
        user_role = UserRole.query.get(user_role_id)
        if not user_role:
            raise HTTPException(status_code=404, detail={'error': '用户角色不存在'})

        role_permissions = db.session.query(UserPermission).join(
            UserRolePermission, UserPermission.id == UserRolePermission.user_permission_id
        ).filter(UserRolePermission.user_role_id == user_role_id).all()

        return {
            'user_role': user_role.to_dict(),
            'permissions': [perm.to_dict() for perm in role_permissions]
        }
    except Exception as e:
        logger.error(f"获取用户角色权限失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '获取用户角色权限失败'})

@router.post('/user-roles/{user_role_id}/permissions')
async def assign_permissions_to_user_role(user_role_id, request: Request):
    """为用户角色分配权限"""
    try:
        data = await request.json()
        if not data or 'permission_ids' not in data:
            raise HTTPException(status_code=400, detail={'error': '缺少权限ID列表'})

        user_role = UserRole.query.get(user_role_id)
        if not user_role:
            raise HTTPException(status_code=404, detail={'error': '用户角色不存在'})

        if user_role.is_system:
            raise HTTPException(status_code=400, detail={'error': '系统角色不可修改权限'})

        permission_ids = data['permission_ids']

        # 删除现有权限
        UserRolePermission.query.filter_by(user_role_id=user_role_id).delete()

        # 添加新权限
        for perm_id in permission_ids:
            permission = UserPermission.query.get(perm_id)
            if permission:
                role_perm = UserRolePermission(user_role_id=user_role_id, user_permission_id=perm_id)
                db.session.add(role_perm)

        db.session.commit()

        return {'message': '权限分配成功'}

    except Exception as e:
        db.session.rollback()
        logger.error(f"分配权限失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '分配权限失败'})

@router.get('/users/{user_id}/roles')
def get_user_assigned_roles(user_id):
    """获取用户分配的角色"""
    try:
        user_roles = UserPermissionService.get_user_roles_by_user_id(user_id)
        return {
            'user_id': user_id,
            'roles': user_roles
        }
    except Exception as e:
        logger.error(f"获取用户角色失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '获取用户角色失败'})

@router.post('/users/{user_id}/roles')
async def assign_role_to_user(user_id, request: Request, current_user=Depends(get_current_user)):
    """为用户分配角色"""
    try:
        data = await request.json()
        if not data or 'user_role_id' not in data:
            raise HTTPException(status_code=400, detail={'error': '缺少用户角色ID'})
        user_role_id = data['user_role_id']

        # 获取目标用户
        from app.models import User
        target_user = User.query.get(user_id)
        if not target_user:
            raise HTTPException(status_code=404, detail={'error': '用户不存在'})

        # 检查是否可以编辑用户角色
        if not UserPermissionService.can_edit_user_role(current_user, target_user):
            raise HTTPException(status_code=403, detail={'error': '不能修改该用户的角色'})

        success = UserPermissionService.assign_role_to_user(user_id, user_role_id, current_user.id)
        if success:
            return {'message': '角色分配成功'}
        else:
            raise HTTPException(status_code=500, detail={'error': '角色分配失败'})

    except Exception as e:
        logger.error(f"分配角色失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '分配角色失败'})

@router.delete('/users/{user_id}/roles/{user_role_id}')
def remove_role_from_user(user_id, user_role_id, current_user=Depends(get_current_user)):
    """移除用户的角色"""
    try:
        # 获取目标用户
        target_user = User.query.get(user_id)
        if not target_user:
            raise HTTPException(status_code=404, detail={'error': '用户不存在'})

        # 检查是否可以编辑用户角色
        if not UserPermissionService.can_edit_user_role(current_user, target_user):
            raise HTTPException(status_code=403, detail={'error': '不能修改该用户的角色'})

        success = UserPermissionService.remove_role_from_user(user_id, user_role_id)
        if success:
            return {'message': '角色移除成功'}
        else:
            raise HTTPException(status_code=500, detail={'error': '角色移除失败'})

    except Exception as e:
        logger.error(f"移除角色失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '移除角色失败'})

@router.get('/users/{user_id}/permissions')
def get_user_all_permissions(user_id):
    """获取用户的所有权限"""
    try:
        user = User.query.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail={'error': '用户不存在'})
        
        permissions = UserPermissionService.get_user_permissions(user)
        menu_permissions = UserPermissionService.get_menu_permissions(user)
        
        return {
            'user_id': user_id,
            'permissions': permissions,
            'menu_permissions': menu_permissions
        }
    except Exception as e:
        logger.error(f"获取用户权限失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '获取用户权限失败'})

@router.get('/current-user/permissions')
def get_current_user_permissions(current_user=Depends(get_current_user)):
    """获取当前用户的权限"""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail={'error': '未登录'})
        
        permissions = UserPermissionService.get_user_permissions(current_user)
        menu_permissions = UserPermissionService.get_menu_permissions(current_user)
        
        return {
            'permissions': permissions,
            'menu_permissions': menu_permissions,
            'is_admin': current_user.is_admin
        }
    except Exception as e:
        logger.error(f"获取当前用户权限失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '获取当前用户权限失败'})

@router.post('/initialize')
def initialize_permissions():
    """初始化默认权限和角色"""
    try:
        UserPermissionService.initialize_default_permissions()
        UserPermissionService.initialize_default_roles()
        UserPermissionService.initialize_default_role_permissions()

        return {'message': '权限系统初始化成功'}
    except Exception as e:
        logger.error(f"初始化权限系统失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '初始化权限系统失败'})

