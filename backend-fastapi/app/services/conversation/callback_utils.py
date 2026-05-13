"""
会话回调工具模块

提供统一的SSE回调函数实现，避免代码重复

函数说明:
---------------------------------------

* create_standard_sse_callback - 创建标准的SSE回调函数
  - streaming: 是否启用流式模式
  - result_queue: 结果队列，用于流式处理
  - 返回: sse_callback函数

该模块提取了auto_conversation.py和variable_stop_conversation.py中
完全相同的sse_callback实现，确保两个模块使用相同的回调逻辑。
"""

import json
import logging

logger = logging.getLogger(__name__)


def create_standard_sse_callback(streaming: bool, result_queue):
    """
    创建标准的SSE回调函数
    
    这个函数提取了auto_conversation和variable_stop_conversation中
    完全相同的sse_callback实现，避免代码重复。
    
    Args:
        streaming: 是否启用流式模式
        result_queue: 结果队列，用于流式处理
        
    Returns:
        function: sse_callback函数，用于处理流式响应
    """
    def sse_callback(content):
        """
        SSE回调函数，处理流式响应内容
        
        Args:
            content: 响应内容，可以是字符串或字典
        """
        if not streaming or not result_queue:
            return

        # 如果content是字典，则可能是事件（如agentInfo）
        if isinstance(content, dict):
            # 处理agentInfo类型的消息
            if content.get('type') == 'agentInfo' and 'meta' in content:
                # 将meta内容提取到外层，避免嵌套
                content_copy = content.copy()
                meta_content = content_copy.pop('meta')
                # 合并meta内容到外层
                content_copy.update(meta_content)
                # 发送新格式的消息
                result_queue.put(json.dumps({
                    'content': None,
                    'meta': content_copy
                }))
            # 特殊情况1：如果字典中有content字段且是字符串
            elif 'content' in content and isinstance(content['content'], str):
                # 将字典中的content取出作为主要内容，其余信息放入meta
                text_content = content.pop('content')
                result_queue.put(json.dumps({
                    'content': text_content,
                    'meta': content  # 其他字段作为meta信息
                }))
            # 特殊情况2：连接状态和其他事件信息
            else:
                # 将整个字典放入meta字段，保持与普通流式响应格式一致
                result_queue.put(json.dumps({
                    'content': None,
                    'meta': content
                }))
        # 如果content是字符串，则是文本内容
        elif isinstance(content, str):
            # 使用与普通流式响应完全一致的格式
            result_queue.put(json.dumps({
                'content': content,
                'meta': None
            }))
    
    return sse_callback


def create_agent_info_event(agent_name: str, role_name: str, agent_id: str, 
                           turn_prompt: str, round_num: int, total_rounds: int,
                           response_order: int, total_agents: int, **kwargs):
    """
    创建标准的agentInfo事件
    
    Args:
        agent_name: 智能体名称
        role_name: 角色名称
        agent_id: 智能体ID
        turn_prompt: 轮次提示文本
        round_num: 当前轮次
        total_rounds: 总轮次
        response_order: 响应顺序
        total_agents: 总智能体数
        **kwargs: 其他可选字段（如isPlanning, isSummarizing等）
        
    Returns:
        dict: 标准格式的agentInfo事件
    """
    event = {
        "type": "agentInfo",
        "turnPrompt": turn_prompt,
        "agentId": str(agent_id),
        "agentName": f"{agent_name}({role_name})",
        "round": round_num,
        "totalRounds": total_rounds,
        "responseOrder": response_order,
        "totalAgents": total_agents
    }
    
    # 添加可选字段
    for key, value in kwargs.items():
        event[key] = value
    
    return event


