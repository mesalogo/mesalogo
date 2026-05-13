"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: environment_variables.py
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
# Source: environment_variables.py
# ============================================================

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
环境变量MCP Server API路由模块
允许通过标准HTTP接口以及MCP协议访问和管理环境变量。
环境变量属于特定任务，不存在全局环境变量。
"""

import json
import logging
from sqlalchemy.exc import SQLAlchemyError
from app.extensions import db
from app.models import ActionTaskEnvironmentVariable, ActionTask
from app.mcp_servers.variables_server import ENV_VAR_TOOLS  # 从变量服务器导入环境变量工具定义
from datetime import datetime
# werkzeug.exceptions 已移除，使用 FastAPI HTTPException
from typing import Dict, Any, List
import traceback

# 创建蓝图

# 设置日志
logger = logging.getLogger(__name__)

# MCP工具定义 - 工具已经是MCP标准格式
MCP_TOOLS = ENV_VAR_TOOLS  # 使用从variables_server导入的工具定义

#---------- 工具实现函数 ----------#

def execute_get_task_var(input_data):
    """获取任务环境变量"""
    task_id = input_data.get('task_id')
    var_name = input_data.get('var_name')
    
    # 确保task_id是整数
    if isinstance(task_id, str) and task_id.isdigit():
        task_id = int(task_id)
    
    try:
        # 查询数据库中的任务变量
        env_var = ActionTaskEnvironmentVariable.query.filter_by(
            action_task_id=task_id,
            name=var_name
        ).first()
        
        if env_var:
            try:
                # 尝试解析JSON值
                return json.loads(env_var.value)
            except (TypeError, json.JSONDecodeError):
                # 如果不是JSON，则直接返回原始值
                return env_var.value
        
        return None
    except Exception as e:
        logger.error(f"获取任务 {task_id} 的变量 {var_name} 时出错: {str(e)}")
        raise

def execute_set_task_var(input_data):
    """设置任务环境变量"""
    task_id = input_data.get('task_id')
    var_name = input_data.get('var_name')
    var_value = input_data.get('var_value')
    
    # 确保task_id是整数
    if isinstance(task_id, str) and task_id.isdigit():
        task_id = int(task_id)
    
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

        # 更新行动任务的updated_at时间
        from app.utils.datetime_utils import get_current_time_with_timezone
        task.updated_at = get_current_time_with_timezone()

        db.session.commit()
        return var_value
    except Exception as e:
        db.session.rollback()
        logger.error(f"设置任务 {task_id} 的变量 {var_name} 时出错: {str(e)}")
        raise

def execute_list_task_vars(input_data):
    """列出任务的所有环境变量"""
    task_id = input_data.get('task_id')
    
    # 确保task_id是整数
    if isinstance(task_id, str) and task_id.isdigit():
        task_id = int(task_id)
    
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

# 工具名称到执行函数的映射
TOOL_EXECUTORS = {
    'get_task_var': execute_get_task_var,
    'set_task_var': execute_set_task_var,
    'list_task_vars': execute_list_task_vars
}

#---------- REST API路由 ----------#

@router.get('/environment-variables/tasks/{task_id}')
def get_task_vars(task_id):
    """获取任务的所有环境变量"""
    try:
        result = execute_list_task_vars({"task_id": task_id})
        return JSONResponse(content=result, status_code=200)
    except ValueError as e:
        raise HTTPException(status_code=404, detail={"error": str(e)})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e)})

@router.get('/environment-variables/tasks/{task_id}/{var_name}')
def get_task_var_api(task_id, var_name):
    """获取任务的特定环境变量"""
    try:
        result = execute_get_task_var({"task_id": task_id, "var_name": var_name})
        if result is None:
            raise HTTPException(status_code=404, detail={"error": f"任务 {task_id} 的变量 {var_name} 不存在"})
        return JSONResponse(content={"name": var_name, "value": result}, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e)})

@router.put('/environment-variables/tasks/{task_id}/{var_name}')
async def set_task_var_api(task_id, var_name, request: Request):
    """设置任务的环境变量"""
    try:
        data = await request.json()
        var_value = data.get('value')
        result = execute_set_task_var({
            "task_id": task_id,
            "var_name": var_name,
            "var_value": var_value
        })
        return JSONResponse(content={"name": var_name, "value": result}, status_code=200)
    except ValueError as e:
        raise HTTPException(status_code=404, detail={"error": str(e)})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e)})

#---------- MCP协议实现 ----------#

@router.post('/mcp/env-vars')
async def mcp_environment_variables(request: Request):
    """
    MCP协议环境变量服务端点
    
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
            return JSONResponse(content=MCP_TOOLS, status_code=200)
        
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
