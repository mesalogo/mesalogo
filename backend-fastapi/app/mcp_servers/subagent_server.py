#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SubAgent MCP 服务器

提供 Agent 主动调用 Agent 的协作能力。通过 MCP 工具接口暴露给 LLM：
- invoke_agent: 调用单个智能体执行子任务
- invoke_agents: 并行调用多个智能体执行子任务
- list_available_agents: 列出当前行动任务中可调用的智能体

设计理念：
- SubAgent 调用走标准工具调用流（ToolCallAction → toolResult），复用现有 SSE 机制
- 调用方 Agent 保持控制权，等待结果后继续推理
- SubAgent 使用独立上下文，不共享调用方会话历史
"""

import json
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


# ---------- 工具定义 ---------- #

SUBAGENT_TOOLS = [
    {
        "name": "invoke_agent",
        "description": "Call a single agent by its display name (target_agent_name) to perform a sub-task. The agent processes your request independently and returns the result. Required params: task_id, target_agent_name (exact display name, NOT id), task_description.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "string",
                    "description": "Current action task ID"
                },
                "target_agent_name": {
                    "type": "string",
                    "description": "The exact display name of the target agent (NOT agent_id). Choose from the available agents list."
                },
                "task_description": {
                    "type": "string",
                    "description": "Clear task description telling the agent what to do"
                },
                "context": {
                    "type": "string",
                    "description": "Optional context information to help the target agent understand the background"
                },
                "max_tokens": {
                    "type": "integer",
                    "description": "Maximum tokens for SubAgent response (default: 2048)",
                    "default": 2048
                }
            },
            "required": ["task_id", "target_agent_name", "task_description"]
        },
        "annotations": {
            "title": "Call Agent",
            "readOnlyHint": False,
            "destructiveHint": False,
            "idempotentHint": False,
            "openWorldHint": False
        }
    },
    {
        "name": "invoke_agents",
        "description": "Call multiple agents in parallel. Use field 'invocations' (an array of objects, each with target_agent_name and task_description). Example: {\"task_id\": \"xxx\", \"invocations\": [{\"target_agent_name\": \"AgentA\", \"task_description\": \"do X\"}, {\"target_agent_name\": \"AgentB\", \"task_description\": \"do Y\"}]}",
        "inputSchema": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "string",
                    "description": "Current action task ID"
                },
                "invocations": {
                    "type": "array",
                    "description": "Array of invocation objects. Each object MUST have target_agent_name (display name, NOT id) and task_description. Do NOT use field names like 'agents', 'agent_id', or 'instruction'.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "target_agent_name": {
                                "type": "string",
                                "description": "The exact display name of the target agent (NOT agent_id)"
                            },
                            "task_description": {
                                "type": "string",
                                "description": "Clear task description for this agent (NOT 'instruction')"
                            },
                            "context": {
                                "type": "string",
                                "description": "Optional context"
                            }
                        },
                        "required": ["target_agent_name", "task_description"]
                    },
                    "maxItems": 5
                },
                "max_tokens_per_agent": {
                    "type": "integer",
                    "description": "Maximum tokens per SubAgent response (default: 2048)",
                    "default": 2048
                }
            },
            "required": ["task_id", "invocations"]
        },
        "annotations": {
            "title": "Call Multiple Agents",
            "readOnlyHint": False,
            "destructiveHint": False,
            "idempotentHint": False,
            "openWorldHint": False
        }
    },
    {
        "name": "list_available_agents",
        "description": "List all agents available for calling in the current action task. Returns each agent's name, role and capability description.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "string",
                    "description": "Current action task ID"
                }
            },
            "required": ["task_id"]
        },
        "annotations": {
            "title": "List Available Agents",
            "readOnlyHint": True,
            "openWorldHint": False
        }
    }
]


# ---------- 工具实现 ---------- #

def _invoke_agent(task_id: str, target_agent_name: str, task_description: str,
                  context: str = None, max_tokens: int = 2048,
                  caller_agent_id: str = None, nesting_depth: int = 0) -> Dict[str, Any]:
    """调用单个 SubAgent"""
    from app.services.subagent.executor import SubAgentExecutor

    if not caller_agent_id:
        return {
            "success": False,
            "error": "缺少调用方智能体信息（caller_agent_id）"
        }

    result = SubAgentExecutor.invoke_single(
        task_id=task_id,
        caller_agent_id=caller_agent_id,
        target_agent_name=target_agent_name,
        task_description=task_description,
        context=context,
        nesting_depth=nesting_depth,
        max_tokens=max_tokens
    )

    return {
        "success": result.get("status") == "success",
        "result": result
    }


def _invoke_agents(task_id: str, invocations: list,
                   max_tokens_per_agent: int = 2048,
                   caller_agent_id: str = None, nesting_depth: int = 0) -> Dict[str, Any]:
    """并行调用多个 SubAgent"""
    from app.services.subagent.executor import SubAgentExecutor

    if not caller_agent_id:
        return {
            "success": False,
            "error": "缺少调用方智能体信息（caller_agent_id）"
        }

    result = SubAgentExecutor.invoke_parallel(
        task_id=task_id,
        caller_agent_id=caller_agent_id,
        invocations=invocations,
        nesting_depth=nesting_depth,
        max_tokens_per_agent=max_tokens_per_agent
    )

    if result.get("error"):
        return {
            "success": False,
            "error": result["error"]
        }

    return {
        "success": True,
        "result": result
    }


def _list_available_agents(task_id: str, caller_agent_id: str = None) -> Dict[str, Any]:
    """列出可调用的 Agent"""
    from app.services.subagent.executor import SubAgentExecutor

    agents = SubAgentExecutor.get_available_agents(
        task_id=task_id,
        exclude_agent_id=caller_agent_id
    )

    return {
        "success": True,
        "agents": agents,
        "count": len(agents),
        "message": f"当前行动任务中有 {len(agents)} 个可调用的智能体"
    }


# ---------- MCPServerManager 兼容方法 ---------- #

def get_tools() -> List[Dict]:
    """
    获取工具定义列表
    为了与 MCPServerManager 兼容，提供获取工具定义的方法
    """
    return SUBAGENT_TOOLS


def handle_request(request_data: Dict) -> Dict:
    """
    处理 MCP 工具调用请求
    为了与 MCPServerManager 兼容，提供处理请求的方法

    Args:
        request_data: MCP 请求数据，格式:
            {
                "name": "invoke_agent",
                "input": { ... },
                "id": "tool_use_id",
                "caller_agent_id": "123"  # 由 MCPServerManager 注入
            }

    Returns:
        Dict: MCP 响应数据
    """
    try:
        tool_name = request_data.get('name')
        tool_input = request_data.get('input', {})
        tool_use_id = request_data.get('id', 'unknown_id')
        caller_agent_id = request_data.get('caller_agent_id')

        if not tool_name:
            return {
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "is_error": True,
                "error": "缺少工具名称"
            }

        # 路由到对应的处理函数
        if tool_name == 'invoke_agent':
            result = _invoke_agent(
                task_id=tool_input.get('task_id', ''),
                target_agent_name=tool_input.get('target_agent_name', ''),
                task_description=tool_input.get('task_description', ''),
                context=tool_input.get('context'),
                max_tokens=tool_input.get('max_tokens', 2048),
                caller_agent_id=caller_agent_id
            )
        elif tool_name == 'invoke_agents':
            # invocations 可能被 LLM 双重序列化为 JSON 字符串，需要反序列化
            invocations = tool_input.get('invocations', [])
            if isinstance(invocations, str):
                try:
                    invocations = json.loads(invocations)
                except json.JSONDecodeError:
                    logger.warning(f"[SubAgent] invocations 不是有效 JSON: {invocations[:200]}")
                    invocations = []
            result = _invoke_agents(
                task_id=tool_input.get('task_id', ''),
                invocations=invocations,
                max_tokens_per_agent=tool_input.get('max_tokens_per_agent', 2048),
                caller_agent_id=caller_agent_id
            )
        elif tool_name == 'list_available_agents':
            result = _list_available_agents(
                task_id=tool_input.get('task_id', ''),
                caller_agent_id=caller_agent_id
            )
        else:
            return {
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "is_error": True,
                "error": f"未知工具: {tool_name}"
            }

        # 检查结果
        if isinstance(result, dict) and not result.get('success', False):
            return {
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "is_error": True,
                "error": result.get('error', '未知错误')
            }

        return {
            "type": "tool_result",
            "tool_use_id": tool_use_id,
            "content": result
        }

    except Exception as e:
        logger.error(f"处理 SubAgent 工具请求失败: {str(e)}")
        import traceback
        traceback.print_exc()

        return {
            "type": "tool_result",
            "tool_use_id": request_data.get('id', 'unknown_id'),
            "is_error": True,
            "error": f"工具执行失败: {str(e)}"
        }
