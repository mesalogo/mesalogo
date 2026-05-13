"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: agent_variables.py
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
# Source: agent_variables.py
# ============================================================

"""
代理变量API路由

处理与代理变量相关的所有API请求
"""
from app.services.agent_variable_service import AgentVariableService
from app.models import Agent
from app.extensions import db
from app.mcp_servers.variables_server import AGENT_VAR_TOOLS  # 从变量服务器导入智能体变量工具定义
import logging
import json
from datetime import datetime
# werkzeug.exceptions 已移除，使用 FastAPI HTTPException
from typing import Dict, Any, List

# 创建Blueprint

# 设置日志
logger = logging.getLogger(__name__)

# MCP工具定义 - 工具已经是MCP标准格式
MCP_AGENT_TOOLS = AGENT_VAR_TOOLS  # 使用从variables_server导入的工具定义

# MCP工具执行函数
def execute_get_agent_var(input_data):
    """MCP工具：获取智能体变量"""
    agent_id = input_data.get('agent_id')
    var_name = input_data.get('var_name')

    # 确保agent_id是整数
    if isinstance(agent_id, str) and agent_id.isdigit():
        agent_id = int(agent_id)

    try:
        # 获取变量
        var_value = AgentVariableService.get_variable_value(agent_id, var_name)
        return var_value
    except Exception as e:
        logger.error(f"获取智能体 {agent_id} 的变量 {var_name} 时出错: {str(e)}")
        raise

def execute_set_agent_var(input_data):
    """MCP工具：设置智能体变量"""
    agent_id = input_data.get('agent_id')
    var_name = input_data.get('var_name')
    var_value = input_data.get('var_value')

    # 确保agent_id是整数
    if isinstance(agent_id, str) and agent_id.isdigit():
        agent_id = int(agent_id)

    try:
        # 检查变量是否存在
        variable = AgentVariableService.get_variable(agent_id, var_name)

        if variable:
            # 更新已存在的变量
            AgentVariableService.update_variable(agent_id, var_name, var_value)
        else:
            # 创建新变量，类型固定为text
            AgentVariableService.create_variable(
                agent_id=agent_id,
                name=var_name,
                value=str(var_value),
                type='text',
                is_public=True
            )

        return var_value
    except Exception as e:
        logger.error(f"设置智能体 {agent_id} 的变量 {var_name} 时出错: {str(e)}")
        raise

def execute_list_agent_vars(input_data):
    """MCP工具：列出智能体的所有变量"""
    agent_id = input_data.get('agent_id')

    # 确保agent_id是整数
    if isinstance(agent_id, str) and agent_id.isdigit():
        agent_id = int(agent_id)

    try:
        # 获取所有变量
        variables = AgentVariableService.get_agent_variables(agent_id, include_private=True)

        result = {}
        for var in variables:
            # 直接返回字符串值，不进行类型转换
            result[var.name] = var.value

        return result
    except Exception as e:
        logger.error(f"列出智能体 {agent_id} 的所有变量时出错: {str(e)}")
        raise

# MCP工具名称到执行函数的映射
TOOL_EXECUTORS = {
    'get_agent_var': execute_get_agent_var,
    'set_agent_var': execute_set_agent_var,
    'list_agent_vars': execute_list_agent_vars
}

@router.get('/agents/{agent_id}/variables')
def get_agent_variables(agent_id, request: Request):
    """获取代理的所有变量"""
    # 检查代理是否存在
    agent = Agent.query.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail={'error': f'代理ID {agent_id} 不存在'})

    # 获取是否包含私有变量的参数
    include_private = request.query_params.get('include_private', 'false').lower() == 'true'

    # 获取变量列表
    variables = AgentVariableService.get_agent_variables(agent_id, include_private)

    # 转换为JSON格式
    result = []
    for var in variables:
        result.append({
            'id': var.id,
            'name': var.name,
            'value': var.value,  # 直接返回字符串值
            'is_public': var.is_public,
            'created_at': var.created_at.isoformat() if var.created_at else None,
            'updated_at': var.updated_at.isoformat() if var.updated_at else None
        })

    return {'variables': result}

@router.get('/agents/{agent_id}/variables/{name}')
def get_agent_variable(agent_id, name):
    """获取代理的指定变量"""
    # 检查代理是否存在
    agent = Agent.query.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail={'error': f'代理ID {agent_id} 不存在'})

    # 获取变量
    variable = AgentVariableService.get_variable(agent_id, name)
    if not variable:
        raise HTTPException(status_code=404, detail={'error': f'变量 {name} 不存在'})

    # 如果变量是私有的且不是请求者代理的，则返回错误
    # 这里需要添加权限检查逻辑，暂时简化处理

    # 转换为JSON格式
    result = {
        'id': variable.id,
        'name': variable.name,
        'value': variable.value,  # 直接返回字符串值
        'is_public': variable.is_public,
        'history': variable.history,
        'created_at': variable.created_at.isoformat() if variable.created_at else None,
        'updated_at': variable.updated_at.isoformat() if variable.updated_at else None
    }

    return result

