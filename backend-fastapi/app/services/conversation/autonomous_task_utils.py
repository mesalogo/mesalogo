"""
自主任务工具模块

提供自主任务模式的共享工具函数，减少代码重复，提高维护性。
包含应用上下文处理、智能体验证、任务记录创建等通用功能。

作者：ABM-LLM系统
创建时间：2025-01-20
"""

import json
import logging
from typing import Dict, List, Any, Optional, Callable
from app import db
from app.models import (
    Conversation, ConversationAgent, Agent, Message, ActionTask,
    AutonomousTask, AutonomousTaskExecution, User
)
from app.utils.datetime_utils import get_current_time_with_timezone

logger = logging.getLogger(__name__)

def execute_planning_phase(
    task_id: int,
    conversation_id: int,
    conv_agents: List[ConversationAgent],
    planner_agent_id: Optional[int],
    topic: str,
    total_rounds: int,
    streaming: bool,
    sse_callback: Callable,
    mode_description: str = "自主行动",
    stop_conditions: List[Dict] = None,
    condition_logic: str = "and"
) -> bool:
    """
    执行计划阶段 - 所有自主任务模式的统一计划功能
    
    该函数从 auto_conversation.py 提取，供所有自主任务模式使用。
    计划智能体将制定详细计划并写入共享工作区，供其他智能体参考。
    
    Args:
        task_id: 行动任务ID
        conversation_id: 会话ID
        conv_agents: 会话智能体列表
        planner_agent_id: 指定的计划智能体ID，None则使用第一个智能体
        topic: 任务主题
        total_rounds: 总轮数（999表示无限轮数）
        streaming: 是否流式输出
        sse_callback: SSE回调函数
        mode_description: 模式描述，用于生成提示词（如"5轮自主行动"、"变量停止模式自主行动"）
        stop_conditions: 停止条件列表（用于变量停止模式）
        condition_logic: 条件逻辑 ("and" 或 "or")
    
    Returns:
        bool: 是否成功执行计划阶段
    
    Example:
        # 固定轮数模式
        success = execute_planning_phase(
            task_id, conversation_id, conv_agents,
            planner_agent_id, topic, rounds=5,
            streaming, sse_callback,
            mode_description="5轮自主行动"
        )
        
        # 无限轮数模式（变量停止）
        success = execute_planning_phase(
            task_id, conversation_id, conv_agents,
            planner_agent_id, topic, rounds=999,
            streaming, sse_callback,
            mode_description="变量停止模式自主行动",
            stop_conditions=[{"variable_name": "task_done", "operator": "==", "value": "true"}],
            condition_logic="and"
        )
    """
    try:
        # 确定计划智能体
        planner_agent = None
        if planner_agent_id:
            planner_agent = Agent.query.get(planner_agent_id)

        if not planner_agent:
            # 使用第一个智能体作为计划者
            planner_agent = Agent.query.get(conv_agents[0].agent_id) if conv_agents else None

        if not planner_agent:
            logger.warning("无法确定计划智能体，跳过计划阶段")
            return False

        logger.info(f"开始计划阶段，计划智能体: {planner_agent.name}")

        # 创建计划提示词
        # 根据轮数决定描述方式
        if total_rounds == 999:
            rounds_desc = "持续的"
        else:
            rounds_desc = f"{total_rounds}轮"
        
        # 生成停止条件文本（用于变量停止模式）
        conditions_text = ""
        if total_rounds == 999 and stop_conditions:
            from app.services.conversation.callback_utils import format_stop_conditions
            conditions_text = f"\n\n{format_stop_conditions(stop_conditions, condition_logic)}\n任务将在满足上述停止条件时自动终止。"
        
        planning_prompt = (
            f"<div style='color: #A0A0A0;'>@{planner_agent.name} "
            f"请为即将开始的{rounds_desc}{mode_description}制定详细计划。\n\n"
            f"**重要**：请使用 create_plan 工具创建结构化的执行计划。\n"
            f"计划应该包含具体的、可执行的任务项，每个任务项应该：\n"
            f"1. 标题简洁明确\n"
            f"2. 描述具体要做什么、达到什么目标\n"
            f"3. 可以独立验证完成情况\n\n"
            f"任务主题：{topic}{conditions_text}\n\n"
            f"请使用 create_plan 工具创建执行计划（conversation_id 请从系统提示中复制）</div>\n"
        )

        # 通知用户计划阶段开始
        from app.models import Role
        agent_role = Role.query.get(planner_agent.role_id) if hasattr(planner_agent, 'role_id') and planner_agent.role_id else None
        role_name = agent_role.name if agent_role else "智能助手"
        
        sse_callback({
            "type": "agentInfo",
            "turnPrompt": f"由智能体 {planner_agent.name}({role_name}) 制定计划",
            "agentId": str(planner_agent.id),
            "agentName": f"{planner_agent.name}({role_name})",
            "round": 0,  # 计划阶段在正式轮次之前
            "totalRounds": total_rounds,
            "responseOrder": 1,
            "totalAgents": 1,
            "isPlanning": True
        })

        # 处理计划
        from app.services.conversation_service import ConversationService
        response_completed, error_info = ConversationService._process_single_agent_response(
            task_id=task_id,
            conversation_id=conversation_id,
            human_message=None,  # 虚拟消息
            agent_id=planner_agent.id,
            content=planning_prompt,
            sse_callback=sse_callback,
            result_queue=None
        )

        if not response_completed:
            logger.warning(f"计划阶段失败: {error_info}")
            return False

        logger.info(f"计划阶段完成，开始正式{mode_description}")
        return True

    except Exception as e:
        logger.error(f"执行计划阶段时出错: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def handle_app_context_execution(func: Callable, streaming: bool = False, 
                                app_context = None, *args, **kwargs) -> Any:
    """
    统一处理应用上下文的执行
    
    Note: In FastAPI with scoped_session, app_context is no longer needed.
    This function now simply calls func directly.
    
    Args:
        func: 要执行的函数
        streaming: 是否为流式模式
        app_context: 应用上下文 (ignored, kept for API compatibility)
        *args: 函数参数
        **kwargs: 函数关键字参数
    
    Returns:
        函数执行结果
    """
    return func(*args, **kwargs)

