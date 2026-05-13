"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: external_variables.py
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
# Source: external_variables.py
# ============================================================

from app.extensions import db
from app.models import ExternalEnvironmentVariable
from app.services.user_permission_service import UserPermissionService
from datetime import datetime
import json
import requests
import threading
import time
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@router.get('/external-variables')
def get_external_variables(current_user=Depends(get_current_user)):
    """获取所有外部环境变量（已应用多租户权限过滤）"""
    try:
        query = ExternalEnvironmentVariable.query
        
        # 应用权限过滤
        query = UserPermissionService.filter_viewable_resources(query, ExternalEnvironmentVariable, current_user)
        
        variables = query.all()
        result = []
        for var in variables:
            var_dict = var.to_dict()
            # 添加多租户字段
            var_dict['created_by'] = var.created_by
            var_dict['is_shared'] = var.is_shared
            result.append(var_dict)
        return result
    except Exception as e:
        logger.error(f"获取外部环境变量失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'获取外部环境变量失败: {str(e)}'})

@router.post('/external-variables')
async def create_external_variable(request: Request, current_user=Depends(get_current_user)):
    """创建外部环境变量"""
    try:
        data = await request.json()

        # 验证必填字段
        required_fields = ['name', 'label', 'api_url', 'api_method', 'data_type', 'sync_interval']
        for field in required_fields:
            if field not in data:
                raise HTTPException(status_code=400, detail={'error': f'缺少必填字段: {field}'})

        # 检查变量名是否已存在
        existing = ExternalEnvironmentVariable.query.filter_by(name=data['name']).first()
        if existing:
            raise HTTPException(status_code=400, detail={'error': '变量名已存在'})

        # 构建settings
        settings = {
            'api_headers': data.get('api_headers', '{}'),
            'data_path': data.get('data_path', ''),
            'data_type': data.get('data_type', 'string'),
            'timeout': data.get('timeout', 10),
            'description': data.get('description', '')
        }

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

        # 创建新变量
        variable = ExternalEnvironmentVariable(
            name=data['name'],
            label=data['label'],
            api_url=data['api_url'],
            api_method=data['api_method'],
            sync_interval=data['sync_interval'],
            sync_enabled=data.get('sync_enabled', True),
            settings=settings,
            status='inactive',
            created_by=created_by,
            is_shared=is_shared
        )

        db.session.add(variable)
        db.session.commit()

        logger.info(f"创建外部环境变量成功: {variable.name}")
        return JSONResponse(content=variable.to_dict(), status_code=201)

    except Exception as e:
        db.session.rollback()
        logger.error(f"创建外部环境变量失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'创建外部环境变量失败: {str(e)}'})

@router.put('/external-variables/{variable_id}')
async def update_external_variable(variable_id, request: Request, current_user=Depends(get_current_user)):
    """更新外部环境变量"""
    try:
        variable = ExternalEnvironmentVariable.query.get(variable_id)
        if not variable:
            raise HTTPException(status_code=404, detail={'error': '外部环境变量未找到'})

        # 检查编辑权限
        if not UserPermissionService.can_edit_resource(current_user, variable):
            raise HTTPException(status_code=403, detail={'error': '无权限编辑此外部环境变量'})

        data = await request.json()

        # 检查变量名是否与其他变量冲突
        if 'name' in data and data['name'] != variable.name:
            existing = ExternalEnvironmentVariable.query.filter_by(name=data['name']).first()
            if existing:
                raise HTTPException(status_code=400, detail={'error': '变量名已存在'})

        # 更新基本字段
        if 'name' in data:
            variable.name = data['name']
        if 'label' in data:
            variable.label = data['label']
        if 'api_url' in data:
            variable.api_url = data['api_url']
        if 'api_method' in data:
            variable.api_method = data['api_method']
        if 'sync_interval' in data:
            variable.sync_interval = data['sync_interval']
        if 'sync_enabled' in data:
            variable.sync_enabled = data['sync_enabled']

        # 更新settings
        if not variable.settings:
            variable.settings = {}

        # 创建settings的副本以确保SQLAlchemy检测到变化
        settings_copy = variable.settings.copy()
        settings_fields = ['api_headers', 'data_path', 'data_type', 'timeout', 'description']
        settings_updated = False

        for field in settings_fields:
            if field in data:
                settings_copy[field] = data[field]
                settings_updated = True

        # 如果settings有更新，重新赋值以触发SQLAlchemy的变更检测
        if settings_updated:
            variable.settings = settings_copy

        # 只有创建者可以修改 is_shared 状态
        if 'is_shared' in data and UserPermissionService.can_share_resource(current_user, variable):
            variable.is_shared = data['is_shared']

        variable.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"更新外部环境变量成功: {variable.name}")
        return variable.to_dict()

    except Exception as e:
        db.session.rollback()
        logger.error(f"更新外部环境变量失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'更新外部环境变量失败: {str(e)}'})

@router.delete('/external-variables/{variable_id}')
def delete_external_variable(variable_id, current_user=Depends(get_current_user)):
    """删除外部环境变量"""
    try:
        variable = ExternalEnvironmentVariable.query.get(variable_id)
        if not variable:
            raise HTTPException(status_code=404, detail={'error': '外部环境变量未找到'})

        # 检查删除权限
        if not UserPermissionService.can_delete_resource(current_user, variable):
            raise HTTPException(status_code=403, detail={'error': '无权限删除此外部环境变量'})

        variable_name = variable.name
        db.session.delete(variable)
        db.session.commit()

        logger.info(f"删除外部环境变量成功: {variable_name}")
        return {'message': '删除成功'}

    except Exception as e:
        db.session.rollback()
        logger.error(f"删除外部环境变量失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'删除外部环境变量失败: {str(e)}'})

@router.post('/external-variables/{variable_id}/sync')
def manual_sync_variable(variable_id, current_user=Depends(get_current_user)):
    """手动同步外部环境变量"""
    try:
        variable = ExternalEnvironmentVariable.query.get(variable_id)
        if not variable:
            raise HTTPException(status_code=404, detail={'error': '外部环境变量未找到'})

        # 检查查看权限（同步操作需要至少有查看权限）
        if not UserPermissionService.can_view_resource(current_user, variable):
            raise HTTPException(status_code=403, detail={'error': '无权限操作此外部环境变量'})

        # 执行同步
        success, error_msg = sync_external_variable(variable)

        if success:
            return {
                'message': '同步成功',
                'value': variable.value,
                'last_sync': variable.last_sync.isoformat() if variable.last_sync else None
            }
        else:
            raise HTTPException(status_code=500, detail={'error': f'同步失败: {error_msg}'})

    except Exception as e:
        logger.error(f"手动同步外部环境变量失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'手动同步失败: {str(e)}'})

def extract_value_from_response(response_data, data_path):
    """从响应数据中根据路径提取值"""
    if not data_path:
        return response_data

    try:
        # 解析路径，支持点号分隔和数组索引
        current = response_data
        parts = data_path.split('.')

        for part in parts:
            # 处理数组索引，如 items[0]
            if '[' in part and ']' in part:
                key = part.split('[')[0]
                index = int(part.split('[')[1].split(']')[0])
                current = current[key][index]
            else:
                current = current[part]

        return current
    except (KeyError, IndexError, TypeError, ValueError) as e:
        logger.error(f"数据路径解析失败: {data_path}, 错误: {str(e)}")
        return None

def sync_external_variable(variable):
    """同步单个外部环境变量"""
    try:
        # 准备请求头
        headers = {}
        if variable.settings and variable.settings.get('api_headers'):
            try:
                headers = json.loads(variable.settings['api_headers'])
            except json.JSONDecodeError:
                logger.warning(f"变量 {variable.name} 的请求头格式错误")

        # 获取超时设置
        timeout = 10
        if variable.settings and variable.settings.get('timeout'):
            timeout = variable.settings['timeout']

        # 发起API请求
        response = requests.request(
            method=variable.api_method,
            url=variable.api_url,
            headers=headers,
            timeout=timeout
        )
        response.raise_for_status()

        # 解析响应
        response_data = response.json()

        # 根据数据路径提取值
        data_path = variable.settings.get('data_path', '') if variable.settings else ''
        extracted_value = extract_value_from_response(response_data, data_path)

        if extracted_value is not None:
            # 更新变量
            variable.value = str(extracted_value)
            variable.last_sync = datetime.utcnow()
            variable.status = 'active'
            variable.last_error = None

            db.session.commit()
            logger.info(f"同步变量 {variable.name} 成功: {extracted_value}")
            return True, None
        else:
            error_msg = f"无法从响应中提取数据，路径: {data_path}"
            variable.last_error = error_msg
            variable.status = 'error'
            db.session.commit()
            return False, error_msg

    except requests.exceptions.RequestException as e:
        error_msg = f"API请求失败: {str(e)}"
        variable.last_error = error_msg
        variable.status = 'error'
        db.session.commit()
        logger.error(f"同步变量 {variable.name} 失败: {error_msg}")
        return False, error_msg
    except Exception as e:
        error_msg = f"同步过程出错: {str(e)}"
        variable.last_error = error_msg
        variable.status = 'error'
        db.session.commit()
        logger.error(f"同步变量 {variable.name} 失败: {error_msg}")
        return False, error_msg