@router.post('/agents/{agent_id}/variables')
async def create_agent_variable(agent_id, request: Request):
    """创建代理变量"""
    # 检查代理是否存在
    agent = Agent.query.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail={'error': f'代理ID {agent_id} 不存在'})

    # 获取请求数据
    data = await request.json()
    if not data:
        raise HTTPException(status_code=400, detail={'error': '请求数据不能为空'})

    # 验证必要字段
    required_fields = ['name', 'value', 'type']
    for field in required_fields:
        if field not in data:
            raise HTTPException(status_code=400, detail={'error': f'缺少必要字段 {field}'})

    # 创建变量
    try:
        variable = AgentVariableService.create_variable(
            agent_id=agent_id,
            name=data['name'],
            value=data['value'],
            type=data['type'],
            is_public=data.get('is_public', True)
        )

        # 返回创建的变量
        result = {
            'id': variable.id,
            'name': variable.name,
            'value': variable.value,  # 直接返回字符串值
            'is_public': variable.is_public,
            'created_at': variable.created_at.isoformat() if variable.created_at else None,
            'updated_at': variable.updated_at.isoformat() if variable.updated_at else None
        }

        return JSONResponse(content=result, status_code=201)
    except ValueError as e:
        raise HTTPException(status_code=400, detail={'error': str(e)})
    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'创建变量失败: {str(e)}'})

@router.put('/agents/{agent_id}/variables/{name}')
async def update_agent_variable(agent_id, name, request: Request):
    """更新代理变量"""
    # 检查代理是否存在
    agent = Agent.query.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail={'error': f'代理ID {agent_id} 不存在'})

    # 获取请求数据
    data = await request.json()
    if not data:
        raise HTTPException(status_code=400, detail={'error': '请求数据不能为空'})

    # 验证必要字段
    if 'value' not in data:
        raise HTTPException(status_code=400, detail={'error': '缺少必要字段 value'})

    # 更新变量
    try:
        variable = AgentVariableService.update_variable(
            agent_id=agent_id,
            name=name,
            value=data['value']
        )

        # 返回更新后的变量
        result = {
            'id': variable.id,
            'name': variable.name,
            'value': variable.value,  # 直接返回字符串值
            'is_public': variable.is_public,
            'created_at': variable.created_at.isoformat() if variable.created_at else None,
            'updated_at': variable.updated_at.isoformat() if variable.updated_at else None
        }

        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail={'error': str(e)})
    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'更新变量失败: {str(e)}'})

@router.delete('/agents/{agent_id}/variables/{name}')
def delete_agent_variable(agent_id, name):
    """删除代理变量"""
    # 检查代理是否存在
    agent = Agent.query.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail={'error': f'代理ID {agent_id} 不存在'})

    # 删除变量
    result = AgentVariableService.delete_variable(agent_id, name)

    if result:
        return JSONResponse(content={'message': f'变量 {name} 已删除'}, status_code=200)
    else:
        raise HTTPException(status_code=404, detail={'error': f'变量 {name} 不存在'})

@router.get('/agents/{agent_id}/variables/{name}/history')
def get_variable_history(agent_id, name):
    """获取变量的历史记录"""
    # 检查代理是否存在
    agent = Agent.query.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail={'error': f'代理ID {agent_id} 不存在'})

    # 获取变量
    variable = AgentVariableService.get_variable(agent_id, name)
    if not variable:
        raise HTTPException(status_code=404, detail={'error': f'变量 {name} 不存在'})

    # 返回历史记录
    return {'history': variable.history or []}

@router.post('/mcp/agent-vars')
async def mcp_agent_variables(request: Request):
    """
    MCP协议智能体变量服务端点

    这个端点实现了MCP协议的服务器功能，可以接收并响应MCP工具调用请求。
    当客户端第一次请求时，返回工具定义；后续请求处理特定的工具调用。

    示例：
        1. 首次请求返回工具定义
        2. 后续请求接收并处理工具调用，返回结果
    """
    try:
        # 检查是否是初始连接请求（应该是空POST请求）
        body = await request.body()
        if not body:
            # 返回工具定义
            return JSONResponse(content=MCP_AGENT_TOOLS, status_code=200)

        # 解析工具调用请求
        try:
            request_data = await request.json()
        except:
            raise HTTPException(status_code=400, detail={
                "is_error": True,
                "error": "无效的JSON请求数据"
            })

        # 验证请求格式
        if not isinstance(request_data, dict):
            raise HTTPException(status_code=400, detail={
                "is_error": True,
                "error": "请求应为JSON对象"
            })

        tool_name = request_data.get('name')
        tool_input = request_data.get('input', {})
        tool_use_id = request_data.get('id', 'unknown_id')

        if not tool_name:
            raise HTTPException(status_code=400, detail={
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "is_error": True,
                "error": "缺少工具名称"
            })

        # 检查工具是否存在
        if tool_name not in TOOL_EXECUTORS:
            return JSONResponse(content={
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "is_error": True,
                "error": f"未知工具: {tool_name}"
            }, status_code=404)

        # 执行工具
        try:
            executor = TOOL_EXECUTORS[tool_name]
            result = executor(tool_input)

            # 返回MCP格式的结果
            return JSONResponse(content={
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "content": result,
                "is_error": False
            }, status_code=200)
        except Exception as e:
            logger.error(f"执行工具 {tool_name} 时出错: {str(e)}")
            return JSONResponse(content={
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "is_error": True,
                "error": f"工具执行错误: {str(e)}"
            }, status_code=500)

    except Exception as e:
        logger.error(f"MCP处理请求时出错: {str(e)}")
        return JSONResponse(content={
            "is_error": True,
            "error": f"服务器错误: {str(e)}"
        }, status_code=500)
