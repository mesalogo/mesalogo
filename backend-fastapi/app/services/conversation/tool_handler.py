"""
工具处理模块

提供解析和执行工具调用的功能

函数与关键变量说明:
---------------------------------------

工具调用解析:
* parse_tool_calls - 解析工具调用格式
  - content: 智能体回复内容

工具调用执行:
* execute_tool_call - 执行工具调用
  - tool_call: 工具调用信息
"""
import os
import re
import json
import logging
import uuid
import traceback
from typing import List, Dict, Any, Optional, Union
from app.services.thread_context import g

from app.services.mcp_server_manager import mcp_manager
from app.services.tool_schema_cache import tool_schema_cache
from app.services.memory_partition_service import memory_partition_service
from config import DEBUG_LLM_RESPONSE

logger = logging.getLogger(__name__)

def inject_partition_identifier(tool_name: str, arguments: dict, server_id: str) -> dict:
    """为图谱增强相关工具自动注入分区标识符"""
    try:
        # 检查是否是图谱增强相关的工具
        if server_id != 'graphiti-server':
            return arguments

        # 检查工具是否需要分区参数
        # group_id参数的工具
        group_id_tools = ['add_memory', 'get_episodes']
        # group_ids参数的工具（复数形式）
        group_ids_tools = ['search_memory_nodes', 'search_memory_facts']

        # 检查是否是需要分区参数的工具
        if tool_name not in group_id_tools and tool_name not in group_ids_tools:
            return arguments

        # 获取当前会话的上下文信息
        context = {}

        # 从Flask的g对象中获取会话上下文（如果可用）
        if hasattr(g, 'conversation_context'):
            context = g.conversation_context
        else:
            # 如果没有上下文，使用默认值
            context = {
                'action_space_id': 'default',
                'action_task_id': 'default',
                'role_id': 'default',
                'agent_id': 'default'
            }
            logger.warning(f"[Graphiti工具分区注入] 未找到会话上下文，使用默认值")

        # 获取分区配置
        partition_config = memory_partition_service.get_partition_config()
        strategy = partition_config.get('partition_strategy', 'by_space')

        # 生成分区标识符
        group_identifier = memory_partition_service.generate_partition_identifier(strategy, context)

        # 根据工具类型注入不同的参数
        if tool_name in group_id_tools:
            # 检查是否已经有group_id参数（LLM可能会自己传入错误的值）
            if 'group_id' in arguments:
                logger.warning(f"[Graphiti工具分区注入] 工具 {tool_name} 已有group_id参数: {arguments['group_id']}, 将被覆盖为: {group_identifier}")
            
            # 强制注入正确的 group_id（覆盖 LLM 传入的值）
            arguments['group_id'] = group_identifier
            logger.info(f"[Graphiti工具分区注入] 为工具 {tool_name} 注入group_id: {group_identifier} (策略: {strategy})")

        elif tool_name in group_ids_tools:
            # 检查是否已经有group_ids参数（LLM可能会自己传入错误的值）
            if 'group_ids' in arguments:
                logger.warning(f"[Graphiti工具分区注入] 工具 {tool_name} 已有group_ids参数: {arguments['group_ids']}, 将被覆盖为: [{group_identifier}]")
            
            # 强制注入正确的 group_ids（覆盖 LLM 传入的值）
            arguments['group_ids'] = [group_identifier]
            logger.info(f"[Graphiti工具分区注入] 为工具 {tool_name} 注入group_ids: [{group_identifier}] (策略: {strategy})")

        return arguments

    except Exception as e:
        logger.error(f"[Graphiti工具分区注入] 注入分区标识符失败: {e}")
        return arguments

