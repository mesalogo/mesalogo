"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: shared_environment_variables.py
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
# Source: shared_environment_variables.py
# ============================================================

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
共享环境变量API路由模块
提供共享环境变量的CRUD操作，支持在多个行动空间中绑定使用
"""

import json
import logging
from sqlalchemy.exc import SQLAlchemyError
from app.extensions import db
from app.models import SharedEnvironmentVariable, ActionSpaceSharedVariable, ActionSpace
from datetime import datetime
# werkzeug.exceptions 已移除，使用 FastAPI HTTPException
from typing import Dict, Any, List
import traceback

# 创建蓝图

# 设置日志
logger = logging.getLogger(__name__)

#---------- 共享环境变量CRUD API ----------#

@router.get('/shared-environment-variables')
def get_shared_variables():
    """获取所有共享环境变量"""
    try:
        variables = SharedEnvironmentVariable.query.all()
        result = []
        
        for var in variables:
            # 获取绑定的行动空间信息
            bindings = db.session.query(ActionSpaceSharedVariable, ActionSpace).join(
                ActionSpace, ActionSpaceSharedVariable.action_space_id == ActionSpace.id
            ).filter(ActionSpaceSharedVariable.shared_variable_id == var.id).all()

            bound_spaces = []
            for binding, space in bindings:
                bound_spaces.append({
                    'id': space.id,
                    'name': space.name
                })

            result.append({
                'id': var.id,
                'name': var.name,
                'label': var.label,
                'value': var.value,
                'description': var.description,
                'is_readonly': var.is_readonly,
                'binding_count': len(bound_spaces),  # 保持向后兼容
                'bound_spaces': bound_spaces,  # 新增绑定空间列表
                'created_at': var.created_at.isoformat() if var.created_at else None,
                'updated_at': var.updated_at.isoformat() if var.updated_at else None
            })
        
        return JSONResponse(content=result, status_code=200)
    except Exception as e:
        logger.error(f"获取共享环境变量失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'获取共享环境变量失败: {str(e)}'})

@router.post('/shared-environment-variables')
async def create_shared_variable(request: Request):
    """创建共享环境变量"""
    try:
        data = await request.json()
        
        # 验证必填字段
        required_fields = ['name', 'label', 'value']
        for field in required_fields:
            if field not in data:
                raise HTTPException(status_code=400, detail={'error': f'缺少必填字段: {field}'})
        
        # 检查变量名是否已存在
        existing = SharedEnvironmentVariable.query.filter_by(name=data['name']).first()
        if existing:
            raise HTTPException(status_code=400, detail={'error': '变量名已存在'})
        
        # 创建新的共享环境变量
        variable = SharedEnvironmentVariable(
            name=data['name'],
            label=data['label'],
            value=data['value'],
            description=data.get('description', ''),
            is_readonly=data.get('is_readonly', False)
        )
        
        db.session.add(variable)
        db.session.commit()
        
        logger.info(f"创建共享环境变量成功: {variable.name}")
        return JSONResponse(content={
            'id': variable.id,
            'name': variable.name,
            'label': variable.label,
            'value': variable.value,
            'description': variable.description,
            'is_readonly': variable.is_readonly,
            'binding_count': 0,
            'created_at': variable.created_at.isoformat() if variable.created_at else None,
            'updated_at': variable.updated_at.isoformat() if variable.updated_at else None
        }, status_code=201)
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"创建共享环境变量失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'创建共享环境变量失败: {str(e)}'})

@router.get('/shared-environment-variables/{variable_id}')
def get_shared_variable(variable_id):
    """获取特定的共享环境变量"""
    try:
        variable = SharedEnvironmentVariable.query.get(variable_id)
        if not variable:
            raise HTTPException(status_code=404, detail={'error': '共享环境变量未找到'})
        
        # 获取绑定的行动空间信息
        bindings = db.session.query(ActionSpaceSharedVariable, ActionSpace).join(
            ActionSpace, ActionSpaceSharedVariable.action_space_id == ActionSpace.id
        ).filter(ActionSpaceSharedVariable.shared_variable_id == variable_id).all()
        
        bound_spaces = []
        for binding, space in bindings:
            bound_spaces.append({
                'id': space.id,
                'name': space.name,
                'bound_at': binding.created_at.isoformat() if binding.created_at else None
            })
        
        return JSONResponse(content={
            'id': variable.id,
            'name': variable.name,
            'label': variable.label,
            'value': variable.value,
            'description': variable.description,
            'is_readonly': variable.is_readonly,
            'binding_count': len(bound_spaces),
            'bound_spaces': bound_spaces,
            'created_at': variable.created_at.isoformat() if variable.created_at else None,
            'updated_at': variable.updated_at.isoformat() if variable.updated_at else None
        }, status_code=200)
        
    except Exception as e:
        logger.error(f"获取共享环境变量失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'获取共享环境变量失败: {str(e)}'})

@router.put('/shared-environment-variables/{variable_id}')
async def update_shared_variable(variable_id, request: Request):
    """更新共享环境变量"""
    try:
        variable = SharedEnvironmentVariable.query.get(variable_id)
        if not variable:
            raise HTTPException(status_code=404, detail={'error': '共享环境变量未找到'})
        
        data = await request.json()
        
        # 如果要更新名称，检查是否与其他变量冲突
        if 'name' in data and data['name'] != variable.name:
            existing = SharedEnvironmentVariable.query.filter_by(name=data['name']).first()
            if existing:
                raise HTTPException(status_code=400, detail={'error': '变量名已存在'})
        
        # 更新字段
        if 'name' in data:
            variable.name = data['name']
        if 'label' in data:
            variable.label = data['label']
        if 'value' in data:
            variable.value = data['value']
        if 'description' in data:
            variable.description = data['description']
        if 'is_readonly' in data:
            variable.is_readonly = data['is_readonly']
        
        variable.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        logger.info(f"更新共享环境变量成功: {variable.name}")
        
        # 获取绑定数量
        binding_count = ActionSpaceSharedVariable.query.filter_by(shared_variable_id=variable.id).count()
        
        return JSONResponse(content={
            'id': variable.id,
            'name': variable.name,
            'label': variable.label,
            'value': variable.value,
            'description': variable.description,
            'is_readonly': variable.is_readonly,
            'binding_count': binding_count,
            'created_at': variable.created_at.isoformat() if variable.created_at else None,
            'updated_at': variable.updated_at.isoformat() if variable.updated_at else None
        }, status_code=200)
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"更新共享环境变量失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'更新共享环境变量失败: {str(e)}'})

@router.delete('/shared-environment-variables/{variable_id}')
def delete_shared_variable(variable_id):
    """删除共享环境变量"""
    try:
        variable = SharedEnvironmentVariable.query.get(variable_id)
        if not variable:
            raise HTTPException(status_code=404, detail={'error': '共享环境变量未找到'})
        
        # 检查是否有行动空间绑定了这个变量
        binding_count = ActionSpaceSharedVariable.query.filter_by(shared_variable_id=variable_id).count()
        if binding_count > 0:
            raise HTTPException(status_code=400, detail={'error': f'无法删除，该变量已被 {binding_count} 个行动空间绑定'})
        
        db.session.delete(variable)
        db.session.commit()
        
        logger.info(f"删除共享环境变量成功: {variable.name}")
        return JSONResponse(content={'message': '共享环境变量删除成功'}, status_code=200)
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"删除共享环境变量失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'删除共享环境变量失败: {str(e)}'})

#---------- 行动空间绑定管理API ----------#

@router.get('/action-spaces/{space_id}/shared-variables')
def get_action_space_shared_variables(space_id):
    """获取行动空间绑定的共享环境变量"""
    try:
        # 检查行动空间是否存在
        space = ActionSpace.query.get(space_id)
        if not space:
            raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})
        
        # 获取绑定的共享变量
        bindings = db.session.query(ActionSpaceSharedVariable, SharedEnvironmentVariable).join(
            SharedEnvironmentVariable, ActionSpaceSharedVariable.shared_variable_id == SharedEnvironmentVariable.id
        ).filter(ActionSpaceSharedVariable.action_space_id == space_id).all()
        
        result = []
        for binding, variable in bindings:
            result.append({
                'binding_id': binding.id,
                'variable_id': variable.id,
                'name': variable.name,
                'label': variable.label,
                'value': variable.value,
                'description': variable.description,
                'is_readonly': variable.is_readonly,
                'bound_at': binding.created_at.isoformat() if binding.created_at else None
            })
        
        return JSONResponse(content=result, status_code=200)
        
    except Exception as e:
        logger.error(f"获取行动空间共享变量失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'获取行动空间共享变量失败: {str(e)}'})

@router.post('/action-spaces/{space_id}/shared-variables/{variable_id}')
def bind_shared_variable_to_space(space_id, variable_id):
    """将共享环境变量绑定到行动空间"""
    try:
        # 检查行动空间是否存在
        space = ActionSpace.query.get(space_id)
        if not space:
            raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})
        
        # 检查共享变量是否存在
        variable = SharedEnvironmentVariable.query.get(variable_id)
        if not variable:
            raise HTTPException(status_code=404, detail={'error': '共享环境变量未找到'})
        
        # 检查是否已经绑定
        existing_binding = ActionSpaceSharedVariable.query.filter_by(
            action_space_id=space_id,
            shared_variable_id=variable_id
        ).first()
        
        if existing_binding:
            raise HTTPException(status_code=400, detail={'error': '该共享变量已绑定到此行动空间'})
        
        # 创建绑定关系
        binding = ActionSpaceSharedVariable(
            action_space_id=space_id,
            shared_variable_id=variable_id
        )
        
        db.session.add(binding)
        db.session.commit()
        
        logger.info(f"共享变量 {variable.name} 绑定到行动空间 {space.name} 成功")
        return JSONResponse(content={
            'binding_id': binding.id,
            'variable_id': variable.id,
            'name': variable.name,
            'label': variable.label,
            'value': variable.value,
            'description': variable.description,
            'is_readonly': variable.is_readonly,
            'bound_at': binding.created_at.isoformat() if binding.created_at else None
        }, status_code=201)
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"绑定共享变量失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'绑定共享变量失败: {str(e)}'})

@router.delete('/action-spaces/{space_id}/shared-variables/{variable_id}')
def unbind_shared_variable_from_space(space_id, variable_id):
    """解除共享环境变量与行动空间的绑定"""
    try:
        # 查找绑定关系
        binding = ActionSpaceSharedVariable.query.filter_by(
            action_space_id=space_id,
            shared_variable_id=variable_id
        ).first()
        
        if not binding:
            raise HTTPException(status_code=404, detail={'error': '绑定关系不存在'})
        
        db.session.delete(binding)
        db.session.commit()
        
        logger.info(f"解除共享变量绑定成功: space_id={space_id}, variable_id={variable_id}")
        return JSONResponse(content={'message': '解除绑定成功'}, status_code=200)
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"解除绑定失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'解除绑定失败: {str(e)}'})

