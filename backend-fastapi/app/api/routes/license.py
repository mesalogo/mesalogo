"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: license.py
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends, UploadFile, File
from fastapi.responses import JSONResponse, StreamingResponse
from core.config import settings
from core.dependencies import get_current_user, get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================
# Source: license.py
# ============================================================

"""
许可证API路由

处理与系统许可证相关的所有API请求
"""
import json
from app.services.license_service import LicenseService

# 创建Blueprint

@router.get('/license')
def get_license():
    """获取当前许可证信息"""
    # 创建服务实例
    license_service = LicenseService()
    license_info = license_service.get_current_license()
    if not license_info:
        raise HTTPException(status_code=400, detail={
            'status': 'error',
            'message': '未找到有效的许可证',
            'code': 'LICENSE_EXPIRED'
        })

    return {
        'status': 'success',
        'data': license_info
    }

@router.get('/license/expired')
def get_expired_license():
    """获取过期的许可证信息（即使已过期也返回）"""
    # 创建服务实例
    license_service = LicenseService()
    license_info = license_service.get_license_data(include_expired=True)

    if not license_info:
        raise HTTPException(status_code=404, detail={
            'status': 'error',
            'message': '未找到任何许可证信息'
        })

    return {
        'status': 'success',
        'data': license_info
    }

@router.post('/license/activate')
async def activate_license(request: Request):
    """通过密钥激活许可证"""
    data = await request.json()
    license_key = data.get('license_key')

    if not license_key:
        raise HTTPException(status_code=400, detail={
            'status': 'error',
            'message': '缺少许可证密钥'
        })

    # 创建服务实例
    license_service = LicenseService()
    result = license_service.activate_license(license_key)

    if not result['success']:
        raise HTTPException(status_code=400, detail={
            'status': 'error',
            'message': result['message']
        })

    return {
        'status': 'success',
        'data': result['license']
    }

@router.post('/license/activate-file')
async def activate_license_file(license_file: UploadFile = File(...)):
    """通过文件激活许可证"""
    # 检查文件名
    if not license_file.filename or license_file.filename == '':
        raise HTTPException(status_code=400, detail={
            'status': 'error',
            'message': '未选择文件'
        })

    # 检查文件类型
    if not license_file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail={
            'status': 'error',
            'message': '许可证文件必须是JSON格式'
        })

    try:
        # 读取文件内容
        license_data = json.loads((await license_file.read()).decode('utf-8'))

        # 检查文件格式
        if 'license_key' not in license_data:
            raise HTTPException(status_code=400, detail={
                'status': 'error',
                'message': '无效的许可证文件格式'
            })

        # 创建服务实例并激活许可证
        license_service = LicenseService()
        result = license_service.activate_license(license_data['license_key'])

        if not result['success']:
            raise HTTPException(status_code=400, detail={
                'status': 'error',
                'message': result['message']
            })

        return {
            'status': 'success',
            'data': result['license']
        }
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail={
            'status': 'error',
            'message': '无效的JSON文件'
        })
    except Exception as e:
        logger.error(f"通过文件激活许可证失败: {e}")
        return JSONResponse(content={
            'status': 'error',
            'message': f'激活许可证失败: {str(e)}'
        }, status_code=500)

@router.get('/license/check-feature')
def check_feature(request: Request):
    """检查功能是否可用"""
    feature_name = request.query_params.get('feature')

    if not feature_name:
        raise HTTPException(status_code=400, detail={
            'status': 'error',
            'message': '缺少功能名称'
        })

    # 创建服务实例
    license_service = LicenseService()
    available = license_service.check_feature_availability(feature_name)

    return {
        'status': 'success',
        'data': {
            'feature': feature_name,
            'available': available
        }
    }

@router.get('/license/check-limit')
def check_limit(request: Request):
    """检查资源限制"""
    resource_type = request.query_params.get('resource')
    current_count = int(request.query_params.get('count', '0'))

    if not resource_type:
        raise HTTPException(status_code=400, detail={
            'status': 'error',
            'message': '缺少资源类型'
        })

    if resource_type not in ['agents', 'action_spaces', 'roles']:
        return JSONResponse(content={
            'status': 'error',
            'message': f'不支持的资源类型: {resource_type}'
        }, status_code=400)

    # 创建服务实例
    license_service = LicenseService()
    allowed = license_service.check_resource_limit(resource_type, current_count)

    return {
        'status': 'success',
        'data': {
            'resource': resource_type,
            'current_count': current_count,
            'allowed': allowed
        }
    }

@router.get('/license/system-key')
def get_system_key():
    """获取系统许可证密钥"""
    # 从系统设置中获取密钥
    from app.models import SystemSetting
    secret_key = SystemSetting.get('license_secret_key')

    if not secret_key:
        # 如果没有找到密钥，返回错误
        raise HTTPException(status_code=400, detail={
            'status': 'error',
            'message': '系统未配置许可证密钥'
        })

    # 返回密钥
    return {
        'status': 'success',
        'data': {
            'key': secret_key
        }
    }