def execute_tool_call(tool_call):
    """执行工具调用

    Args:
        tool_call: 工具调用信息

    Returns:
        str: 工具执行结果
    """
    try:
        # 获取工具名称和参数
        tool_name = tool_call['function']['name']
        arguments_str = tool_call['function']['arguments']
        # 确保工具调用始终有ID，如果没有则生成一个新ID
        if 'id' not in tool_call or not tool_call['id']:
            tool_call['id'] = str(uuid.uuid4())

        # 解析JSON参数
        try:
            arguments = json.loads(arguments_str)
        except json.JSONDecodeError as e:
            return f"错误：无法解析工具参数JSON: {e}"

        # 动态查找工具所属的服务器
        # 使用mcp_manager查询所有服务器的工具
        server_id = None
        servers_to_check = []

        try:
            # 确保配置已加载
            mcp_manager.load_config()

            # 获取所有服务器并按优先级排序
            servers_config = mcp_manager.servers_config.get('mcpServers', {})

            # 添加其他已配置的服务器到检查列表
            for srv_id in servers_config.keys():
                if srv_id not in servers_to_check:
                    servers_to_check.append(srv_id)

            # 首先检查缓存中是否有工具信息
            cached_servers = tool_schema_cache.get_all_server_ids()
            if cached_servers:
                logger.debug(f"[MCP缓存] 从缓存中查找工具 {tool_name}")
                for srv_id in cached_servers:
                    cached_tools = tool_schema_cache.get_tools(srv_id)
                    if not cached_tools:
                        continue

                    # 解析工具列表
                    tools_list = []
                    if isinstance(cached_tools, dict) and "tools" in cached_tools:
                        tools_list = cached_tools["tools"]
                    elif isinstance(cached_tools, list):
                        tools_list = cached_tools

                    # 查找工具
                    for tool in tools_list:
                        if isinstance(tool, dict) and tool.get('name') == tool_name:
                            server_id = srv_id
                            logger.debug(f"[MCP缓存命中] 在服务器 {srv_id} 的缓存中找到工具 {tool_name}")
                            break

                    # 如果找到了工具，中断服务器遍历
                    if server_id:
                        break

            # 如果缓存中没有找到，则从服务器获取
            if not server_id:
                # 遍历服务器，查找包含该工具的服务器
                for srv_id in servers_to_check:
                    try:
                        logger.debug(f"[MCP查询] 检查服务器 {srv_id} 是否包含工具 {tool_name}")
                        srv_tools = mcp_manager.get_tools(srv_id)

                        # 解析工具列表
                        tools_list = []
                        if isinstance(srv_tools, dict) and "tools" in srv_tools:
                            tools_list = srv_tools["tools"]
                        elif isinstance(srv_tools, list):
                            tools_list = srv_tools

                        # 查找工具
                        for tool in tools_list:
                            if isinstance(tool, dict) and tool.get('name') == tool_name:
                                server_id = srv_id
                                logger.debug(f"[MCP发现] 在服务器 {srv_id} 中找到工具 {tool_name}")
                                break

                        # 如果找到了工具，中断服务器遍历
                        if server_id:
                            break

                    except Exception as e:
                        logger.warning(f"[MCP警告] 获取服务器 {srv_id} 的工具时出错: {str(e)}")
                        continue

        except Exception as e:
            # 如果动态查找失败，使用默认服务器
            server_id = 'variables-server'
            logger.error(f"[MCP错误] 查找工具 {tool_name} 对应的服务器时出错: {str(e)}，使用默认服务器 {server_id}")

        logger.info(f"[MCP请求] 工具 {tool_name} 将使用服务器 {server_id}")

        try:
            # 确保arguments是字典类型
            if isinstance(arguments, str):
                try:
                    # 尝试将JSON字符串转换为字典
                    arguments = json.loads(arguments)
                    logger.debug(f"[MCP请求] 已将JSON字符串参数转换为字典: {arguments}")
                except json.JSONDecodeError as e:
                    logger.error(f"[MCP错误] 无法将参数转换为字典: {e}")
                    return f"工具执行失败：参数格式错误，无法解析JSON字符串: {e}"

            # 为图谱增强相关工具自动注入分区标识符
            arguments = inject_partition_identifier(tool_name, arguments, server_id)

            # 使用MCP SDK调用工具
            logger.info(f"[MCP请求] 调用工具: {tool_name}, 参数: {arguments}")

            result = mcp_manager.call_tool(server_id, tool_name, arguments)

            # 检查是否有错误
            if isinstance(result, dict):
                # HTTP响应特殊处理：通过 is_error 字段判断
                if result.get('error_type') == 'HTTPError':
                    if result.get('is_error') == True:
                        error_msg = result.get('error', '未知错误')
                        status_code = result.get('status_code', 'unknown')
                        logger.error(f"[MCP错误] HTTP服务器返回错误状态码 {status_code}: {error_msg}")
                        return f"工具执行失败：{error_msg}"
                    else:
                        logger.info(f"[MCP请求] HTTP服务器返回成功响应")
                # 检查其他错误情况
                elif result.get('is_error') or ('error' in result and result['error'] is not False and result['error'] != ''):
                    error_msg = result.get('error', '未知错误')
                    # 特殊处理：如果error值为False，不应该被视为错误
                    if error_msg is False:
                        logger.info(f"[MCP请求] 服务器返回error=False，视为成功响应")
                    else:
                        logger.error(f"[MCP错误] 服务器返回错误: {error_msg}")
                        return f"工具执行失败：{error_msg}"

            # 返回工具结果的JSON字符串或原始字符串
            if isinstance(result, dict):
                return json.dumps(result, ensure_ascii=False)
            else:
                # 如果结果不是字典，直接返回字符串形式
                return str(result)

        except Exception as e:
            error_msg = f"MCP SDK调用失败：{str(e)}"
            logger.error(f"[MCP错误] {error_msg}")
            return error_msg

    except Exception as e:
        error_msg = f"执行工具调用时出错: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        return error_msg

