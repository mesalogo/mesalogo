#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
计划管理 MCP 服务器

本模块使用 MCP 官方 SDK 实现计划管理服务器，提供智能体执行计划的创建、查询和更新功能。

核心工具（3个）：
- create_plan: 创建新的执行计划（含批量创建任务项）
- update_plan_item: 更新计划项状态（支持 pending/in_progress/completed/cancelled）
- get_plan: 获取计划详情（含进度统计）

设计理念：
- 简洁明了，智能体容易理解和使用
- 覆盖核心场景：创建计划 → 更新状态 → 查询进度
- update_plan_item 统一处理所有状态变更，无需额外的快捷工具
"""

import json
import logging
from typing import Dict, Any, List, Optional
from mcp.server.fastmcp import FastMCP
from app.models import ConversationPlan, ConversationPlanItem, Conversation, Agent
from app.extensions import db
from datetime import datetime
from app.utils.datetime_utils import get_current_time_with_timezone

# 设置日志
logger = logging.getLogger(__name__)

# 初始化 MCP 服务器
mcp = FastMCP("planner-server")

#---------- 计划管理工具定义 ----------#
PLANNER_TOOLS = [
    {
        "name": "create_plan",
        "description": "Create plan. Example: {conversation_id:\"x\",title:\"P\",items:[{title:\"T1\"}]}",
        "inputSchema": {
            "type": "object",
            "properties": {
                "conversation_id": {
                    "type": "string",
                    "description": "Conversation ID"
                },
                "title": {
                    "type": "string",
                    "description": "Plan title"
                },
                "description": {
                    "type": "string",
                    "description": "Plan description (optional)"
                },
                "items": {
                    "type": "array",
                    "description": "Task items, each must have title field",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "Task title"
                            },
                            "description": {
                                "type": "string",
                                "description": "Task description"
                            }
                        },
                        "required": ["title"]
                    }
                }
            },
            "required": ["conversation_id", "title", "items"]
        },
        "annotations": {
            "title": "Create Plan",
            "readOnlyHint": False,
            "destructiveHint": False,
            "idempotentHint": False,
            "openWorldHint": False
        }
    },
    {
        "name": "update_plan_item",
        "description": "Update item status. Example: {conversation_id:\"x\",item_id:\"y\",status:\"completed\"}",
        "inputSchema": {
            "type": "object",
            "properties": {
                "conversation_id": {
                    "type": "string",
                    "description": "Conversation ID"
                },
                "item_id": {
                    "type": "string",
                    "description": "Plan item ID"
                },
                "status": {
                    "type": "string",
                    "description": "New status",
                    "enum": ["pending", "completed"]
                }
            },
            "required": ["conversation_id", "item_id", "status"]
        },
        "annotations": {
            "title": "Update Plan Item",
            "readOnlyHint": False,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": False
        }
    },
    {
        "name": "get_plan",
        "description": "Get plan with items[{id,title,status}].",
        "inputSchema": {
            "type": "object",
            "properties": {
                "conversation_id": {
                    "type": "string",
                    "description": "Conversation ID"
                }
            },
            "required": ["conversation_id"]
        },
        "annotations": {
            "title": "Get Plan",
            "readOnlyHint": True,
            "openWorldHint": False
        }
    }
]

#---------- 工具实现 ----------#

@mcp.tool()
def create_plan(
    conversation_id: str,
    title: str,
    items: List[Dict[str, Any]],
    description: str = ""
) -> Dict[str, Any]:
    """
    创建新的执行计划
    
    Args:
        conversation_id: 会话ID
        title: 计划标题
        items: 任务项列表
        description: 计划描述
        
    Returns:
        包含计划信息的字典
    """
    try:
        logger.info(f"创建计划: conversation_id={conversation_id}, title={title}")
        
        # 检查是否已有活跃计划（一个会话只保留一个活跃计划）
        existing_plans = ConversationPlan.query.filter_by(
            conversation_id=conversation_id
        ).order_by(ConversationPlan.created_at.desc()).all()
        
        has_active_plan = False
        for existing_plan in existing_plans:
            # 检查是否有活跃计划（通过计算任务项状态）
            existing_items = ConversationPlanItem.query.filter_by(plan_id=existing_plan.id).all()
            if existing_items:
                total = len(existing_items)
                completed = sum(1 for item in existing_items if item.status == 'completed')
                # 如果不是全部完成，说明是活跃的
                if completed < total:
                    has_active_plan = True
                    logger.warning(f"会话已有活跃计划: {existing_plan.id}, 仍然创建新计划")
                    break
        
        # 创建计划
        plan = ConversationPlan(
            conversation_id=conversation_id,
            title=title,
            description=description,
            created_at=get_current_time_with_timezone(),
            updated_at=get_current_time_with_timezone()
        )
        db.session.add(plan)
        db.session.flush()  # 获取 plan.id
        
        # 创建计划项
        plan_items = []
        for idx, item_data in enumerate(items):
            item = ConversationPlanItem(
                plan_id=plan.id,
                title=item_data.get('title', item_data.get('id', f'Task {idx+1}')),
                description=item_data.get('description', ''),
                status='pending',
                order_index=idx,
                created_at=get_current_time_with_timezone(),
                updated_at=get_current_time_with_timezone()
            )
            db.session.add(item)
            plan_items.append(item)
        
        db.session.commit()
        
        # 刷新对象以获取最新数据
        db.session.refresh(plan)
        
        # 获取完整的计划数据（包含进度信息）
        plan_dict = plan.to_dict(include_items=True, include_progress=True)
        
        # 构建响应
        result = {
            "success": True,
            "plan": plan_dict,
            "message": f"执行计划 '{title}' 创建成功，包含 {len(plan_items)} 个任务项",
            # 添加事件类型供 SSE 推送使用
            "_event_type": "planCreated",
            "_event_data": {
                "planId": plan.id,
                "plan": plan_dict
            }
        }
        
        logger.info(f"计划创建成功: plan_id={plan.id}")
        return result
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"创建计划失败: {str(e)}")
        return {
            "success": False,
            "error": f"创建计划失败: {str(e)}"
        }


@mcp.tool()
def update_plan_item(
    conversation_id: str,
    item_id: str,
    status: str
) -> Dict[str, Any]:
    """
    更新计划项状态
    
    Args:
        conversation_id: 会话ID
        item_id: 计划项ID
        status: 新状态
        
    Returns:
        操作结果
    """
    try:
        logger.info(f"更新计划项: item_id={item_id}, status={status}")
        
        # 验证状态值
        valid_statuses = ['pending', 'completed']
        if status not in valid_statuses:
            return {
                "success": False,
                "error": f"无效的状态值: {status}，有效值为: {', '.join(valid_statuses)}"
            }
        
        # 查找计划项
        item = ConversationPlanItem.query.get(item_id)
        
        if not item:
            return {
                "success": False,
                "error": f"计划项不存在: item_id={item_id}"
            }
        
        # 验证计划属于该会话
        plan = item.plan
        if not plan or plan.conversation_id != conversation_id:
            return {
                "success": False,
                "error": f"计划不属于该会话: conversation_id={conversation_id}"
            }
        
        old_status = item.status
        
        # 更新状态
        item.status = status
        item.updated_at = get_current_time_with_timezone()
        
        # 更新计划的最后更新时间
        plan.updated_at = get_current_time_with_timezone()
        
        db.session.commit()
        
        # 刷新对象以获取最新数据
        db.session.refresh(item)
        db.session.refresh(plan)
        
        # 获取更新后的计划项和计划状态
        item_dict = item.to_dict(include_plan=False)
        plan_dict = plan.to_dict(include_items=False, include_progress=True)
        plan_status = plan_dict.get('status', 'active')
        
        return {
            "success": True,
            "message": f"计划项 '{item.title}' 状态已更新: {old_status} -> {status}",
            "item": item_dict,
            # 添加事件类型供 SSE 推送使用
            "_event_type": "planItemUpdated",
            "_event_data": {
                "planId": plan.id,
                "itemId": item.id,
                "status": item.status,
                "planStatus": plan_status,
                "item": item_dict
            }
        }
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"更新计划项失败: {str(e)}")
        return {
            "success": False,
            "error": f"更新计划项失败: {str(e)}"
        }


@mcp.tool()
def get_plan(
    conversation_id: str
) -> Dict[str, Any]:
    """
    获取当前会话的活跃计划详情
    
    Args:
        conversation_id: 会话ID
        
    Returns:
        计划详情
    """
    try:
        logger.info(f"获取计划: conversation_id={conversation_id}")
        
        # 查找所有计划，按创建时间倒序
        plans = ConversationPlan.query.filter_by(
            conversation_id=conversation_id
        ).order_by(ConversationPlan.created_at.desc()).all()
        
        if not plans:
            return {
                "success": False,
                "error": "未找到计划"
            }
        
        # 找到第一个活跃的计划（status != 'completed' and != 'cancelled'）
        plan = None
        for p in plans:
            # 获取计划项来计算状态
            temp_items = ConversationPlanItem.query.filter_by(plan_id=p.id).all()
            if not temp_items:
                plan = p
                break
            
            total_items = len(temp_items)
            completed_items = sum(1 for item in temp_items if item.status == 'completed')
            cancelled_items = sum(1 for item in temp_items if item.status == 'cancelled')
            
            # 如果不是全部完成或全部取消，就是活跃的
            if completed_items < total_items and cancelled_items < total_items:
                plan = p
                break
        
        # 如果没有活跃计划，返回最新的计划
        if not plan:
            plan = plans[0]
        
        # 使用模型的 to_dict() 方法获取完整数据（包含实时计算的状态和进度）
        plan_dict = plan.to_dict(include_items=True, include_progress=True)
        
        result = {
            "success": True,
            "plan": plan_dict,
            "message": f"计划 '{plan.title}' 包含 {plan_dict.get('total_count', 0)} 个任务项，已完成 {plan_dict.get('completed_count', 0)} 个"
        }
        
        return result
        
    except Exception as e:
        logger.error(f"获取计划失败: {str(e)}")
        return {
            "success": False,
            "error": f"获取计划失败: {str(e)}"
        }





def get_tools_list():
    """返回工具列表供外部使用"""
    return PLANNER_TOOLS


def handle_request(request_data: Dict) -> Dict:
    """
    处理 MCP 工具调用请求
    
    为了与 MCPServerManager 兼容，提供处理请求的方法
    
    Args:
        request_data: MCP 请求数据
        
    Returns:
        Dict: MCP 响应数据
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
        for tool in [create_plan, update_plan_item, get_plan]:
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
        
        # 执行工具函数
        result = tool_function(**tool_input)
        
        # 检查是否执行成功
        if isinstance(result, dict) and not result.get('success', False):
            return {
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "is_error": True,
                "error": result.get('error', '未知错误')
            }
        
        # 返回成功响应
        return {
            "type": "tool_result",
            "tool_use_id": tool_use_id,
            "content": result
        }
            
    except Exception as e:
        logger.error(f"处理 planner 工具请求失败: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            "type": "tool_result",
            "tool_use_id": request_data.get('id', 'unknown_id'),
            "is_error": True,
            "error": f"工具执行失败: {str(e)}"
        }
