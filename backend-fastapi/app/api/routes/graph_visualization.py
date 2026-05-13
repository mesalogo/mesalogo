"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: graph_visualization.py
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
# Source: graph_visualization.py
# ============================================================

"""
图谱可视化API路由

提供图谱数据查询和可视化相关的API接口
直接连接Neo4j数据库获取Graphiti存储的图谱数据
"""

import asyncio
import json
from app.models import GraphEnhancement

# 创建蓝图


class GraphVisualizationService:
    """图谱可视化服务"""
    
    def __init__(self):
        self.neo4j_query = None
    
    async def _get_neo4j_client(self):
        """获取Neo4j客户端（用于图谱可视化）"""
        if self.neo4j_query is None:
            # 动态导入避免循环依赖
            from app.utils.direct_neo4j_query import DirectNeo4jQuery
            
            # 获取图谱增强配置
            config = GraphEnhancement.query.filter_by(framework='graphiti').first()
            if not config:
                raise Exception("未找到图谱增强配置")
            
            # 从配置创建Neo4j客户端，使用浏览器访问地址
            # use_browser_uri=True 表示使用 neo4j_browser_uri（宿主机可访问的地址）
            self.neo4j_query = DirectNeo4jQuery.from_config(
                {'framework_config': config.framework_config or {}},
                use_browser_uri=True  # 关键：使用前端可访问的地址
            )
            
            logger.info(f"图谱可视化使用 Neo4j 地址: {self.neo4j_query.uri}")
            await self.neo4j_query.connect()
        
        return self.neo4j_query
    
    async def get_graph_data(self, group_id=None):
        """获取图谱数据"""
        try:
            client = await self._get_neo4j_client()
            return await client.get_graph_data(group_id)
        except Exception as e:
            logger.error(f"获取图谱数据失败: {e}")
            raise
    
    async def get_database_info(self):
        """获取数据库信息"""
        try:
            client = await self._get_neo4j_client()
            return await client.get_database_info()
        except Exception as e:
            logger.error(f"获取数据库信息失败: {e}")
            raise
    
    async def get_entities(self, group_id=None):
        """获取实体列表"""
        try:
            client = await self._get_neo4j_client()
            return await client.get_all_entities(group_id)
        except Exception as e:
            logger.error(f"获取实体列表失败: {e}")
            raise
    
    async def get_relationships(self, group_id=None):
        """获取关系列表"""
        try:
            client = await self._get_neo4j_client()
            return await client.get_all_relationships(group_id)
        except Exception as e:
            logger.error(f"获取关系列表失败: {e}")
            raise


# 创建服务实例
graph_viz_service = GraphVisualizationService()


def run_async(coro):
    """运行异步函数的辅助函数"""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    return loop.run_until_complete(coro)


@router.get('/graph-visualization/data')
def get_graph_visualization_data(request: Request, current_user=Depends(get_current_user)):
    """获取图谱可视化数据"""
    try:
        # 获取查询参数
        group_id = request.query_params.get('group_id')
        
        # 检查图谱增强是否启用
        config = GraphEnhancement.query.filter_by(framework='graphiti').first()
        if not config or not config.enabled:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '图谱增强未启用，请先在设置中启用并配置'
            })
        
        # 异步获取图谱数据
        graph_data = run_async(graph_viz_service.get_graph_data(group_id))
        
        return {
            'success': True,
            'data': graph_data
        }
        
    except Exception as e:
        logger.error(f"获取图谱可视化数据失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取图谱数据失败: {str(e)}'
        }, status_code=500)


@router.get('/graph-visualization/info')
def get_graph_database_info(current_user=Depends(get_current_user)):
    """获取图谱数据库信息"""
    try:
        # 检查图谱增强是否启用
        config = GraphEnhancement.query.filter_by(framework='graphiti').first()
        if not config or not config.enabled:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '图谱增强未启用'
            })
        
        # 异步获取数据库信息
        db_info = run_async(graph_viz_service.get_database_info())
        
        return {
            'success': True,
            'data': db_info
        }
        
    except Exception as e:
        logger.error(f"获取图谱数据库信息失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取数据库信息失败: {str(e)}'
        }, status_code=500)


@router.get('/graph-visualization/entities')
def get_graph_entities(request: Request, current_user=Depends(get_current_user)):
    """获取图谱实体列表"""
    try:
        # 获取查询参数
        group_id = request.query_params.get('group_id')
        
        # 检查图谱增强是否启用
        config = GraphEnhancement.query.filter_by(framework='graphiti').first()
        if not config or not config.enabled:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '图谱增强未启用'
            })
        
        # 异步获取实体数据
        entities = run_async(graph_viz_service.get_entities(group_id))
        
        return {
            'success': True,
            'data': entities
        }
        
    except Exception as e:
        logger.error(f"获取图谱实体失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取实体数据失败: {str(e)}'
        }, status_code=500)


@router.get('/graph-visualization/relationships')
def get_graph_relationships(request: Request, current_user=Depends(get_current_user)):
    """获取图谱关系列表"""
    try:
        # 获取查询参数
        group_id = request.query_params.get('group_id')
        
        # 检查图谱增强是否启用
        config = GraphEnhancement.query.filter_by(framework='graphiti').first()
        if not config or not config.enabled:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '图谱增强未启用'
            })
        
        # 异步获取关系数据
        relationships = run_async(graph_viz_service.get_relationships(group_id))
        
        return {
            'success': True,
            'data': relationships
        }
        
    except Exception as e:
        logger.error(f"获取图谱关系失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取关系数据失败: {str(e)}'
        }, status_code=500)


@router.get('/graph-visualization/config')
def get_graph_visualization_config(current_user=Depends(get_current_user)):
    """获取图谱可视化配置信息"""
    try:
        config = GraphEnhancement.query.filter_by(framework='graphiti').first()
        if not config:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '未找到图谱增强配置'
            })
        
        framework_config = config.framework_config or {}
        
        # 返回可视化相关的配置信息（不包含敏感信息如密码）
        viz_config = {
            'enabled': config.enabled,
            'framework': config.framework,
            'name': config.name,
            'description': config.description,
            'database_type': framework_config.get('database_type', 'neo4j'),
            # 使用浏览器访问地址（宿主机可访问），而不是容器内地址
            'neo4j_uri': framework_config.get('neo4j_browser_uri', 'bolt://127.0.0.1:7687'),
            'neo4j_user': framework_config.get('neo4j_user', 'neo4j'),
            'database_name': framework_config.get('database_name', 'neo4j'),
            # 不返回密码等敏感信息
        }
        
        return {
            'success': True,
            'data': viz_config
        }
        
    except Exception as e:
        logger.error(f"获取图谱可视化配置失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取配置失败: {str(e)}'
        }, status_code=500)

