"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: lightrag.py
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
# Source: lightrag.py
# ============================================================

"""
LightRAG 知识库 API 路由

提供 LightRAG 容器化服务的配置管理和查询接口
"""
from datetime import datetime

from app.services.lightrag import LightRAGConfigService, LightRAGService

# 创建 Blueprint


def _get_service() -> LightRAGService:
    """获取 LightRAG 服务实例"""
    config = LightRAGConfigService.get_lightrag_config()
    service_url = LightRAGConfigService.DEFAULT_SERVICE_URL
    
    if config and config.framework_config:
        service_url = config.framework_config.get('service_url', service_url)
    
    return LightRAGService(service_url)


# ==================== 配置管理接口 ====================

@router.get('/lightrag/config')
def get_lightrag_config():
    """获取 LightRAG 配置"""
    try:
        config = LightRAGConfigService.get_or_create_config()
        
        return {
            'success': True,
            'data': {
                'id': config.id,
                'enabled': config.enabled,
                'framework': config.framework,
                'name': config.name,
                'description': config.description,
                'framework_config': config.framework_config or {},
                'created_at': config.created_at.isoformat() if config.created_at else None,
                'updated_at': config.updated_at.isoformat() if config.updated_at else None
            }
        }
        
    except Exception as e:
        logger.error(f"获取 LightRAG 配置失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取配置失败: {str(e)}'
        }, status_code=500)


@router.post('/lightrag/config')
async def update_lightrag_config(request: Request):
    """更新 LightRAG 配置并自动同步到容器"""
    try:
        data = await request.json()
        
        success, message = LightRAGConfigService.save_config(data)
        
        if success:
            config = LightRAGConfigService.get_lightrag_config()
            
            # 如果启用了 LightRAG，自动同步配置到容器
            sync_result = None
            if config.enabled:
                try:
                    env_path = LightRAGConfigService.generate_env_file()
                    logger.info(f"已生成配置文件: {env_path}")
                    
                    sync_success, sync_message = LightRAGConfigService.restart_lightrag_container()
                    sync_result = {
                        'synced': sync_success,
                        'message': sync_message
                    }
                except Exception as sync_error:
                    logger.error(f"同步配置到 LightRAG 失败: {sync_error}")
                    sync_result = {
                        'synced': False,
                        'message': str(sync_error)
                    }
            
            return {
                'success': True,
                'message': message,
                'data': {
                    'id': config.id,
                    'enabled': config.enabled,
                    'framework': config.framework
                },
                'sync_result': sync_result
            }
        else:
            raise HTTPException(status_code=500, detail={
                'success': False,
                'message': message
            })
            
    except Exception as e:
        logger.error(f"更新 LightRAG 配置失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'更新配置失败: {str(e)}'
        }, status_code=500)


# ==================== 服务状态接口 ====================

@router.get('/lightrag/status')
def get_lightrag_status():
    """获取 LightRAG 服务状态"""
    try:
        config = LightRAGConfigService.get_lightrag_config()
        
        if not config:
            return {
                'success': True,
                'data': {
                    'enabled': False,
                    'status': 'not_configured',
                    'message': 'LightRAG 尚未配置'
                }
            }
        
        if not config.enabled:
            return {
                'success': True,
                'data': {
                    'enabled': False,
                    'status': 'disabled',
                    'message': 'LightRAG 未启用'
                }
            }
        
        # 获取服务状态
        service = _get_service()
        status = service.get_status()
        
        return {
            'success': True,
            'data': {
                'enabled': True,
                'framework': 'lightrag',
                **status
            }
        }
        
    except Exception as e:
        logger.error(f"获取 LightRAG 状态失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取状态失败: {str(e)}'
        }, status_code=500)


@router.get('/lightrag/health')
def check_lightrag_health():
    """检查 LightRAG 服务健康状态"""
    try:
        service = _get_service()
        health_status = service.health_check()
        
        return health_status
        
    except Exception as e:
        logger.error(f"检查 LightRAG 健康状态失败: {e}")
        raise HTTPException(status_code=500, detail={
            'status': 'error',
            'error': str(e)
        })


# ==================== 配置同步接口 ====================

@router.post('/lightrag/sync')
def sync_lightrag_config():
    """同步配置到 LightRAG 容器（生成 .env 文件并重启容器）"""
    try:
        # 1. 生成新的 lightrag.env
        env_path = LightRAGConfigService.generate_env_file()
        logger.info(f"已生成配置文件: {env_path}")
        
        # 2. 重启 LightRAG 容器使配置生效
        success, message = LightRAGConfigService.restart_lightrag_container()
        
        if success:
            return {
                'success': True,
                'message': f'配置已同步到 {env_path} 并重启容器'
            }
        else:
            raise HTTPException(status_code=500, detail={
                'success': False,
                'error': message
            })
            
    except Exception as e:
        logger.error(f"同步 LightRAG 配置失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': str(e)
        })


# ==================== 服务控制接口 ====================

@router.post('/lightrag/service-control')
async def control_lightrag_service(request: Request):
    """控制 LightRAG 服务（启动/停止）"""
    try:
        data = await request.json()
        action = data.get('action')
        
        if action not in ['start', 'stop']:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'error': '无效的操作，只支持 start 或 stop'
            })
        
        if action == 'start':
            success, message = LightRAGConfigService.start_lightrag_container()
        else:
            success, message = LightRAGConfigService.stop_lightrag_container()
        
        if success:
            return {
                'success': True,
                'message': message
            }
        else:
            raise HTTPException(status_code=500, detail={
                'success': False,
                'error': message
            })
            
    except Exception as e:
        logger.error(f"控制 LightRAG 服务失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': str(e)
        })


