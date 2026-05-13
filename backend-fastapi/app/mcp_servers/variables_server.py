#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
环境变量和智能体变量MCP服务器

本模块使用MCP官方SDK实现变量管理服务器，提供环境变量和智能体变量的管理功能。
服务器提供以下工具：
- 任务环境变量管理工具（get_task_var, set_task_var, list_task_vars）
- 智能体变量管理工具（get_agent_var, set_agent_var, list_agent_vars）
"""

import json
import logging
from typing import Dict, Any, List
from mcp.server.fastmcp import FastMCP

from app.models import ActionTaskEnvironmentVariable, ActionTask, AgentVariable, Agent
from app.extensions import db
from datetime import datetime

# 设置日志
logger = logging.getLogger(__name__)

# 初始化MCP服务器
mcp = FastMCP("variables-server")

#---------- 任务环境变量工具定义 ----------#
ENV_VAR_TOOLS = [
    {
        "name": "set_task_var",
        "description": "设置特定任务的环境变量值",
        "inputSchema": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "string",
                    "description": "任务ID"
                },
                "var_name": {
                    "type": "string",
                    "description": "要设置的变量名称"
                },
                "var_value": {
                    "type": "string",
                    "description": "要设置的变量值"
                }
            },
            "required": ["task_id", "var_name", "var_value"]
        },
        "annotations": {
            "title": "设置任务变量",
            "readOnlyHint": False,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": False
        }
    },
    {
        "name": "add_task_var",
        "description": "添加新的任务环境变量（如果变量已存在则返回错误）",
        "inputSchema": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "string",
                    "description": "任务ID"
                },
                "var_name": {
                    "type": "string",
                    "description": "要添加的变量名称"
                },
                "var_value": {
                    "type": "string",
                    "description": "要设置的变量值"
                },
                "label": {
                    "type": "string",
                    "description": "变量显示标签（用于UI显示）"
                }
            },
            "required": ["task_id", "var_name", "var_value"]
        },
        "annotations": {
            "title": "添加任务变量",
            "readOnlyHint": False,
            "destructiveHint": False,
            "idempotentHint": False,
            "openWorldHint": False
        }
    },
    {
        "name": "list_task_vars",
        "description": "列出特定任务的所有环境变量",
        "inputSchema": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "string",
                    "description": "任务ID"
                }
            },
            "required": ["task_id"]
        },
        "annotations": {
            "title": "列出任务变量",
            "readOnlyHint": True,
            "openWorldHint": False
        }
    }
]

#---------- 智能体变量工具定义 ----------#
AGENT_VAR_TOOLS = [
    {
        "name": "set_agent_var",
        "description": "设置智能体的个人变量值",
        "inputSchema": {
            "type": "object",
            "properties": {
                "agent_id": {
                    "type": "string",
                    "description": "智能体ID"
                },
                "var_name": {
                    "type": "string",
                    "description": "要设置的变量名称"
                },
                "var_value": {
                    "type": "string",
                    "description": "要设置的变量值"
                },
                "is_public": {
                    "type": "boolean",
                    "description": "是否公开此变量（默认为true）",
                    "default": True
                }
            },
            "required": ["agent_id", "var_name", "var_value"]
        },
        "annotations": {
            "title": "设置智能体变量",
            "readOnlyHint": False,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": False
        }
    },
    {
        "name": "add_agent_var",
        "description": "添加新的智能体变量（如果变量已存在则返回错误）",
        "inputSchema": {
            "type": "object",
            "properties": {
                "agent_id": {
                    "type": "string",
                    "description": "智能体ID"
                },
                "var_name": {
                    "type": "string",
                    "description": "要添加的变量名称"
                },
                "var_value": {
                    "type": "string",
                    "description": "要设置的变量值"
                },
                "label": {
                    "type": "string",
                    "description": "变量显示标签（用于UI显示）"
                },
                "is_public": {
                    "type": "boolean",
                    "description": "是否公开此变量（默认为true）",
                    "default": True
                }
            },
            "required": ["agent_id", "var_name", "var_value"]
        },
        "annotations": {
            "title": "添加智能体变量",
            "readOnlyHint": False,
            "destructiveHint": False,
            "idempotentHint": False,
            "openWorldHint": False
        }
    },
    {
        "name": "list_agent_vars",
        "description": "列出智能体的所有个人变量",
        "inputSchema": {
            "type": "object",
            "properties": {
                "agent_id": {
                    "type": "string",
                    "description": "智能体ID"
                },
                "include_private": {
                    "type": "boolean",
                    "description": "是否包含私有变量（默认为false）",
                    "default": False
                }
            },
            "required": ["agent_id"]
        },
        "annotations": {
            "title": "列出智能体变量",
            "readOnlyHint": True,
            "openWorldHint": False
        }
    }
]

#---------- 环境变量工具 ----------#

@mcp.tool()
def set_task_var(task_id: int, var_name: str, var_value: Any) -> Any:
    """设置任务环境变量的值

    Args:
        task_id: 任务ID
        var_name: 要设置的变量名称
        var_value: 要设置的变量值

    Returns:
        设置后的变量值
    """
    # task_id现在已经是整数类型，无需转换

    try:
        # 检查任务是否存在
        task = ActionTask.query.get(task_id)
        if not task:
            raise ValueError(f"任务ID {task_id} 不存在")

        # 转换复杂对象为JSON字符串
        value_to_store = json.dumps(var_value) if isinstance(var_value, (dict, list)) else var_value

        # 检查变量是否已存在
        env_var = ActionTaskEnvironmentVariable.query.filter_by(
            action_task_id=task_id,
            name=var_name
        ).first()

        if env_var:
            # 更新现有变量
            env_var.value = value_to_store
            env_var.updated_at = datetime.utcnow()

            # 更新历史记录
            history = json.loads(env_var.history) if env_var.history else []
            history.append({
                "timestamp": datetime.utcnow().isoformat(),
                "value": value_to_store
            })
            env_var.history = json.dumps(history)
        else:
            # 创建新变量
            env_var = ActionTaskEnvironmentVariable(
                name=var_name,
                value=value_to_store,
                action_task_id=task_id,
                history=json.dumps([{
                    "timestamp": datetime.utcnow().isoformat(),
                    "value": value_to_store
                }])
            )
            db.session.add(env_var)

        db.session.commit()
        return var_value
    except Exception as e:
        db.session.rollback()
        logger.error(f"设置任务 {task_id} 的变量 {var_name} 时出错: {str(e)}")
        raise

@mcp.tool()
def add_task_var(task_id: int, var_name: str, var_value: Any, label: str = None) -> Any:
    """添加新的任务环境变量（如果变量已存在则返回错误）

    Args:
        task_id: 任务ID
        var_name: 要添加的变量名称
        var_value: 要设置的变量值
        label: 变量显示标签（用于UI显示），如果未提供则使用变量名称

    Returns:
        添加的变量值
    """
    # task_id现在已经是整数类型，无需转换

    try:
        # 检查任务是否存在
        task = ActionTask.query.get(task_id)
        if not task:
            raise ValueError(f"任务ID {task_id} 不存在")

        # 检查变量是否已存在
        existing_var = ActionTaskEnvironmentVariable.query.filter_by(
            action_task_id=task_id,
            name=var_name
        ).first()

        if existing_var:
            return {"error": f"变量 {var_name} 已存在于任务 {task_id}", "status": "error"}

        # 如果未提供标签，则使用变量名称作为标签
        if label is None:
            # 将下划线替换为空格，并将单词首字母大写，以生成默认标签
            label = var_name.replace('_', ' ').title()

        # 转换复杂对象为JSON字符串
        value_to_store = json.dumps(var_value) if isinstance(var_value, (dict, list)) else str(var_value)

        # 创建新变量
        env_var = ActionTaskEnvironmentVariable(
            name=var_name,
            label=label,
            value=value_to_store,
            action_task_id=task_id,
            history=json.dumps([{
                "timestamp": datetime.utcnow().isoformat(),
                "value": value_to_store
            }])
        )
        db.session.add(env_var)
        db.session.commit()

        return var_value
    except Exception as e:
        db.session.rollback()
        logger.error(f"添加任务 {task_id} 的变量 {var_name} 时出错: {str(e)}")
        raise

@mcp.tool()
def list_task_vars(task_id: int) -> Dict[str, Any]:
    """列出任务的所有环境变量

    Args:
        task_id: 任务ID

    Returns:
        包含所有变量的字典，格式为 {变量名: 变量值}
    """
    # task_id现在已经是整数类型，无需转换

    try:
        # 检查任务是否存在
        task = ActionTask.query.get(task_id)
        if not task:
            raise ValueError(f"任务ID {task_id} 不存在")

        # 查询该任务的所有环境变量
        env_vars = ActionTaskEnvironmentVariable.query.filter_by(action_task_id=task_id).all()

        result = {}
        for var in env_vars:
            try:
                # 尝试解析JSON值
                result[var.name] = json.loads(var.value)
            except (TypeError, json.JSONDecodeError):
                # 如果不是JSON，则直接使用原始值
                result[var.name] = var.value

        return result
    except Exception as e:
        logger.error(f"列出任务 {task_id} 的所有变量时出错: {str(e)}")
        raise

#---------- 智能体变量工具 ----------#

@mcp.tool()
def set_agent_var(agent_id: int, var_name: str, var_value: Any, is_public: bool = True) -> Any:
    """设置智能体变量的值

    Args:
        agent_id: 智能体ID
        var_name: 要设置的变量名称
        var_value: 要设置的变量值
        is_public: 是否对其他智能体公开（默认为True）

    Returns:
        设置后的变量值
    """
    # agent_id现在已经是整数类型，无需转换

    try:
        # 检查智能体是否存在
        agent = Agent.query.get(agent_id)
        if not agent:
            logger.error(f"智能体ID {agent_id} 不存在")
            return {"error": f"智能体ID {agent_id} 不存在", "status": "error"}

        # 检查变量是否存在
        variable = AgentVariable.query.filter_by(agent_id=agent_id, name=var_name).first()

        if variable:
            # 转换值为字符串存储，类型固定为text
            str_value = str(var_value)

            # 更新历史记录
            history = variable.history or []
            history.append({"timestamp": datetime.utcnow().isoformat(), "value": str_value})

            # 更新值
            variable.value = str_value
            variable.history = history
            variable.updated_at = datetime.utcnow()
        else:
            # 转换值为字符串存储
            str_value = str(var_value)

            # 创建新变量
            variable = AgentVariable(
                agent_id=agent_id,
                name=var_name,
                value=str_value,
                is_public=is_public,
                history=[{"timestamp": datetime.utcnow().isoformat(), "value": str_value}]
            )
            db.session.add(variable)

        db.session.commit()
        return var_value
    except Exception as e:
        db.session.rollback()
        logger.error(f"设置智能体 {agent_id} 的变量 {var_name} 时出错: {str(e)}")
        raise

@mcp.tool()
def add_agent_var(agent_id: int, var_name: str, var_value: Any,
                       label: str = None, is_public: bool = True) -> Any:
    """添加新的智能体变量（如果变量已存在则返回错误）

    Args:
        agent_id: 智能体ID
        var_name: 要添加的变量名称
        var_value: 要设置的变量值
        label: 变量显示标签（用于UI显示），如果未提供则使用变量名称
        is_public: 是否对其他智能体公开（默认为True）

    Returns:
        添加的变量值
    """
    # agent_id现在已经是整数类型，无需转换

    try:
        # 检查智能体是否存在
        agent = Agent.query.get(agent_id)
        if not agent:
            logger.error(f"智能体ID {agent_id} 不存在")
            return {"error": f"智能体ID {agent_id} 不存在", "status": "error"}

        # 检查变量是否已存在
        existing_var = AgentVariable.query.filter_by(agent_id=agent_id, name=var_name).first()
        if existing_var:
            return {"error": f"变量 {var_name} 已存在于智能体 {agent_id}", "status": "error"}

        # 如果未提供标签，则使用变量名称作为标签
        if label is None:
            # 将下划线替换为空格，并将单词首字母大写，以生成默认标签
            label = var_name.replace('_', ' ').title()

        # 转换值为字符串存储
        str_value = str(var_value)

        # 创建新变量
        variable = AgentVariable(
            agent_id=agent_id,
            name=var_name,
            label=label,
            value=str_value,
            is_public=is_public,
            history=json.dumps([{"timestamp": datetime.utcnow().isoformat(), "value": str_value}])
        )
        db.session.add(variable)
        db.session.commit()

        return var_value
    except Exception as e:
        db.session.rollback()
        logger.error(f"添加智能体 {agent_id} 的变量 {var_name} 时出错: {str(e)}")
        raise

@mcp.tool()
def list_agent_vars(agent_id: int, include_private: bool = False) -> Dict[str, Any]:
    """列出智能体的所有变量

    Args:
        agent_id: 智能体ID
        include_private: 是否包含私有变量（默认为False）

    Returns:
        包含所有变量的字典，格式为 {变量名: 变量值}
    """
    # agent_id现在已经是整数类型，无需转换

    try:
        # 检查智能体是否存在
        agent = Agent.query.get(agent_id)
        if not agent:
            logger.error(f"智能体ID {agent_id} 不存在")
            return {"error": f"智能体ID {agent_id} 不存在", "status": "error"}

        # 获取所有变量
        query = AgentVariable.query.filter_by(agent_id=agent_id)
        if not include_private:
            query = query.filter_by(is_public=True)
        variables = query.all()

        result = {}
        for var in variables:
            # 直接返回字符串值，不进行类型转换
            result[var.name] = var.value

        return result
    except Exception as e:
        logger.error(f"列出智能体 {agent_id} 的所有变量时出错: {str(e)}")
        raise

#---------- 辅助函数 ----------#
# 由于只保留text类型，不再需要类型转换函数

#---------- MCPServerManager 兼容方法 ----------#

def get_tools() -> List[Dict]:
    """
    获取该MCP服务器提供的工具列表

    为了与MCPServerManager兼容，提供获取工具定义的方法

    Returns:
        List[Dict]: 工具定义列表
    """
    # 直接返回合并的工具定义列表，使用符合MCP标准的格式
    return ENV_VAR_TOOLS + AGENT_VAR_TOOLS

def handle_request(request_data: Dict) -> Dict:
    """
    处理MCP工具调用请求

    为了与MCPServerManager兼容，提供处理请求的方法

    Args:
        request_data: MCP请求数据

    Returns:
        Dict: MCP响应数据
    """
    try:
        # 从请求中提取工具名称和参数
        tool_name = request_data.get('name')
        tool_input = request_data.get('input', {})
        tool_use_id = request_data.get('id', 'unknown_id')

        if not tool_name:
            return {
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "is_error": True,
                "error": "缺少工具名称"
            }

        # 查找对应的工具函数
        tool_function = None
        for tool in [set_task_var, add_task_var, list_task_vars,
                    set_agent_var, add_agent_var, list_agent_vars]:
            if tool.__name__ == tool_name:
                tool_function = tool
                break

        if not tool_function:
            return {
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "is_error": True,
                "error": f"未找到工具: {tool_name}"
            }

        # 直接同步调用工具函数
        # 工具函数内部全部是同步 ORM 操作，无需 asyncio
        result = tool_function(**tool_input)

        # 检查结果是否包含错误信息
        if isinstance(result, dict) and ('error' in result or 'status' in result and result.get('status') == 'error'):
            return {
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "is_error": True,
                "error": result.get('error', '未知错误')
            }

        # 返回结果
        return {
            "type": "tool_result",
            "tool_use_id": tool_use_id,
            "content": result,
            "is_error": False
        }

    except Exception as e:
        logger.error(f"执行工具 {request_data.get('name')} 时出错: {str(e)}")
        return {
            "type": "tool_result",
            "tool_use_id": request_data.get('id', 'unknown_id'),
            "is_error": True,
            "error": f"工具执行错误: {str(e)}"
        }