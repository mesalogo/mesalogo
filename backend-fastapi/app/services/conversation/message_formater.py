"""
消息格式化模块

提供标准化的消息格式化工具，用于处理SSE消息在后端的统一格式化

函数说明:
---------------------------------------

* format_text_content - 格式化纯文本内容为标准SSE消息
* format_agent_info - 格式化智能体信息为标准SSE消息
* format_connection_status - 格式化连接状态为标准SSE消息
* format_thinking - 格式化思考内容为标准SSE消息
* format_tool_call - 格式化工具调用为标准SSE消息
* format_reasoning - 格式化推理内容为标准SSE消息（用于Qwen3模型）
* format_tool_result_as_role - 格式化工具调用结果为role:tool格式的SSE消息
* format_virtual_message - 格式化虚拟消息为标准SSE消息
* format_round_info - 格式化轮次信息为标准SSE消息
* format_system_message - 格式化系统消息为标准SSE消息
* format_agent_error_done - 格式化智能体处理失败但完成的消息
* format_agent_cancel_done - 格式化智能体被取消但视为完成的消息
* format_all_agents_done - 格式化所有智能体处理完成的消息
"""
import json
import time
import random
from typing import Dict, Any, Optional, Union

def format_text_content(content: str) -> Dict[str, Any]:
    """
    格式化纯文本内容为标准SSE消息

    Args:
        content: 文本内容

    Returns:
        Dict: 格式化后的消息字典
    """
    return {
        "content": content,
        "meta": None
    }

def format_agent_info(
    turn_prompt: str,
    agent_id: str,
    agent_name: str,
    round_num: int = 1,
    total_rounds: int = 1,
    response_order: int = 1,
    total_agents: int = 1,
    is_summarizing: bool = False
) -> Dict[str, Any]:
    """
    格式化智能体信息为标准SSE消息

    Args:
        turn_prompt: 当前轮次提示
        agent_id: 智能体ID
        agent_name: 智能体名称
        round_num: 当前轮次
        total_rounds: 总轮次
        response_order: 响应顺序
        total_agents: 总智能体数量
        is_summarizing: 是否在总结中

    Returns:
        Dict: 格式化后的消息字典
    """
    return {
        "content": None,
        "meta": {
            "type": "agentInfo",
            "turnPrompt": turn_prompt,
            "responseOrder": response_order,
            "totalAgents": total_agents,
            "agentId": agent_id,
            "agentName": agent_name,
            "round": round_num,
            "totalRounds": total_rounds,
            "isSummarizing": is_summarizing
        }
    }

