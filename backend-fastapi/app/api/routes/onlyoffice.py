"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: onlyoffice.py
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from core.config import settings
from core.dependencies import get_current_user, get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================
# Source: onlyoffice.py
# ============================================================

"""
OnlyOffice Document Server集成API路由
"""
import os
import json
import jwt
import requests
import base64
from urllib.parse import unquote
from datetime import datetime, timedelta
import logging
from app.services.workspace_service import workspace_service

# 创建Blueprint

# 设置日志
logger = logging.getLogger(__name__)


def get_onlyoffice_config():
    """
    从数据库中获取OnlyOffice配置
    """
    try:
        from app.models import MarketApp
        app = MarketApp.query.filter_by(app_id='online-office').first()
        if app and app.config:
            server_config = app.config.get('server', {})
            return {
                'document_server_url': server_config.get('documentServerUrl', 'http://localhost:18080'),
                'backend_base_url': server_config.get('backendBaseUrl', 'http://host.docker.internal:8080'),
                'jwt_secret': server_config.get('jwtSecret', '')
            }
    except Exception as e:
        logger.warning(f"从数据库获取OnlyOffice配置失败: {e}")
    
    # 默认配置
    return {
        'document_server_url': os.environ.get('ONLYOFFICE_DOCUMENT_SERVER_URL', 'http://localhost:18080'),
        'backend_base_url': os.environ.get('ONLYOFFICE_BACKEND_BASE_URL', 'http://host.docker.internal:8080'),
        'jwt_secret': os.environ.get('ONLYOFFICE_JWT_SECRET', '')
    }

@router.get('/workspace-files/content')
def get_file_content(request: Request):
    """
    为OnlyOffice提供文件访问接口
    """
    try:
        file_path = request.query_params.get('path')
        if not file_path:
            raise HTTPException(status_code=400, detail={'error': '缺少文件路径参数'})

        # URL解码文件路径，处理中文文件名
        decoded_path = unquote(file_path)
        logger.info(f"请求文件路径: {file_path} -> 解码后: {decoded_path}")

        # 构建完整的文件路径
        # 工作空间文件在backend目录下的 agent-workspace 下
        backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
        workspace_root = os.path.join(backend_root, 'agent-workspace')

        # 处理文件路径，移除开头的斜杠
        clean_path = decoded_path.lstrip('/')
        full_path = os.path.join(workspace_root, clean_path)

        logger.info(f"完整文件路径: {full_path}")

        # 安全检查：确保文件路径在工作空间内
        full_path = os.path.abspath(full_path)
        workspace_root = os.path.abspath(workspace_root)

        if not full_path.startswith(workspace_root):
            logger.error(f"非法路径访问: {full_path} 不在 {workspace_root} 内")
            raise HTTPException(status_code=403, detail={'error': '非法的文件路径'})

        # 检查文件是否存在
        if not os.path.exists(full_path):
            logger.error(f"文件不存在: {full_path}")
            raise HTTPException(status_code=404, detail={'error': '文件不存在'})

        # 返回文件，指定正确的MIME类型
        return FileResponse(full_path)

    except Exception as e:
        logger.error(f"获取文件内容失败: {e}")
        raise HTTPException(status_code=500, detail={'error': '获取文件内容失败', 'message': str(e)})

