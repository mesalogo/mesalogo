"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: mcp_servers.py
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
# Source: mcp_servers.py
# ============================================================

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP服务器API路由

本模块定义MCP服务器的API路由，处理MCP服务器的请求，包括：
- 内部MCP服务器的请求处理
- 目前只包含变量MCP服务器的请求处理
"""

import json
import logging
from app.services.mcp_server_manager import mcp_manager
from app.mcp_servers.variables_server import get_tools, handle_request
from app.mcp_servers.knowledge_base_server import get_tools as get_kb_tools, handle_request as handle_kb_request
from app.mcp_servers.skill_server import get_tools as get_skill_tools, handle_request as handle_skill_request

# 设置日志
logger = logging.getLogger(__name__)

# 创建蓝图

@router.post('/variables')
async def mcp_variables(request: Request):
    """处理变量MCP服务器的请求"""
    try:
        # 检查是否是初始连接请求（空POST请求）
        body = await request.body()
        if not body:
            # 返回工具定义
            tools = get_tools()
            return JSONResponse(content=tools, status_code=200)
        
        # 解析工具调用请求
        try:
            request_data = await request.json()
        except:
            raise HTTPException(status_code=400, detail={
                "is_error": True,
                "error": "无效的JSON请求数据"
            })
        
        # 处理请求
        response = handle_request(request_data)
        
        return response
    
    except Exception as e:
        logger.error(f"处理MCP变量服务器请求时出错: {str(e)}")
        return JSONResponse(content={
            "is_error": True,
            "error": f"服务器错误: {str(e)}"
        }, status_code=500)

@router.post('/knowledge-base')
async def mcp_knowledge_base(request: Request):
    """处理知识库MCP服务器的请求"""
    try:
        # 检查是否是初始连接请求（空POST请求）
        body = await request.body()
        if not body:
            # 返回工具定义
            tools = get_kb_tools()
            return JSONResponse(content=tools, status_code=200)

        # 解析工具调用请求
        try:
            request_data = await request.json()
        except:
            raise HTTPException(status_code=400, detail={
                "is_error": True,
                "error": "无效的JSON请求数据"
            })

        # 处理请求
        response = handle_kb_request(request_data)

        return response

    except Exception as e:
        logger.error(f"处理MCP知识库服务器请求时出错: {str(e)}")
        return JSONResponse(content={
            "is_error": True,
            "error": f"服务器错误: {str(e)}"
        }, status_code=500)

@router.post('/skills')
async def mcp_skills(request: Request):
    """处理技能MCP服务器的请求"""
    try:
        body = await request.body()
        if not body:
            tools = get_skill_tools()
            return JSONResponse(content=tools, status_code=200)

        try:
            request_data = await request.json()
        except:
            raise HTTPException(status_code=400, detail={
                "is_error": True,
                "error": "无效的JSON请求数据"
            })

        response = handle_skill_request(request_data)
        return response

    except Exception as e:
        logger.error(f"处理MCP技能服务器请求时出错: {str(e)}")
        return JSONResponse(content={
            "is_error": True,
            "error": f"服务器错误: {str(e)}"
        }, status_code=500)

# ============================================================
# MCP 服务器管理路由 (原 mcp_server_manager._register_endpoints)
# 前端调用 /api/mcp/servers 系列
# ============================================================

@router.get('/mcp/servers')
def get_mcp_servers():
    """获取所有MCP服务器列表"""
    return mcp_manager.list_servers()


@router.get('/mcp/servers/config')
def get_mcp_config():
    """获取完整的MCP配置文件内容"""
    if not mcp_manager.servers_config:
        mcp_manager.load_config()
    return mcp_manager.servers_config


@router.post('/mcp/servers/config')
async def update_mcp_config(request: Request):
    """更新MCP配置文件"""
    try:
        data = await request.json()
        if not data or not data.get('config'):
            raise HTTPException(status_code=400, detail={"status": "error", "message": "缺少配置数据"})

        config = data.get('config')
        if not isinstance(config, dict) or 'mcpServers' not in config:
            raise HTTPException(status_code=400, detail={"status": "error", "message": "配置格式不正确，必须包含mcpServers对象"})

        mcp_manager.servers_config = config
        mcp_manager._save_config()
        mcp_manager.load_config()

        return {"status": "success", "message": "配置已保存，请手动启用/禁用服务器以应用更改"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新MCP配置失败: {e}")
        return JSONResponse(content={"status": "error", "message": f"更新配置失败: {str(e)}"}, status_code=500)


@router.get('/mcp/servers/{server_id}')
def get_mcp_server(server_id: str):
    """获取指定MCP服务器配置"""
    if not mcp_manager.servers_config:
        mcp_manager.load_config()

    server_config = mcp_manager.servers_config.get('mcpServers', {}).get(server_id)
    if not server_config:
        raise HTTPException(status_code=404, detail={"status": "error", "message": f"服务器 {server_id} 不存在"})

    is_enabled = server_config.get('enabled', False) or server_config.get('internal', False)
    is_running = server_id in mcp_manager.running_servers or server_config.get('internal', False)

    return {
        "id": server_id,
        "command": server_config.get('command'),
        "args": server_config.get('args', []),
        "description": server_config.get('description', ''),
        "internal": server_config.get('internal', False),
        "comm_type": server_config.get('comm_type', 'stdio'),
        "url": server_config.get('url'),
        "enabled": is_enabled,
        "running": is_running,
        "env": server_config.get('env', {}),
        "status": "running" if is_enabled else "stopped"
    }


@router.post('/mcp/servers')
async def add_mcp_server(request: Request):
    """添加新的MCP服务器配置"""
    data = await request.json()
    if not data or not data.get('id') or not data.get('config'):
        raise HTTPException(status_code=400, detail={"status": "error", "message": "缺少必要参数"})
    return mcp_manager.add_server(data['id'], data['config'])


@router.put('/mcp/servers/{server_id}')
async def update_mcp_server(server_id: str, request: Request):
    """更新MCP服务器配置"""
    data = await request.json()
    if not data:
        raise HTTPException(status_code=400, detail={"status": "error", "message": "缺少必要参数"})
    return mcp_manager.update_server(server_id, data)


@router.delete('/mcp/servers/{server_id}')
def delete_mcp_server(server_id: str):
    """删除MCP服务器配置"""
    return mcp_manager.delete_server(server_id)


@router.post('/mcp/servers/{server_id}/enable')
def enable_mcp_server(server_id: str):
    """启用MCP服务器"""
    return mcp_manager.enable_server(server_id)


@router.post('/mcp/servers/{server_id}/disable')
def disable_mcp_server(server_id: str):
    """禁用MCP服务器"""
    return mcp_manager.disable_server(server_id)


@router.post('/mcp/servers/{server_id}/start')
def start_mcp_server(server_id: str):
    """启动MCP服务器"""
    return mcp_manager.start_server(server_id)


@router.post('/mcp/servers/{server_id}/stop')
def stop_mcp_server(server_id: str):
    """停止MCP服务器"""
    return mcp_manager.stop_server(server_id)


@router.api_route('/mcp/tools/{server_id}', methods=['GET', 'POST'])
async def get_mcp_server_tools(server_id: str, request: Request):
    """获取MCP服务器提供的工具列表"""
    try:
        refresh = request.query_params.get('refresh', 'false').lower() == 'true'
        if request.method == 'POST':
            try:
                body = await request.json()
                if body and 'refresh' in body:
                    refresh = body['refresh']
            except Exception:
                pass

        server_config = mcp_manager.servers_config.get('mcpServers', {}).get(server_id)
        if server_config and server_config.get('internal', False):
            if server_id == 'variables-server':
                from app.mcp_servers.variables_server import get_tools
                return get_tools()
            elif server_id == 'knowledge-base':
                from app.mcp_servers.knowledge_base_server import get_tools
                return get_tools()
            elif server_id == 'planner-server':
                from app.mcp_servers.planner_server import get_tools_list
                return get_tools_list()
            elif server_id == 'skill-server':
                from app.mcp_servers.skill_server import get_tools as get_skill_tools_fn
                return get_skill_tools_fn()
            elif server_id == 'subagent-server':
                from app.mcp_servers.subagent_server import get_tools as get_subagent_tools
                return get_subagent_tools()
            else:
                raise HTTPException(status_code=400, detail={"error": f"不支持的内部服务器: {server_id}"})

        if refresh:
            tools = mcp_manager.refresh_tools(server_id)
        else:
            tools = mcp_manager.get_tools(server_id)

        return tools
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取服务器 {server_id} 的工具列表时出错: {str(e)}")
        return JSONResponse(content={"error": str(e)}, status_code=500)


@router.post('/mcp/call/{server_id}/{tool_name}')
async def call_mcp_tool(server_id: str, tool_name: str, request: Request):
    """调用MCP工具"""
    try:
        request_data = await request.json() or {}

        if isinstance(request_data, str):
            try:
                request_data = json.loads(request_data)
            except json.JSONDecodeError as e:
                raise HTTPException(status_code=400, detail={
                    "error": f"参数格式错误: {e}",
                    "is_error": True
                })

        if 'arguments' in request_data:
            params = request_data['arguments']
        else:
            params = request_data

        result = mcp_manager.call_tool(server_id, tool_name, params)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"调用工具 {server_id}/{tool_name} 时出错: {str(e)}")
        return JSONResponse(content={"error": str(e)}, status_code=500)