def parse_tool_calls(content: str) -> List[Dict]:
    """
    解析智能体回复中的工具调用，支持XML格式和JSON格式

    Args:
        content: 智能体回复内容

    Returns:
        list: 解析后的工具调用列表，每个调用为一个字典
    """
    if not content or not isinstance(content, str):
        # 空内容是正常情况（如模型测试时没有工具调用），使用debug级别
        logger.debug(f"[解析工具调用] 无内容或非字符串，跳过解析")
        return []

    tool_calls = []
    logger.debug(f"[解析工具调用] 开始解析内容: {content}")

    # 1. 首先尝试解析JSON格式的工具调用
    try:
        # 尝试将整个内容解析为JSON对象
        json_obj = json.loads(content)

        # 检查是否有完整的工具调用结构
        if 'choices' in json_obj and json_obj.get('choices') and isinstance(json_obj['choices'], list):
            for choice in json_obj['choices']:
                if 'delta' in choice and 'tool_calls' in choice['delta']:
                    tool_calls_data = choice['delta']['tool_calls']
                    for tc in tool_calls_data:
                        if 'function' in tc:
                            function_data = tc['function']
                            tool_call = {
                                'id': tc.get('id', str(uuid.uuid4())),
                                'type': 'function',
                                'function': {
                                    'name': function_data.get('name', ''),
                                    'arguments': function_data.get('arguments', '{}')
                                }
                            }
                            # 确保参数是有效的JSON字符串
                            if isinstance(tool_call['function']['arguments'], dict):
                                tool_call['function']['arguments'] = json.dumps(tool_call['function']['arguments'], ensure_ascii=False)

                            tool_calls.append(tool_call)
                            logger.debug(f"[解析工具调用] 从JSON响应中解析到工具调用: {tool_call['function']['name']}")

                # 检查message.tool_calls结构
                if 'message' in choice and 'tool_calls' in choice['message']:
                    tool_calls_data = choice['message']['tool_calls']
                    for tc in tool_calls_data:
                        if 'function' in tc:
                            function_data = tc['function']
                            tool_call = {
                                'id': tc.get('id', str(uuid.uuid4())),
                                'type': 'function',
                                'function': {
                                    'name': function_data.get('name', ''),
                                    'arguments': function_data.get('arguments', '{}')
                                }
                            }
                            # 确保参数是有效的JSON字符串
                            if isinstance(tool_call['function']['arguments'], dict):
                                tool_call['function']['arguments'] = json.dumps(tool_call['function']['arguments'], ensure_ascii=False)

                            tool_calls.append(tool_call)
                            logger.debug(f"[解析工具调用] 从JSON message中解析到工具调用: {tool_call['function']['name']}")

        # 如果已经解析到了工具调用，直接返回
        if tool_calls:
            return tool_calls

        # 检查是否是简单的JSON格式工具调用 {"name": "tool_name", "parameters": {...}}
        if isinstance(json_obj, dict):
            # 格式1: {"name": "tool_name", "parameters": {...}}
            if 'name' in json_obj and 'parameters' in json_obj:
                function_name = json_obj['name']
                parameters = json_obj['parameters']

                tool_call = {
                    'id': str(uuid.uuid4()),
                    'type': 'function',
                    'function': {
                        'name': function_name,
                        'arguments': json.dumps(parameters, ensure_ascii=False)
                    }
                }
                tool_calls.append(tool_call)
                logger.debug(f"[解析工具调用] 从简单JSON格式解析到工具调用: {function_name}")
                return tool_calls

            # 格式2: {"tool": "tool_name", "parameters": {...}} 或其他可能的变体
            if 'tool' in json_obj and 'parameters' in json_obj:
                function_name = json_obj['tool']
                parameters = json_obj['parameters']

                tool_call = {
                    'id': str(uuid.uuid4()),
                    'type': 'function',
                    'function': {
                        'name': function_name,
                        'arguments': json.dumps(parameters, ensure_ascii=False)
                    }
                }
                tool_calls.append(tool_call)
                logger.debug(f"[解析工具调用] 从JSON变体格式解析到工具调用: {function_name}")
                return tool_calls

            # 格式3: {"function": {"name": "tool_name", "arguments": {...}}}
            if 'function' in json_obj and isinstance(json_obj['function'], dict):
                function_data = json_obj['function']
                if 'name' in function_data:
                    function_name = function_data['name']
                    arguments = function_data.get('arguments', '{}')
                    # 确保参数是有效的JSON字符串
                    if not isinstance(arguments, str):
                        arguments = json.dumps(arguments, ensure_ascii=False)

                    tool_call = {
                        'id': json_obj.get('id', str(uuid.uuid4())),
                        'type': 'function',
                        'function': {
                            'name': function_name,
                            'arguments': arguments
                        }
                    }
                    tool_calls.append(tool_call)
                    logger.debug(f"[解析工具调用] 从function格式解析到工具调用: {function_name}")
                    return tool_calls

    except json.JSONDecodeError:
        # 不是有效的JSON，继续尝试其他解析方法
        pass
    except Exception as e:
        logger.warning(f"[解析工具调用] 尝试解析JSON格式时出错: {e}")

    # 2. 使用XML解析方式处理<tool_call>标签
    # 首先提取所有<tool_call>标签对
    tool_call_pattern = r'<tool_call\s+name=[\"\']([^\"\']+)[\"\']>(.*?)</tool_call>'
    tool_call_matches = re.finditer(tool_call_pattern, content, re.DOTALL)

    for match in tool_call_matches:
        try:
            function_name = match.group(1)
            # 整个标签内的内容作为参数，不做其他处理
            arguments_str = match.group(2).strip()
            logger.debug(f"[解析工具调用] 找到XML格式工具调用: {function_name}, 参数: {arguments_str}")

            try:
                arguments = json.loads(arguments_str)
            except json.JSONDecodeError as e:
                logger.warning(f"[解析工具调用] JSON解析失败: {e}, 原始字符串: '{arguments_str}'")
                # 尝试修复常见的JSON格式问题
                fixed_json = arguments_str.replace('\'', '"').replace('None', 'null').replace('True', 'true').replace('False', 'false')
                try:
                    arguments = json.loads(fixed_json)
                    logger.debug(f"[解析工具调用] 修复后的JSON解析成功: {arguments}")
                except json.JSONDecodeError:
                    logger.warning(f"[解析工具调用] 修复后的JSON仍然无法解析，跳过此工具调用")
                    continue

            tool_call = {
                'id': str(uuid.uuid4()),  # 生成唯一ID
                'type': 'function',
                'function': {
                    'name': function_name,
                    'arguments': json.dumps(arguments, ensure_ascii=False)
                }
            }
            tool_calls.append(tool_call)
            logger.debug(f"[解析工具调用] 成功创建工具调用对象: {function_name}")
        except Exception as e:
            logger.warning(f"[解析工具调用] 解析<tool_call>格式失败: {e}")

    # 3. 处理不完整的工具调用（没有结束标签）
    if not tool_calls and '<tool_call' in content:
        logger.debug("[解析工具调用] 内容中可能包含不完整的工具调用，尝试提取")

        # 提取工具名称和参数内容
        incomplete_pattern = r'<tool_call\s+name=[\"\']([^\"\']+)[\"\']>\s*(.*)'
        incomplete_match = re.search(incomplete_pattern, content, re.DOTALL)

        if incomplete_match:
            try:
                function_name = incomplete_match.group(1)
                arguments_str = incomplete_match.group(2).strip()
                logger.debug(f"[解析工具调用] 找到不完整的工具调用: {function_name}, 参数: {arguments_str}")

                # 尝试解析JSON参数
                try:
                    # 如果是不完整的JSON，尝试平衡大括号
                    if arguments_str.count('{') > arguments_str.count('}'):
                        missing_braces = arguments_str.count('{') - arguments_str.count('}')
                        arguments_str += '}' * missing_braces

                    arguments = json.loads(arguments_str)

                    tool_call = {
                        'id': str(uuid.uuid4()),
                        'type': 'function',
                        'function': {
                            'name': function_name,
                            'arguments': json.dumps(arguments, ensure_ascii=False)
                        }
                    }
                    tool_calls.append(tool_call)
                    logger.debug(f"[解析工具调用] 成功从不完整内容创建工具调用: {function_name}")
                except json.JSONDecodeError as e:
                    logger.debug(f"[解析工具调用] 无法解析不完整的JSON参数: {arguments_str}, 错误: {e}")
            except Exception as e:
                logger.debug(f"[解析工具调用] 处理不完整工具调用时出错: {e}")

    return tool_calls
