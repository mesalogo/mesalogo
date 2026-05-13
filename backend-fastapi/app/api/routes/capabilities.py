"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: capabilities.py
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
# Source: capabilities.py
# ============================================================

from app.models import Capability, RoleCapability, Role
from app.extensions import db
from sqlalchemy.exc import SQLAlchemyError
import logging
import json
from app.services.user_permission_service import UserPermissionService

logger = logging.getLogger(__name__)

@router.get('/capabilities')
def get_capabilities(current_user=Depends(get_current_user)):
    """获取所有能力列表（已应用多租户权限过滤）"""
    try:
        # 获取当前用户
        # 应用权限过滤
        query = Capability.query
        query = UserPermissionService.filter_viewable_resources(query, Capability, current_user)
        capabilities = query.all()
        result = []
        for capability in capabilities:
            capability_data = {
                'id': capability.id,
                'name': capability.name,
                'description': capability.description,
                'type': capability.type,
                'provider': capability.provider,
                'parameters': capability.parameters,
                'response_format': capability.response_format,
                'examples': capability.examples,
                'settings': capability.settings,
                'security_level': capability.security_level,
                'default_enabled': capability.default_enabled,
                'tools': capability.tools,
                'icon': capability.icon,
                'created_at': capability.created_at.isoformat() if capability.created_at else None,
                'updated_at': capability.updated_at.isoformat() if capability.updated_at else None,
                # 多租户字段
                'created_by': capability.created_by,
                'is_shared': capability.is_shared
            }
            result.append(capability_data)
        return JSONResponse(content={'status': 'success', 'data': result}, status_code=200)
    except Exception as e:
        logger.error(f"获取能力列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': f'获取能力列表失败: {str(e)}'})

@router.get('/capabilities/categories')
def get_categories():
    """获取能力分类列表"""
    try:
        # 从能力表中提取所有不同的类型作为分类
        capability_types = db.session.query(Capability.type).distinct().all()
        categories = [{"id": i+1, "name": cat[0]} for i, cat in enumerate(capability_types) if cat[0]]
        
        # 添加默认分类
        default_categories = [
            {"id": len(categories)+1, "name": "core"},
            {"id": len(categories)+2, "name": "advanced"},
            {"id": len(categories)+3, "name": "supervision"},
            {"id": len(categories)+4, "name": "execution"},
            {"id": len(categories)+5, "name": "specialized"}
        ]
        
        # 过滤已存在的分类，避免重复
        existing_types = [cat["name"] for cat in categories]
        for cat in default_categories:
            if cat["name"] not in existing_types:
                categories.append(cat)
                
        return JSONResponse(content=categories, status_code=200)
    except Exception as e:
        logger.error(f"获取能力分类列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail={"error": f"获取能力分类失败: {str(e)}"})

@router.get('/capabilities/tools')
def get_capability_tools():
    """获取所有能力的工具关联关系"""
    try:
        capabilities = Capability.query.all()
        capability_tools_map = {}
        
        for capability in capabilities:
            if capability.tools:
                # 如果tools字段已包含JSON数据，直接使用
                capability_tools_map[capability.name] = capability.tools
            else:
                # 如果tools字段为空，设置为空字典
                capability_tools_map[capability.name] = {}
        
        return JSONResponse(content=capability_tools_map, status_code=200)
    except Exception as e:
        logger.error(f"获取能力工具关联关系失败: {str(e)}")
        raise HTTPException(status_code=500, detail={"error": f"获取能力工具关联关系失败: {str(e)}"})

@router.get('/capabilities/with_roles')
def get_capabilities_with_roles():
    """获取所有能力及其关联角色的信息"""
    try:
        capabilities = Capability.query.all()
        result = {}
        
        for capability in capabilities:
            # 获取使用该能力的角色列表
            role_capabilities = RoleCapability.query.filter_by(capability_id=capability.id).all()
            roles = []
            for rc in role_capabilities:
                role = Role.query.get(rc.role_id)
                if role:
                    roles.append({
                        'id': role.id,
                        'name': role.name
                    })
            
            # 将能力名称与角色列表建立映射关系
            result[capability.name] = roles
        
        return JSONResponse(content=result, status_code=200)
    except Exception as e:
        logger.error(f"获取能力-角色映射关系失败: {str(e)}")
        raise HTTPException(status_code=500, detail={"error": f"获取能力-角色映射关系失败: {str(e)}"})

@router.get('/capabilities/{capability_id}')
def get_capability(capability_id, current_user=Depends(get_current_user)):
    """获取特定能力详情"""
    try:
        # 获取当前用户
        capability = Capability.query.get(capability_id)
        if not capability:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '能力不存在'})

        # 检查查看权限
        if not UserPermissionService.can_view_resource(current_user, capability):
            raise HTTPException(status_code=403, detail={'status': 'error', 'message': '无权限查看此能力'})
        
        # 获取使用该能力的角色列表
        role_capabilities = RoleCapability.query.filter_by(capability_id=capability_id).all()
        roles = []
        for rc in role_capabilities:
            role = Role.query.get(rc.role_id)
            if role:
                roles.append({
                    'id': role.id,
                    'name': role.name
                })
        
        capability_data = {
            'id': capability.id,
            'name': capability.name,
            'description': capability.description,
            'type': capability.type,
            'provider': capability.provider,
            'parameters': capability.parameters,
            'response_format': capability.response_format,
            'examples': capability.examples,
            'settings': capability.settings,
            'security_level': capability.security_level,
            'default_enabled': capability.default_enabled,
            'tools': capability.tools,
            'icon': capability.icon,
            'roles': roles,
            'created_at': capability.created_at.isoformat() if capability.created_at else None,
            'updated_at': capability.updated_at.isoformat() if capability.updated_at else None,
            # 多租户字段
            'created_by': capability.created_by,
            'is_shared': capability.is_shared
        }
        return JSONResponse(content={'status': 'success', 'data': capability_data}, status_code=200)
    except Exception as e:
        logger.error(f"获取能力详情失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': f'获取能力详情失败: {str(e)}'})

@router.post('/capabilities')
async def create_capability(request: Request, current_user=Depends(get_current_user)):
    """创建新能力"""
    try:
        # 获取当前用户
        data = await request.json()

        # 验证必填字段
        if not data.get('name'):
            raise HTTPException(status_code=400, detail={'status': 'error', 'message': '缺少必填字段: name'})

        # 检查名称是否重复
        existing = Capability.query.filter_by(name=data['name']).first()
        if existing:
            raise HTTPException(status_code=400, detail={'status': 'error', 'message': '能力名称已存在'})

        # 设置多租户字段
        created_by = None
        is_shared = False

        if current_user:
            if current_user.is_admin:
                # 超级管理员可以选择创建系统资源或私有资源
                created_by = data.get('created_by', None)  # None = 系统资源
                is_shared = data.get('is_shared', True if created_by is None else False)
            else:
                # 普通用户创建的资源
                created_by = current_user.id
                is_shared = data.get('is_shared', False)  # 默认私有，可勾选共享

        new_capability = Capability(
            name=data['name'],
            description=data.get('description', ''),
            type=data.get('type', ''),
            provider=data.get('provider', ''),
            parameters=data.get('parameters', {}),
            response_format=data.get('response_format', {}),
            examples=data.get('examples', []),
            settings=data.get('settings', {}),
            security_level=data.get('security_level', 1),
            default_enabled=data.get('default_enabled', False),
            icon=data.get('icon', ''),
            # 多租户字段
            created_by=created_by,
            is_shared=is_shared
        )
        
        db.session.add(new_capability)
        db.session.commit()
        
        return JSONResponse(content={
            'status': 'success',
            'message': '能力创建成功',
            'data': {
                'id': new_capability.id,
                'name': new_capability.name
            }
        }, status_code=201)
    except Exception as e:
        db.session.rollback()
        logger.error(f"创建能力失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': f'创建能力失败: {str(e)}'})

@router.put('/capabilities/{capability_id}')
async def update_capability(capability_id, request: Request, current_user=Depends(get_current_user)):
    """更新能力信息"""
    try:
        # 获取当前用户
        capability = Capability.query.get(capability_id)
        if not capability:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '能力不存在'})

        # 检查编辑权限
        if not UserPermissionService.can_edit_resource(current_user, capability):
            raise HTTPException(status_code=403, detail={'status': 'error', 'message': '无权限编辑此能力'})
        
        data = await request.json()
        
        # 检查名称是否重复（如果更改了名称）
        if 'name' in data and data['name'] != capability.name:
            existing = Capability.query.filter_by(name=data['name']).first()
            if existing:
                raise HTTPException(status_code=400, detail={'status': 'error', 'message': '能力名称已存在'})
            capability.name = data['name']
        
        # 更新其他字段
        if 'description' in data:
            capability.description = data['description']
        if 'type' in data:
            capability.type = data['type']
        if 'provider' in data:
            capability.provider = data['provider']
        if 'parameters' in data:
            capability.parameters = data['parameters']
        if 'response_format' in data:
            capability.response_format = data['response_format']
        if 'examples' in data:
            capability.examples = data['examples']
        if 'settings' in data:
            capability.settings = data['settings']
        if 'security_level' in data:
            capability.security_level = data['security_level']
        if 'default_enabled' in data:
            capability.default_enabled = data['default_enabled']
        if 'icon' in data:
            capability.icon = data['icon']

        # 只有创建者可以修改 is_shared 状态
        if 'is_shared' in data and UserPermissionService.can_share_resource(current_user, capability):
            capability.is_shared = data['is_shared']

        db.session.commit()
        
        return JSONResponse(content={
            'status': 'success',
            'message': '能力更新成功',
            'data': {
                'id': capability.id,
                'name': capability.name
            }
        }, status_code=200)
    except Exception as e:
        db.session.rollback()
        logger.error(f"更新能力失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': f'更新能力失败: {str(e)}'})

@router.delete('/capabilities/{capability_id}')
def delete_capability(capability_id, current_user=Depends(get_current_user)):
    """删除能力"""
    try:
        # 获取当前用户
        capability = Capability.query.get(capability_id)
        if not capability:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '能力不存在'})

        # 检查删除权限
        if not UserPermissionService.can_delete_resource(current_user, capability):
            raise HTTPException(status_code=403, detail={'status': 'error', 'message': '无权限删除此能力'})

        # 删除关联的角色能力关系
        RoleCapability.query.filter_by(capability_id=capability_id).delete()

        # 删除能力
        db.session.delete(capability)
        db.session.commit()
        
        return JSONResponse(content={
            'status': 'success',
            'message': '能力删除成功'
        }, status_code=200)
    except Exception as e:
        db.session.rollback()
        logger.error(f"删除能力失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': f'删除能力失败: {str(e)}'})

@router.get('/roles/{role_id}/capabilities')
def get_role_capabilities(role_id):
    """获取角色的能力列表"""
    try:
        role = Role.query.get(role_id)
        if not role:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '角色不存在'})
        
        role_capabilities = RoleCapability.query.filter_by(role_id=role_id).all()
        result = []
        
        for rc in role_capabilities:
            capability = Capability.query.get(rc.capability_id)
            if capability:
                capability_data = {
                    'id': capability.id,
                    'name': capability.name,
                    'description': capability.description,
                    'type': capability.type,
                    'provider': capability.provider
                }
                result.append(capability_data)
        
        return JSONResponse(content={'status': 'success', 'data': result}, status_code=200)
    except Exception as e:
        logger.error(f"获取角色能力列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': f'获取角色能力列表失败: {str(e)}'})

@router.post('/roles/{role_id}/capabilities/{capability_id}')
def add_capability_to_role(role_id, capability_id):
    """为角色添加能力"""
    try:
        role = Role.query.get(role_id)
        if not role:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '角色不存在'})
        
        capability = Capability.query.get(capability_id)
        if not capability:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '能力不存在'})
        
        # 检查是否已存在关联
        existing = RoleCapability.query.filter_by(role_id=role_id, capability_id=capability_id).first()
        if existing:
            raise HTTPException(status_code=400, detail={'status': 'error', 'message': '角色已拥有该能力'})
        
        # 创建关联
        role_capability = RoleCapability(role_id=role_id, capability_id=capability_id)
        db.session.add(role_capability)
        db.session.commit()
        
        return JSONResponse(content={
            'status': 'success',
            'message': '能力添加成功'
        }, status_code=201)
    except Exception as e:
        db.session.rollback()
        logger.error(f"为角色添加能力失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': f'为角色添加能力失败: {str(e)}'})

@router.delete('/roles/{role_id}/capabilities/{capability_id}')
def remove_capability_from_role(role_id, capability_id):
    """从角色移除能力"""
    try:
        role_capability = RoleCapability.query.filter_by(role_id=role_id, capability_id=capability_id).first()
        if not role_capability:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '角色未拥有该能力'})
        
        db.session.delete(role_capability)
        db.session.commit()
        
        return JSONResponse(content={
            'status': 'success',
            'message': '能力移除成功'
        }, status_code=200)
    except Exception as e:
        db.session.rollback()
        logger.error(f"从角色移除能力失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': f'从角色移除能力失败: {str(e)}'})

@router.post('/capabilities/categories')
async def add_category(request: Request):
    """添加新的能力分类"""
    try:
        data = await request.json()
        if not data or not data.get('name'):
            raise HTTPException(status_code=400, detail={"error": "分类名称不能为空"})
            
        category_name = data['name'].strip()
        
        # 这里我们不实际存储分类，因为能力的类型直接存储在能力记录中
        # 而是返回成功并通知前端已添加
        return JSONResponse(content={
            "id": 9999,  # 临时ID
            "name": category_name,
            "message": f"成功添加分类: {category_name}"
        }, status_code=201)
    except Exception as e:
        logger.error(f"添加能力分类失败: {str(e)}")
        raise HTTPException(status_code=500, detail={"error": f"添加能力分类失败: {str(e)}"})

@router.put('/capabilities/{capability_id}/tools')
async def update_capability_tools(capability_id, request: Request):
    """更新特定能力的工具关联关系"""
    try:
        capability = Capability.query.get(capability_id)
        if not capability:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '能力不存在'})
        
        data = await request.json()
        if not data or 'tools' not in data:
            raise HTTPException(status_code=400, detail={'status': 'error', 'message': '缺少工具关联数据'})
        
        # 更新工具关联
        capability.tools = data['tools']
        db.session.commit()
        
        return JSONResponse(content={
            'status': 'success',
            'message': '能力工具关联更新成功',
            'data': {
                'id': capability.id,
                'name': capability.name,
                'tools': capability.tools
            }
        }, status_code=200)
    except Exception as e:
        db.session.rollback()
        logger.error(f"更新能力工具关联失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': f'更新能力工具关联失败: {str(e)}'})