def format_stop_conditions(stop_conditions: list, condition_logic: str = "and") -> str:
    """
    将停止条件列表转换为人类可读的描述
    
    Args:
        stop_conditions: 停止条件列表，每个条件格式为:
            {
                "type": "environment" | "external" | "agent",  # 变量类型
                "variable": "variable_name",  # 变量名称
                "operator": "==" | "!=" | ">" | "<" | ">=" | "<=",  # 操作符
                "value": "..."  # 比较值
            }
        condition_logic: 条件逻辑 ("and" 或 "or")
        
    Returns:
        str: 人类可读的停止条件描述
    """
    if not stop_conditions:
        return ""
    
    operator_map = {
        "==": "等于",
        "=": "等于",
        "!=": "不等于",
        ">": "大于",
        "<": "小于",
        ">=": "大于等于",
        "<=": "小于等于",
        "contains": "包含",
        "not_contains": "不包含",
        "equals": "等于",
        "not_equals": "不等于",
        "greater_than": "大于",
        "less_than": "小于",
        "changed": "发生变化"
    }
    
    type_map = {
        "environment": "任务变量",
        "external": "外部变量",
        "agent": "智能体变量"
    }
    
    conditions_desc = []
    for cond in stop_conditions:
        # 获取变量名称，支持多种字段名
        var_name = cond.get("variable_name") or cond.get("variable") or cond.get("name") or ""
        var_type = cond.get("variable_type") or cond.get("type", "environment")
        operator = cond.get("operator", "==")
        value = cond.get("value", "")
        
        op_desc = operator_map.get(operator, operator)
        type_desc = type_map.get(var_type, var_type)
        
        # 确保变量名不为空
        if not var_name:
            var_name = "(未指定)"
        
        if operator == "changed":
            conditions_desc.append(f"{type_desc}「{var_name}」{op_desc}")
        else:
            conditions_desc.append(f"{type_desc}「{var_name}」{op_desc}「{value}」")
    
    logic_desc = "同时满足" if condition_logic == "and" else "满足任一"
    return f"停止条件（{logic_desc}）：" + "；".join(conditions_desc)


def create_summary_prompt(agent_name: str, topic: str):
    """
    创建标准的总结提示词
    
    Args:
        agent_name: 智能体名称
        topic: 任务主题
        
    Returns:
        str: 格式化的总结提示词
    """
    return f"<div style='color: #A0A0A0;'>@{agent_name} 请根据上面的行动内容，详细总结所有观点和结论，突出重点和共识，以及存在的分歧。请将总结记录到共享工作区中，并将最终结论写入任务结论中。\n任务主题：{topic}</div>\n"


def create_action_prompt(agent_name: str, topic: str, round_num: int, total_rounds: int, 
                        response_order: int, is_first_action: bool = False, enable_planning: bool = False,
                        stop_conditions: list = None, condition_logic: str = "and"):
    """
    创建标准的行动提示词
    
    Args:
        agent_name: 智能体名称
        topic: 任务主题
        round_num: 当前轮次
        total_rounds: 总轮次（变量停止模式可以传999表示无限制）
        response_order: 响应顺序
        is_first_action: 是否是第一个行动者
        enable_planning: 是否已启用独立计划阶段
        stop_conditions: 停止条件列表（用于variable_stop模式）
        condition_logic: 条件逻辑 ("and" 或 "or")
        
    Returns:
        str: 格式化的行动提示词
    """
    # 变量停止模式下的停止条件文本
    conditions_hint = ""
    if total_rounds == 999 and stop_conditions:
        conditions_hint = f"\n{format_stop_conditions(stop_conditions, condition_logic)}"
    
    if is_first_action:
        if enable_planning:
            # 如果已启用计划功能，提示参考已有计划
            return f"<div style='color: #A0A0A0;'>@{agent_name} 你是任务的第一个行动者，请参考共享工作区中计划智能体制定的计划，开始执行你的任务。有任何进展请更新共享工作区。\n任务主题：{topic}{conditions_hint}</div>\n"
        else:
            # 如果未启用计划功能，直接开始执行任务
            return f"<div style='color: #A0A0A0;'>@{agent_name} 你是任务的第一个行动者，请就任务主题开始你的任务。有任何进展请更新共享工作区。\n任务主题：{topic}{conditions_hint}</div>\n"
    else:
        if total_rounds == 999:  # 变量停止模式
            return f"<div style='color: #A0A0A0;'>@{agent_name} 请你基于之前的信息，继续执行你的任务。你是该任务中的第{round_num}轮行动的第{response_order}个行动者。任务将在满足停止条件时自动终止。有任何进展请更新共享工作区。\n任务主题：{topic}{conditions_hint}</div>\n"
        else:  # 固定轮数模式
            return f"<div style='color: #A0A0A0;'>@{agent_name} 请你基于之前的信息，继续执行你的任务。你是该任务中的第{round_num}（共计{total_rounds}轮）轮行动的第{response_order}个行动者。有任何进展请更新共享工作区。\n任务主题：{topic}</div>\n"