def validate_conversation_agents(conversation_id: int, task_name: str = "自主任务") -> List[ConversationAgent]:
    """
    验证会话中的智能体
    
    Args:
        conversation_id: 会话ID
        task_name: 任务名称，用于错误消息
    
    Returns:
        List[ConversationAgent]: 有效的智能体列表
        
    Raises:
        ValueError: 当没有可用智能体时
    """
    try:
        # 获取会话中的所有非监督者智能体
        conv_agents = ConversationAgent.query.join(Agent).filter(
            ConversationAgent.conversation_id == conversation_id,
            Agent.is_observer == False  # 过滤掉监督者智能体
        ).all()

        if not conv_agents or len(conv_agents) < 1:
            error_msg = f"会话中没有可用的任务智能体（监督者智能体不参与{task_name}）: {conversation_id}"
            logger.error(error_msg)
            raise ValueError(error_msg)

        # 按ID排序智能体，确保顺序一致
        conv_agents.sort(key=lambda ca: ca.id)
        
        logger.info(f"验证通过，找到 {len(conv_agents)} 个可用智能体")
        return conv_agents

    except Exception as e:
        if isinstance(e, ValueError):
            raise
        logger.error(f"验证会话智能体时出错: {str(e)}")
        raise ValueError(f"验证会话智能体失败: {str(e)}")