@router.post('/onlyoffice/callback')
async def onlyoffice_callback(request: Request):
    """
    OnlyOffice回调接口，处理文件保存
    根据OnlyOffice官方文档实现正确的文件保存逻辑
    """
    try:
        # 获取回调数据
        callback_data = await request.json() or {}
        logger.info(f"OnlyOffice回调数据: {callback_data}")

        # 获取状态和关键信息
        status = callback_data.get('status')
        document_key = callback_data.get('key')
        download_url = callback_data.get('url')

        logger.info(f"文档状态: {status}, 文档key: {document_key}, 下载URL: {download_url}")

        # 状态2表示文档准备保存
        if status == 2:
            if not download_url:
                logger.error("回调数据中缺少下载URL")
                raise HTTPException(status_code=400, detail={'error': 1})

            # 从document_key中提取原始文件路径
            # document_key格式: "urlsafe_base64_encoded_path_timestamp"
            try:
                if '_' in document_key:
                    # 移除最后的时间戳部分
                    encoded_path = '_'.join(document_key.split('_')[:-1])
                    # URL-safe base64 解码
                    file_path = base64.urlsafe_b64decode(encoded_path).decode('utf-8')
                else:
                    logger.error(f"无法从document_key解析文件路径: {document_key}")
                    raise HTTPException(status_code=400, detail={'error': 1})
            except Exception as e:
                logger.error(f"解析document_key失败: {document_key}, 错误: {e}")
                raise HTTPException(status_code=400, detail={'error': 1})

            logger.info(f"准备保存文件到: {file_path}")

            # 从OnlyOffice下载编辑后的文件
            try:
                response = requests.get(download_url, timeout=30)
                response.raise_for_status()
                file_content = response.content
                logger.info(f"成功下载文件，大小: {len(file_content)} 字节")
            except Exception as e:
                logger.error(f"下载文件失败: {e}")
                raise HTTPException(status_code=500, detail={'error': 1})

            # 保存文件到workspace
            try:
                # 构建完整的文件路径
                backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
                workspace_root = os.path.join(backend_root, 'agent-workspace')
                clean_path = file_path.lstrip('/')
                full_path = os.path.join(workspace_root, clean_path)

                # 确保目录存在
                os.makedirs(os.path.dirname(full_path), exist_ok=True)

                # 写入文件
                with open(full_path, 'wb') as f:
                    f.write(file_content)

                logger.info(f"文件保存成功: {full_path}")

            except Exception as e:
                logger.error(f"保存文件失败: {e}")
                raise HTTPException(status_code=500, detail={'error': 1})

        # 返回成功响应
        return {'error': 0}

    except Exception as e:
        logger.error(f"OnlyOffice回调处理失败: {e}")
        raise HTTPException(status_code=500, detail={'error': 1})

@router.post('/onlyoffice/config')
async def generate_onlyoffice_config(request: Request):
    """
    生成OnlyOffice编辑器配置（包含JWT token）
    前端传入 file_path 和 file_name，后端返回完整配置
    """
    try:
        # 获取OnlyOffice配置
        oo_config = get_onlyoffice_config()
        
        data = await request.json()
        file_path = data.get('file_path')
        file_name = data.get('file_name')
        
        if not file_path or not file_name:
            raise HTTPException(status_code=400, detail={'error': '缺少必要参数'})
        
        # 获取文件类型
        file_ext = file_name.split('.')[-1].lower()
        
        # 支持的文件类型
        doc_types = {
            'docx': 'word', 'doc': 'word', 'odt': 'word', 'rtf': 'word', 'txt': 'word',
            'xlsx': 'cell', 'xls': 'cell', 'ods': 'cell', 'csv': 'cell',
            'pptx': 'slide', 'ppt': 'slide', 'odp': 'slide'
        }
        
        document_type = doc_types.get(file_ext)
        if not document_type:
            raise HTTPException(status_code=400, detail={'error': f'不支持的文件类型: {file_ext}'})
        
        # 生成文档key（使用 URL-safe base64 编码，替换特殊字符）
        encoded_path = base64.urlsafe_b64encode(file_path.encode()).decode()
        document_key = f"{encoded_path}_{int(datetime.now().timestamp())}"
        
        # 从配置获取后端地址（容器内访问宿主机用 host.docker.internal）
        backend_base_url = oo_config['backend_base_url']
        file_url = f"{backend_base_url}/api/workspace-files/content?path={file_path}"
        callback_url = f"{backend_base_url}/api/onlyoffice/callback"
        
        # 编辑器配置
        config = {
            "document": {
                "fileType": file_ext,
                "key": document_key,
                "title": file_name,
                "url": file_url
            },
            "documentType": document_type,
            "editorConfig": {
                "mode": "edit",
                "callbackUrl": callback_url,
                "user": {"id": "user1", "name": "User"},
                "customization": {
                    "autosave": False,
                    "forcesave": False,
                    "compactToolbar": False,
                    "feedback": False,
                    "help": False,
                    "about": False,
                    "chat": False,
                    "comments": False
                }
            },
            "width": "100%",
            "height": "1000px"
        }
        
        # 如果启用了JWT，生成token
        if oo_config['jwt_secret']:
            token = jwt.encode(config, oo_config['jwt_secret'], algorithm='HS256')
            config['token'] = token
        
        return {
            'success': True,
            'config': config,
            'documentServerUrl': oo_config['document_server_url']
        }
        
    except Exception as e:
        logger.error(f"生成OnlyOffice配置失败: {e}")
        raise HTTPException(status_code=500, detail={'error': '生成配置失败', 'message': str(e)})