# ==================== 查询接口 ====================

@router.post('/lightrag/query')
async def lightrag_query(request: Request):
    """执行 LightRAG 查询"""
    try:
        data = await request.json()
        
        query = data.get('query', '')
        if not query:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '查询内容不能为空'
            })
        
        config = LightRAGConfigService.get_lightrag_config()
        if not config or not config.enabled:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': 'LightRAG 未启用'
            })
        
        # 获取查询参数
        workspace = data.get('workspace', 'default')
        mode = data.get('mode', 'hybrid')
        top_k = data.get('top_k', 60)
        response_type = data.get('response_type', 'Multiple Paragraphs')
        
        # 执行查询
        service = _get_service()
        start_time = datetime.now()
        
        success, result = service.query(
            query=query,
            workspace=workspace,
            mode=mode,
            top_k=top_k,
            response_type=response_type
        )
        
        end_time = datetime.now()
        response_time = (end_time - start_time).total_seconds()
        
        if success:
            return {
                'success': True,
                'data': {
                    'query': query,
                    'result': result,
                    'response_time': response_time,
                    'query_params': {
                        'mode': mode,
                        'top_k': top_k,
                        'workspace': workspace
                    },
                    'framework': 'lightrag'
                }
            }
        else:
            return JSONResponse(content={
                'success': False,
                'message': f'查询失败: {result}'
            }, status_code=500)
            
    except Exception as e:
        logger.error(f"LightRAG 查询失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'查询失败: {str(e)}'
        }, status_code=500)


# ==================== 知识库管理接口 ====================

@router.get('/lightrag/workspaces')
def get_lightrag_workspaces():
    """获取所有知识库（workspace）列表"""
    try:
        service = _get_service()
        workspaces = service.get_workspaces()
        
        return {
            'success': True,
            'data': workspaces
        }
        
    except Exception as e:
        logger.error(f"获取工作空间列表失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取工作空间列表失败: {str(e)}'
        }, status_code=500)


@router.get('/lightrag/documents')
def get_lightrag_documents(request: Request):
    """获取指定工作空间的文档列表"""
    try:
        workspace = request.query_params.get('workspace', 'default')
        
        service = _get_service()
        documents = service.get_documents(workspace)
        
        return {
            'success': True,
            'data': documents
        }
        
    except Exception as e:
        logger.error(f"获取文档列表失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取文档列表失败: {str(e)}'
        }, status_code=500)


@router.post('/lightrag/documents')
async def upload_lightrag_document(request: Request):
    """上传文档到 LightRAG"""
    try:
        data = await request.json()
        
        content = data.get('content', '')
        if not content:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '文档内容不能为空'
            })
        
        workspace = data.get('workspace', 'default')
        filename = data.get('filename')
        
        service = _get_service()
        success, message = service.upload_document(
            content=content,
            workspace=workspace,
            filename=filename
        )
        
        if success:
            return {
                'success': True,
                'message': message
            }
        else:
            raise HTTPException(status_code=500, detail={
                'success': False,
                'message': message
            })
            
    except Exception as e:
        logger.error(f"上传文档失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'上传文档失败: {str(e)}'
        }, status_code=500)


@router.delete('/lightrag/documents/{document_id}')
def delete_lightrag_document(document_id, request: Request):
    """删除文档"""
    try:
        workspace = request.query_params.get('workspace', 'default')
        
        service = _get_service()
        success, message = service.delete_document(document_id, workspace)
        
        if success:
            return {
                'success': True,
                'message': message
            }
        else:
            raise HTTPException(status_code=500, detail={
                'success': False,
                'message': message
            })
            
    except Exception as e:
        logger.error(f"删除文档失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'删除文档失败: {str(e)}'
        }, status_code=500)


@router.post('/lightrag/clear')
async def clear_lightrag_workspace(request: Request):
    """清空工作空间数据"""
    try:
        data = await request.json()
        workspace = data.get('workspace', 'default')
        
        service = _get_service()
        success, message = service.clear_workspace(workspace)
        
        if success:
            return {
                'success': True,
                'message': message
            }
        else:
            raise HTTPException(status_code=500, detail={
                'success': False,
                'message': message
            })
            
    except Exception as e:
        logger.error(f"清空工作空间失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'清空工作空间失败: {str(e)}'
        }, status_code=500)


# ==================== 图谱可视化接口 ====================

@router.get('/lightrag/graph')
def get_lightrag_graph(request: Request):
    """获取知识图谱数据（用于可视化）"""
    try:
        workspace = request.query_params.get('workspace', 'default')
        limit = int(request.query_params.get('limit', 100))
        
        service = _get_service()
        success, data = service.get_graph_data(workspace, limit)
        
        if success:
            return {
                'success': True,
                'data': data
            }
        else:
            raise HTTPException(status_code=500, detail={
                'success': False,
                'message': data
            })
            
    except Exception as e:
        logger.error(f"获取图谱数据失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取图谱数据失败: {str(e)}'
        }, status_code=500)