def create_autonomous_task_records(conversation_id: int, task_type: str, 
                                 config: Dict[str, Any]) -> tuple[AutonomousTask, AutonomousTaskExecution]:
    """
    创建自主任务记录
    
    Args:
        conversation_id: 会话ID
        task_type: 任务类型 (discussion, variable_trigger, time_trigger, conditional_stop, autonomous_scheduling)
        config: 任务配置
    
    Returns:
        tuple: (AutonomousTask, AutonomousTaskExecution) 任务记录和执行记录
    """
    try:
        # 创建自主任务记录
        autonomous_task = AutonomousTask(
            conversation_id=conversation_id,
            type=task_type,
            status='active',
            config=config
        )
        db.session.add(autonomous_task)
        db.session.flush()  # 获取ID但不提交事务

        # 获取当前用户信息
        current_user = get_current_user()
        trigger_source = current_user['username']

        # 创建自主任务执行记录
        autonomous_execution = AutonomousTaskExecution(
            autonomous_task_id=autonomous_task.id,
            execution_type='manual',  # 手动触发
            trigger_source=trigger_source,
            trigger_data={
                'conversation_id': conversation_id,
                'task_type': task_type,
                'user_action': f'start_{task_type}_conversation',
                'user_id': current_user['id'],
                'username': current_user['username']
            },
            status='running'
        )
        db.session.add(autonomous_execution)
        db.session.commit()

        logger.info(f"已创建{task_type}任务记录: autonomous_task_id={autonomous_task.id}, execution_id={autonomous_execution.id}")
        
        return autonomous_task, autonomous_execution

    except Exception as e:
        db.session.rollback()
        logger.error(f"创建{task_type}任务记录失败: {str(e)}")
        raise

def get_current_user() -> Dict[str, Any]:
    """
    获取当前用户信息
    
    Returns:
        Dict: 用户信息字典
    """
    # FastAPI 中后台线程没有请求上下文，固化为 system 用户
    return {
        'id': None,
        'username': 'system',
        'email': None
    }

def create_system_message(conversation_id: int, task_id: int, content: str) -> Message:
    """
    创建系统消息
    
    Args:
        conversation_id: 会话ID
        task_id: 任务ID
        content: 消息内容
    
    Returns:
        Message: 创建的系统消息
    """
    try:
        current_user = get_current_user()
        
        system_msg = Message(
            conversation_id=conversation_id,
            action_task_id=task_id,
            content=content,
            role="system",
            source=current_user['username'],
            created_at=get_current_time_with_timezone()
        )
        
        db.session.add(system_msg)
        db.session.commit()
        
        logger.info(f"已创建系统消息: {system_msg.id}")
        return system_msg
        
    except Exception as e:
        logger.error(f"创建系统消息失败: {str(e)}")
        raise

def send_stream_message(result_queue, content: str = None, meta: Dict = None):
    """
    发送流式消息
    
    Args:
        result_queue: 结果队列
        content: 消息内容
        meta: 元数据
    """
    if result_queue:
        message = {
            "content": content,
            "meta": meta
        }
        result_queue.put(json.dumps(message))

def send_error_response(result_queue, error_msg: str, streaming: bool = False):
    """
    发送错误响应
    
    Args:
        result_queue: 结果队列
        error_msg: 错误消息
        streaming: 是否为流式模式
    """
    if streaming and result_queue:
        send_stream_message(result_queue, None, {
            'connectionStatus': 'error',
            'error': error_msg
        })
        result_queue.put(None)

def validate_task_active(task_key: str, active_tasks_dict: Dict) -> bool:
    """
    验证任务是否仍然活跃
    
    Args:
        task_key: 任务键
        active_tasks_dict: 活跃任务字典
    
    Returns:
        bool: 任务是否活跃
    """
    is_active = task_key in active_tasks_dict
    if not is_active:
        logger.info(f"任务已被停止: {task_key}")
    return is_active

def build_agent_info_map(conv_agents: List[ConversationAgent]) -> Dict[int, Dict[str, Any]]:
    """
    构建智能体信息映射
    
    Args:
        conv_agents: 会话智能体列表
    
    Returns:
        Dict: 智能体信息映射 {agent_id: {name, role_name}}
    """
    from app.models import Role
    
    agent_map = {}
    for conv_agent in conv_agents:
        agent = Agent.query.get(conv_agent.agent_id)
        if agent:
            role = Role.query.get(agent.role_id) if agent.role_id else None
            agent_map[conv_agent.agent_id] = {
                'id': agent.id,
                'name': agent.name,
                'role_name': role.name if role else None
            }
    
    return agent_map

def log_task_completion(task_key: str, task_type: str, reason: str = "completed"):
    """
    记录任务完成日志
    
    Args:
        task_key: 任务键
        task_type: 任务类型
        reason: 完成原因
    """
    logger.info(f"{task_type}任务完成: {task_key}, 原因: {reason}")