def format_connection_status(
    status: str,
    error: Optional[str] = None,
    message: Optional[str] = None,
    token_usage: Optional[int] = None,
    response_obj: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    格式化连接状态为标准SSE消息

    Args:
        status: 连接状态 ('connected', 'active', 'error', 'done', 'agentDone')
        error: 错误信息 (用于状态为error时)
        message: 状态消息 (用于状态为done时)
        token_usage: Token使用量 (用于状态为done或agentDone时)
        response_obj: 响应对象 (用于状态为done或agentDone时)

    Returns:
        Dict: 格式化后的消息字典
    """
    meta = {"connectionStatus": status}

    if error and status == "error":
        meta["error"] = error

    if message and status == "done":
        meta["message"] = message

    if token_usage is not None and status in ["done", "agentDone"]:
        meta["tokenUsage"] = token_usage

    if response_obj is not None and status in ["done", "agentDone"]:
        meta["responseObj"] = response_obj

    return {
        "content": None,
        "meta": meta
    }

def format_thinking(
    content: str,
    agent_id: str
) -> Dict[str, Any]:
    """
    格式化思考内容为标准SSE消息

    Args:
        content: 思考内容
        agent_id: 智能体ID

    Returns:
        Dict: 格式化后的消息字典
    """
    return {
        "content": None,
        "meta": {
            "type": "thinking",
            "content": content,
            "agentId": agent_id
        }
    }

def format_reasoning(
    content: str,
    reasoning_content: str,
    agent_id: str = None
) -> Dict[str, Any]:
    """
    格式化推理内容为标准SSE消息（用于Qwen3模型）

    Args:
        content: 正常内容
        reasoning_content: 推理内容
        agent_id: 智能体ID

    Returns:
        Dict: 格式化后的消息字典
    """
    return {
        "content": content,
        "meta": {
            "type": "reasoning",
            "reasoning": reasoning_content,
            "agentId": agent_id
        }
    }

def format_tool_call(
    function_name: str,
    arguments: str,
    tool_call_id: str = ""
) -> Dict[str, Any]:
    """
    格式化工具调用为标准SSE消息

    Args:
        function_name: 工具函数名称
        arguments: 工具参数 (JSON字符串)
        tool_call_id: 工具调用ID

    Returns:
        Dict: 格式化后的消息字典
    """
    return {
        "content": None,
        "meta": {
            "ToolCallAction": {
                "Function": function_name,
                "Arguments": arguments
            },
            "toolCallId": tool_call_id
        }
    }



def format_virtual_message(
    content: str,
    message_id: str,
    timestamp: str,
    virtual_role: str = "human"
) -> Dict[str, Any]:
    """
    格式化虚拟消息为标准SSE消息

    Args:
        content: 消息内容
        message_id: 消息ID
        timestamp: 时间戳
        virtual_role: 虚拟角色类型

    Returns:
        Dict: 格式化后的消息字典
    """
    message = {
        "id": message_id,
        "content": content,
        "role": virtual_role,
        "timestamp": timestamp,
        "isVirtual": True
    }

    return {
        "content": content,
        "meta": {
            "type": "virtualMessage",
            "isVirtual": True,
            "virtualRole": virtual_role,
            "timestamp": timestamp,
            "message": message
        }
    }

def format_round_info(
    current_round: int,
    total_rounds: int
) -> Dict[str, Any]:
    """
    格式化轮次信息为标准SSE消息

    Args:
        current_round: 当前轮次
        total_rounds: 总轮次

    Returns:
        Dict: 格式化后的消息字典
    """
    return {
        "content": None,
        "meta": {
            "roundInfo": {
                "current": current_round,
                "total": total_rounds
            }
        }
    }

def format_system_message(
    message_id: str,
    content: str,
    created_at: str
) -> Dict[str, Any]:
    """
    格式化系统消息为标准SSE消息

    Args:
        message_id: 消息ID
        content: 消息内容
        created_at: 创建时间

    Returns:
        Dict: 格式化后的消息字典
    """
    return {
        "content": None,
        "meta": {
            "message": {
                "id": message_id,
                "content": content,
                "role": "system",
                "created_at": created_at
            }
        }
    }

def format_agent_error_done(
    agent_id: str,
    agent_name: str,
    role_name: str,
    timestamp: Optional[str] = None,
    response_order: int = 1,
    error_content: Optional[str] = None
) -> Dict[str, Any]:
    """
    格式化智能体处理失败但完成的消息

    Args:
        agent_id: 智能体ID
        agent_name: 智能体名称
        role_name: 角色名称
        timestamp: 时间戳，如果为None则不设置
        response_order: 响应顺序
        error_content: 错误内容，如果为None则生成默认错误内容

    Returns:
        Dict: 格式化后的消息字典
    """
    if error_content is None:
        error_content = f"智能体处理失败: {agent_name}({role_name})"

    # 添加时间戳和随机数以确保每个错误ID都是唯一的
    current_time_ms = int(time.time() * 1000)
    random_suffix = random.randint(1000, 9999)
    error_id = f"error-{agent_id}-{response_order}-{current_time_ms}-{random_suffix}"

    return {
        "content": None,
        "meta": {
            "connectionStatus": "agentDone",
            "responseObj": {
                "response": {
                    "id": error_id,
                    "content": error_content,
                    "agent_id": agent_id,
                    "agent_name": agent_name,
                    "role_name": role_name,
                    "timestamp": timestamp,
                    "response_order": response_order
                }
            }
        }
    }

def format_agent_cancel_done(
    agent_id: str,
    agent_name: str,
    role_name: str,
    timestamp: Optional[str] = None,
    response_order: int = 1,
    cancel_content: Optional[str] = None
) -> Dict[str, Any]:
    """
    格式化智能体被取消但视为完成的消息

    Args:
        agent_id: 智能体ID
        agent_name: 智能体名称
        role_name: 角色名称
        timestamp: 时间戳，如果为None则不设置
        response_order: 响应顺序
        cancel_content: 取消内容，如果为None则生成默认内容

    Returns:
        Dict: 格式化后的消息字典
    """
    if cancel_content is None:
        cancel_content = f"智能体响应被取消: {agent_name}({role_name})"

    # 添加时间戳和随机数以确保每个ID都是唯一的
    current_time_ms = int(time.time() * 1000)
    random_suffix = random.randint(1000, 9999)
    cancel_id = f"cancel-{agent_id}-{response_order}-{current_time_ms}-{random_suffix}"

    # 添加当前时间戳，如果未提供
    if timestamp is None:
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%S.%fZ", time.gmtime())

    return {
        "content": None,
        "meta": {
            "connectionStatus": "agentDone",
            "responseObj": {
                "response": {
                    "id": cancel_id,
                    "content": cancel_content,
                    "agent_id": agent_id,
                    "agent_name": agent_name,
                    "role_name": role_name,
                    "timestamp": timestamp,
                    "response_order": response_order,
                    "is_cancelled": True  # 添加标记，表示这是一个被取消的响应
                }
            }
        }
    }

def format_all_agents_done(
    message: str = "所有智能体已完成响应",
    message_ids: Optional[list] = None,
    need_summarize: bool = False
) -> Dict[str, Any]:
    """
    格式化所有智能体处理完成的消息

    Args:
        message: 完成消息内容
        message_ids: 消息ID列表，自动会话中使用
        need_summarize: 是否需要触发上下文总结

    Returns:
        Dict: 格式化后的消息字典
    """
    result = {
        "content": None,
        "meta": {
            "connectionStatus": "done",
            "message": message
        }
    }

    # 如果提供了message_ids（自动会话中使用）
    if message_ids:
        result["meta"]["message_ids"] = message_ids

    # 如果需要触发上下文总结
    if need_summarize:
        result["meta"]["need_summarize"] = True

    return result

def format_tool_result_as_role(
    result: str,
    tool_name: str,
    tool_call_id: str = "",
    tool_parameter: str = None,
    status: str = "success"
) -> Dict[str, Any]:
    """
    格式化工具调用结果为role:tool格式的SSE消息

    Args:
        result: 工具调用结果
        tool_name: 工具名称
        tool_call_id: 工具调用ID
        tool_parameter: 工具调用参数 (JSON字符串)
        status: 工具调用状态 ('success' 或 'error')

    Returns:
        Dict: 格式化后的消息字典
    """
    return {
        "content": None,
        "meta": {
            "type": "toolResult",
            "role": "tool",
            "content": result,
            "tool_call_id": tool_call_id,
            "tool_name": tool_name,
            "tool_parameter": tool_parameter if tool_parameter else None,
            "status": status
        }
    }

def serialize_message(message: Dict[str, Any]) -> str:
    """
    将消息对象序列化为JSON字符串

    Args:
        message: 消息对象

    Returns:
        str: 序列化后的JSON字符串
    """
    return json.dumps(message, ensure_ascii=False)