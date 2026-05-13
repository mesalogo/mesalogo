#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP路由配置模块

该模块提供了MCP工具名称到路由URL的映射，使客户端代码能够根据工具类型选择正确的路由。
"""

import logging
from config import BACKEND_URL

# 设置日志
logger = logging.getLogger(__name__)

# 工具到路由URL的映射
MCP_TOOL_ROUTES = {
    # 环境变量工具
    'get_task_var': '/api/mcp/env-vars',
    'set_task_var': '/api/mcp/env-vars',
    'list_task_vars': '/api/mcp/env-vars',
    
    # 智能体变量工具
    'get_agent_var': '/api/mcp/agent-vars',
    'set_agent_var': '/api/mcp/agent-vars',
    'list_agent_vars': '/api/mcp/agent-vars'
}

def get_tool_url(tool_name, base_url=None):
    """
    根据工具名称获取对应的完整URL
    
    Args:
        tool_name: 工具名称
        base_url: 基础URL，默认使用配置的BACKEND_URL
        
    Returns:
        str: 工具的完整URL
    """
    if base_url is None:
        base_url = BACKEND_URL
        
    if tool_name in MCP_TOOL_ROUTES:
        route = MCP_TOOL_ROUTES[tool_name]
    else:
        # 对于未知工具，生成标准格式的路由
        # 将工具名转换为kebab-case (短横线分隔的小写形式)
        # 例如: searxng_web_search -> searxng-web-search
        route = f'/api/mcp/tools/{tool_name}'
        logger.info(f"未知的MCP工具: {tool_name}，生成路由: {route}")
    
    return f"{base_url.rstrip('/')}{route}" 