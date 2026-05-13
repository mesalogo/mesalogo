"""
工具定义构建模块

从 message_processor.py 抽离，负责构建和压缩工具定义
"""
import logging
from typing import List, Dict, Any, Optional

from app.models import Role, RoleCapability, Capability
from app.services.mcp_server_manager import mcp_manager
from app.services.tool_schema_cache import tool_schema_cache

logger = logging.getLogger(__name__)


def compress_tool_definition(tool_def: Dict[str, Any]) -> Dict[str, Any]:
    """
    压缩工具定义以减少Token消耗
    
    压缩策略：
    1. 截断描述到80字符
    2. 只保留参数类型，移除描述和示例
    3. 保留required字段
    
    Args:
        tool_def: 原始工具定义
        
    Returns:
        Dict: 压缩后的工具定义
    """
    if not isinstance(tool_def, dict) or 'function' not in tool_def:
        return tool_def
    
    function = tool_def['function']
    compressed = {
        "type": "function",
        "function": {
            "name": function.get("name", ""),
            "description": function.get("description", "")[:80],
            "parameters": {
                "type": "object",
                "required": function.get("parameters", {}).get("required", []),
                "properties": {}
            }
        }
    }
    
    # 只保留类型信息，移除详细描述和示例
    original_props = function.get("parameters", {}).get("properties", {})
    for prop_name, prop_value in original_props.items():
        if isinstance(prop_value, dict):
            compressed["function"]["parameters"]["properties"][prop_name] = {
                "type": prop_value.get("type", "string")
            }
            # 如果有enum，保留enum（重要的约束信息）
            if "enum" in prop_value:
                compressed["function"]["parameters"]["properties"][prop_name]["enum"] = prop_value["enum"]
    
    return compressed


def build_tool_definitions(agent_role: Role, model_supports_function_calling: bool, compress_tools: bool = True) -> tuple:
    """
    构建角色的工具定义列表
    
    Args:
        agent_role: 角色对象
        model_supports_function_calling: 模型是否支持函数调用
        compress_tools: 是否压缩工具定义
        
    Returns:
        tuple: (tool_definitions, tool_names, role_capabilities)
            - tool_definitions: 工具定义列表（OpenAI格式）
            - tool_names: 工具名称列表
            - role_capabilities: 角色能力名称列表
    """
    role_capabilities = []
    tool_definitions = []
    tool_names = []
    tool_compression_count = 0
    
    if not agent_role:
        return tool_definitions, tool_names, role_capabilities
    
    # 查询角色的能力
    role_capability_relations = RoleCapability.query.filter_by(role_id=agent_role.id).all()
    
    for rc in role_capability_relations:
        capability = Capability.query.get(rc.capability_id)
        if not capability:
            continue
            
        role_capabilities.append(capability.name)
        
        # 只有当模型支持function_calling时，才继续解析工具
        if not capability.tools or not model_supports_function_calling:
            continue
            
        # 获取能力关联的工具
        for server_name, server_tools in capability.tools.items():
            if not isinstance(server_tools, list) or not server_tools:
                continue
                
            try:
                # 优先从缓存获取工具定义
                all_server_tools = None
                if tool_schema_cache.has_tools(server_name):
                    logger.debug(f"Getting tool definitions from cache for server {server_name}")
                    all_server_tools = tool_schema_cache.get_tools(server_name)
                else:
                    # If not in cache, get from server
                    logger.debug(f"No cache for server {server_name}, getting from server")
                    all_server_tools = mcp_manager.get_tools(server_name)
                    # Cache the tool definitions
                    if all_server_tools:
                        tool_schema_cache.set_tools(server_name, all_server_tools)
                
                # 确保工具列表存在
                tools_list = []
                if isinstance(all_server_tools, dict) and "tools" in all_server_tools:
                    tools_list = all_server_tools["tools"]
                elif isinstance(all_server_tools, list):
                    tools_list = all_server_tools
                
                # 根据角色能力中指定的工具名称筛选
                for tool in tools_list:
                    tool_name = None
                    
                    # 已经是标准格式
                    if isinstance(tool, dict) and "function" in tool and isinstance(tool["function"], dict) and "name" in tool["function"]:
                        tool_name = tool["function"]["name"]
                    # 直接包含name字段
                    elif isinstance(tool, dict) and "name" in tool:
                        tool_name = tool.get("name")
                        # Convert to standard format
                        if tool_name and tool_name in server_tools:
                            standardized_tool = {
                                "type": "function",
                                "function": {
                                    "name": tool_name,
                                    "description": tool.get("description", f"Tool: {tool_name}"),
                                    "parameters": tool.get("parameters", tool.get("inputSchema", {
                                        "type": "object",
                                        "properties": {},
                                        "required": []
                                    }))
                                }
                            }
                            if compress_tools:
                                standardized_tool = compress_tool_definition(standardized_tool)
                                tool_compression_count += 1
                            tool_definitions.append(standardized_tool)
                            tool_names.append(tool_name)
                            continue
                    
                    # 如果工具名在配置的tools列表中且已经是标准格式，直接添加
                    if tool_name and tool_name in server_tools:
                        if compress_tools:
                            tool = compress_tool_definition(tool)
                            tool_compression_count += 1
                        tool_definitions.append(tool)
                        tool_names.append(tool_name)
                        
            except Exception as e:
                logger.error(f"Failed to get tools from server {server_name}: {str(e)}")
    
    # 输出工具压缩统计信息
    if compress_tools and tool_compression_count > 0:
        logger.info(f"[Tool Definition Optimization] Compressed {tool_compression_count} tool definitions, estimated 70% token savings")
    
    # 注入技能工具（如果角色绑定了技能）
    if agent_role and model_supports_function_calling:
        skill_tools = _build_skill_tool_definitions(agent_role, compress_tools)
        for st in skill_tools:
            tool_definitions.append(st)
            if isinstance(st, dict) and "function" in st:
                tool_names.append(st["function"]["name"])
    
    return tool_definitions, tool_names, role_capabilities


def _build_skill_tool_definitions(agent_role: Role, compress_tools: bool = True) -> list:
    """为绑定了技能的角色注入 skill MCP 工具"""
    try:
        from app.services.skill_service import SkillService
        skill_service = SkillService()
        skills_metadata = skill_service.get_skill_metadata_for_prompt(agent_role.id)
        if not skills_metadata:
            return []

        from app.mcp_servers.skill_server import SKILL_TOOLS
        result = []
        for tool in SKILL_TOOLS:
            std_tool = {
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool["description"],
                    "parameters": tool.get("inputSchema", {"type": "object", "properties": {}, "required": []})
                }
            }
            if compress_tools:
                std_tool = compress_tool_definition(std_tool)
            result.append(std_tool)
        return result
    except Exception as e:
        logger.error(f"Failed to build skill tool definitions: {e}")
        return []
