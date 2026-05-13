"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: memory_management.py
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
# Source: memory_management.py
# ============================================================

"""
记忆分区管理API路由

处理记忆分区的配置和数据管理，包括：
- 分区策略配置
- 分区列表查询
- 分区数据可视化
- 分区内容搜索
"""

from app.models import GraphEnhancement, db
from app.services.memory_partition_service import memory_partition_service

# 创建Blueprint


# ==================== 分区配置管理接口 ====================

@router.get('/memory/partition-config')
def get_partition_config():
    """获取记忆分区配置"""
    try:
        config = memory_partition_service.get_partition_config()
        
        return {
            'success': True,
            'data': config
        }
        
    except Exception as e:
        logger.error(f"获取分区配置失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取分区配置失败: {str(e)}'
        }, status_code=500)


@router.post('/memory/partition-config')
async def update_partition_config(request: Request):
    """更新记忆分区配置"""
    try:
        data = await request.json()
        
        # 验证必要字段
        if 'partition_strategy' not in data:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '缺少必要字段: partition_strategy'
            })
        
        # 更新配置
        success, message = memory_partition_service.update_partition_config(data)
        
        if success:
            return {
                'success': True,
                'message': message,
                'data': memory_partition_service.get_partition_config()
            }
        else:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': message
            })
            
    except Exception as e:
        logger.error(f"更新分区配置失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'更新分区配置失败: {str(e)}'
        }, status_code=500)


@router.get('/memory/partition-strategies')
def get_partition_strategies():
    """获取可用的分区策略列表"""
    try:
        strategies = memory_partition_service.get_available_strategies()
        
        return {
            'success': True,
            'data': strategies
        }
        
    except Exception as e:
        logger.error(f"获取分区策略失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取分区策略失败: {str(e)}'
        }, status_code=500)


# ==================== 分区数据管理接口 ====================

@router.get('/memory/partitions')
def list_memory_partitions():
    """获取所有可用的记忆分区列表"""
    try:
        partitions = memory_partition_service.list_partitions()
        
        return {
            'success': True,
            'data': partitions
        }
        
    except Exception as e:
        logger.error(f"获取分区列表失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取分区列表失败: {str(e)}'
        }, status_code=500)


@router.get('/memory/partition/{partition_id}/graph')
def get_partition_memory_graph(partition_id, request: Request):
    """获取指定分区的记忆图谱数据"""
    try:
        # 获取查询参数
        limit = int(request.query_params.get('limit', 100))
        node_types = request.query_params.getlist('node_types')
        
        graph_data = memory_partition_service.get_partition_graph(
            partition_id, 
            limit=limit,
            node_types=node_types
        )
        
        return {
            'success': True,
            'data': graph_data
        }
        
    except Exception as e:
        logger.error(f"获取分区图谱数据失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取分区图谱数据失败: {str(e)}'
        }, status_code=500)


@router.post('/memory/partition/{partition_id}/search')
async def search_partition_memory(partition_id, request: Request):
    """在指定分区中搜索记忆内容"""
    try:
        data = await request.json()
        
        query = data.get('query', '')
        if not query:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '搜索查询不能为空'
            })
        
        # 搜索参数
        search_params = {
            'limit': data.get('limit', 10),
            'node_types': data.get('node_types', []),
            'search_mode': data.get('search_mode', 'semantic')
        }
        
        results = memory_partition_service.search_partition(
            partition_id, 
            query, 
            **search_params
        )
        
        return {
            'success': True,
            'data': results
        }
        
    except Exception as e:
        logger.error(f"搜索分区记忆失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'搜索分区记忆失败: {str(e)}'
        }, status_code=500)


# ==================== 分区统计接口 ====================

@router.get('/memory/partition/{partition_id}/stats')
def get_partition_stats(partition_id):
    """获取分区统计信息"""
    try:
        stats = memory_partition_service.get_partition_stats(partition_id)
        
        return {
            'success': True,
            'data': stats
        }
        
    except Exception as e:
        logger.error(f"获取分区统计失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取分区统计失败: {str(e)}'
        }, status_code=500)


@router.get('/memory/overview')
def get_memory_overview():
    """获取记忆系统总览"""
    try:
        overview = memory_partition_service.get_memory_overview()
        
        return {
            'success': True,
            'data': overview
        }
        
    except Exception as e:
        logger.error(f"获取记忆系统总览失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取记忆系统总览失败: {str(e)}'
        }, status_code=500)


# ==================== 分区管理接口 ====================

@router.post('/memory/partition/{partition_id}/clear')
def clear_partition_memory(partition_id):
    """清空指定分区的记忆数据"""
    try:
        success, message = memory_partition_service.clear_partition(partition_id)
        
        return {
            'success': success,
            'message': message
        }
        
    except Exception as e:
        logger.error(f"清空分区记忆失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'清空分区记忆失败: {str(e)}'
        }, status_code=500)

