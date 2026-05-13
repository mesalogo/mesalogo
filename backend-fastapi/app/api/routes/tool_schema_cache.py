"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: tool_schema_cache.py
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
# Source: tool_schema_cache.py
# ============================================================

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
工具模式缓存API路由

本模块提供工具模式缓存的API接口，用于管理工具模式缓存。
"""

import logging
from app.services.tool_schema_cache import tool_schema_cache, ToolSchemaCache
from app.services.mcp_server_manager import mcp_manager

# 设置日志
logger = logging.getLogger(__name__)

# 创建蓝图

@router.get('/tool-schema-cache')
def get_all_cached_servers():
    """获取所有已缓存的服务器ID列表"""
    try:
        cached_servers = tool_schema_cache.get_all_server_ids()
        return {
            "status": "success",
            "cached_servers": cached_servers,
            "count": len(cached_servers)
        }
    except Exception as e:
        logger.error(f"获取缓存的服务器列表失败: {e}")
        raise HTTPException(status_code=500, detail={
            "status": "error",
            "message": f"获取缓存的服务器列表失败: {str(e)}"
        })

@router.get('/tool-schema-cache/{server_id}')
def get_server_tools(server_id):
    """获取指定服务器的工具模式缓存"""
    try:
        if not tool_schema_cache.has_tools(server_id):
            raise HTTPException(status_code=404, detail={
                "status": "error",
                "message": f"服务器 {server_id} 的工具模式未缓存"
            })
        
        tools = tool_schema_cache.get_tools(server_id)
        return {
            "status": "success",
            "server_id": server_id,
            "tools": tools,
            "count": ToolSchemaCache._count_tools(tools)
        }
    except Exception as e:
        logger.error(f"获取服务器 {server_id} 的工具模式缓存失败: {e}")
        raise HTTPException(status_code=500, detail={
            "status": "error",
            "message": f"获取服务器 {server_id} 的工具模式缓存失败: {str(e)}"
        })

@router.delete('/tool-schema-cache/{server_id}')
def remove_server_tools(server_id):
    """移除指定服务器的工具模式缓存"""
    try:
        if not tool_schema_cache.has_tools(server_id):
            raise HTTPException(status_code=404, detail={
                "status": "error",
                "message": f"服务器 {server_id} 的工具模式未缓存"
            })
        
        tool_schema_cache.remove_tools(server_id)
        return {
            "status": "success",
            "message": f"已移除服务器 {server_id} 的工具模式缓存"
        }
    except Exception as e:
        logger.error(f"移除服务器 {server_id} 的工具模式缓存失败: {e}")
        raise HTTPException(status_code=500, detail={
            "status": "error",
            "message": f"移除服务器 {server_id} 的工具模式缓存失败: {str(e)}"
        })

@router.delete('/tool-schema-cache')
def clear_all_tools():
    """清空所有工具模式缓存"""
    try:
        tool_schema_cache.clear()
        return {
            "status": "success",
            "message": "已清空所有工具模式缓存"
        }
    except Exception as e:
        logger.error(f"清空所有工具模式缓存失败: {e}")
        raise HTTPException(status_code=500, detail={
            "status": "error",
            "message": f"清空所有工具模式缓存失败: {str(e)}"
        })

@router.post('/tool-schema-cache/{server_id}/refresh')
def refresh_server_tools(server_id):
    """刷新指定服务器的工具模式缓存"""
    try:
        # 使用新的refresh_tools函数刷新工具缓存
        tools = mcp_manager.refresh_tools(server_id)

        return {
            "status": "success",
            "message": f"已刷新服务器 {server_id} 的工具模式缓存",
            "tools": tools,
            "count": ToolSchemaCache._count_tools(tools)
        }
    except Exception as e:
        logger.error(f"刷新服务器 {server_id} 的工具模式缓存失败: {e}")
        raise HTTPException(status_code=500, detail={
            "status": "error",
            "message": f"刷新服务器 {server_id} 的工具模式缓存失败: {str(e)}"
        })

@router.post('/tool-schema-cache/refresh-all')
def refresh_all_tools():
    """刷新所有服务器的工具模式缓存"""
    try:
        # 获取所有服务器
        servers = mcp_manager.list_servers()

        # 清空缓存
        tool_schema_cache.clear()

        # 刷新每个服务器的工具模式缓存
        refreshed_servers = []
        for server in servers:
            server_id = server.get('id')
            try:
                tools = mcp_manager.refresh_tools(server_id)
                refreshed_servers.append(server_id)
            except Exception as e:
                logger.error(f"刷新服务器 {server_id} 的工具模式缓存失败: {e}")

        return {
            "status": "success",
            "message": f"已刷新 {len(refreshed_servers)} 个服务器的工具模式缓存",
            "refreshed_servers": refreshed_servers
        }
    except Exception as e:
        logger.error(f"刷新所有工具模式缓存失败: {e}")
        raise HTTPException(status_code=500, detail={
            "status": "error",
            "message": f"刷新所有工具模式缓存失败: {str(e)}"
        })

def register_blueprint(app):
    """注册工具模式缓存API蓝图到Flask应用"""
    app.register_blueprint(bp)
    logger.info("已注册工具模式缓存API路由")

