"""
顺序会话模块

提供顺序会话相关的功能，包括处理顺序响应模式的消息

函数与关键变量说明:
---------------------------------------

* process_sequential_message - 处理顺序响应模式的消息
  - task_id: 行动任务ID
  - conversation_id: 会话ID
  - human_message: 人类消息对象
  - content: 消息内容
  - sse_callback: SSE回调函数
  - result_queue: 结果队列，用于返回SSE事件
"""
import logging
import traceback
from typing import Dict, Any, List, Optional, Callable

from app.models import db, ActionTaskAgent, Agent, Role
from app.services.conversation.message_formater import format_agent_error_done, format_all_agents_done
from app.services.summary_service import SummaryService

logger = logging.getLogger(__name__)

def process_sequential_message(task_id: int, conversation_id: int, human_message, 
                              content: str, sse_callback: Callable, result_queue=None):
    """
    处理顺序响应模式的消息
    
    Args:
        task_id: 行动任务ID
        conversation_id: 会话ID
        human_message: 人类消息对象
        content: 消息内容
        sse_callback: SSE回调函数
        result_queue: 结果队列，如果为None则不结束流
        
    Returns:
        bool: 是否成功处理
    """
    try:
        # 导入需要的函数，避免循环导入
        from app.services.conversation_service import ConversationService
        
        # 获取任务中的所有非监督者智能体
        agent_relations = ActionTaskAgent.query.join(Agent).filter(
            ActionTaskAgent.action_task_id == task_id,
            Agent.is_observer == False  # 过滤掉监督者智能体
        ).all()
        if not agent_relations:
            error_msg = "行动任务中没有可用的任务智能体（监督者智能体不参与顺序会话）"
            logger.error(f"[会话服务（顺序）] 错误: {error_msg}")
            sse_callback({
                "connectionStatus": "error",
                "error": error_msg
            })
            if result_queue:
                result_queue.put(None)
            return False

        # 处理每个智能体的响应
        for index, agent_relation in enumerate(agent_relations):
            agent_id = agent_relation.agent_id
            agent = Agent.query.get(agent_id)
            if not agent:
                logger.error(f"[会话服务（顺序）] 警告: 找不到智能体 ID={agent_id}，跳过")
                continue

            # 发送顺序信息
            agent_role = Role.query.get(agent.role_id) if hasattr(agent, 'role_id') and agent.role_id else None
            role_name = agent_role.name if agent_role else "智能助手"
            sse_callback({
                "type": "agentInfo",
                "turnPrompt": f"顺序回复：轮到智能体 {agent.name}({role_name}) 发言",
                "agentId": str(agent_id),
                "agentName": f"{agent.name}({role_name})",
                "round": index + 1,
                "totalRounds": len(agent_relations),
                "responseOrder": index + 1,
                "totalAgents": len(agent_relations)
            })

            # 处理当前智能体的响应
            is_last_agent = index == len(agent_relations) - 1
            response_completed, error_info = ConversationService._process_single_agent_response(
                task_id, conversation_id, human_message, agent_id,
                content, sse_callback, 
                None,  # 无论是否是最后一个智能体，都不在这里结束流
                response_order=index + 1
            )

            # 如果处理失败，发送智能体处理结束信号，并继续下一个智能体
            if not response_completed:
                agent_role = Role.query.get(agent.role_id) if hasattr(agent, 'role_id') and agent.role_id else None
                role_name = agent_role.name if agent_role else "智能助手"
                logger.error(f"[会话服务（顺序）] 警告: 智能体 {agent.name}({role_name}) 处理失败，错误信息: {error_info}，继续下一个")
                
                # 生成带有具体错误信息的内容
                error_content = f"智能体处理失败: {agent.name}({role_name})\n错误原因: {error_info}"
                
                # 使用格式化函数发送智能体处理结束信号
                formatted_msg = format_agent_error_done(
                    agent_id=str(agent_id),
                    agent_name=agent.name,
                    role_name=role_name,
                    timestamp=None,
                    response_order=index + 1,
                    error_content=error_content
                )
                sse_callback(formatted_msg["meta"])
        
        # 所有智能体处理完成后，检查是否需要触发上下文总结
        need_summarize = SummaryService.check_need_summarize(conversation_id)
        
        # 发送最终完成信号
        logger.info(f"[会话服务（顺序）] 所有智能体已完成响应，need_summarize={need_summarize}")
        formatted_done_msg = format_all_agents_done(
            message="所有智能体已完成响应",
            need_summarize=need_summarize
        )
        sse_callback(formatted_done_msg["meta"])
        
        # 结束流
        if result_queue:
            result_queue.put(None)
        
        return True
    
    except Exception as e:
        # 处理异常
        error_msg = f"处理顺序响应模式消息时出错: {str(e)}"
        logger.error(f"[会话服务（顺序）] 异常: {error_msg}")

        try:
            # 尝试发送错误事件
            sse_callback({
                "connectionStatus": "error",
                "error": error_msg
            })
        except:
            logger.error("发送错误事件失败")

        # 结束流
        if result_queue:
            result_queue.put(None)
        
        return False

def process_default_agent_message(task_id: int, conversation_id: int, human_message, 
                                 content: str, sse_callback: Callable, result_queue=None):
    """
    处理默认智能体的消息
    
    Args:
        task_id: 行动任务ID
        conversation_id: 会话ID
        human_message: 人类消息对象
        content: 消息内容
        sse_callback: SSE回调函数
        result_queue: 结果队列，如果为None则不结束流
        
    Returns:
        bool: 是否成功处理
    """
    try:
        # 导入需要的函数，避免循环导入
        from app.services.conversation_service import ConversationService
        
        # 默认使用任务的默认非监督者智能体
        default_agent_relation = ActionTaskAgent.query.join(Agent).filter(
            ActionTaskAgent.action_task_id == task_id,
            ActionTaskAgent.is_default == True,
            Agent.is_observer == False  # 过滤掉监督者智能体
        ).first()

        if not default_agent_relation:
            # 如果没有默认智能体，使用第一个非监督者智能体
            default_agent_relation = ActionTaskAgent.query.join(Agent).filter(
                ActionTaskAgent.action_task_id == task_id,
                Agent.is_observer == False  # 过滤掉监督者智能体
            ).first()

        if default_agent_relation:
            # 处理默认智能体的响应
            response_completed, error_info = ConversationService._process_single_agent_response(
                task_id, conversation_id, human_message, default_agent_relation.agent_id,
                content, sse_callback, result_queue
            )
            
            # 无论处理成功与否，确保发送完成信号
            if not response_completed:
                # 发送一个完成信号
                agent = Agent.query.get(default_agent_relation.agent_id)
                if agent:
                    agent_role = Role.query.get(agent.role_id) if hasattr(agent, 'role_id') and agent.role_id else None
                    role_name = agent_role.name if agent_role else "智能助手"
                    
                    error_message = f"智能体 {agent.name}({role_name}) 处理失败，错误原因: {error_info}"
                    formatted_done_msg = format_all_agents_done(
                        message="消息处理已完成，但智能体响应失败"
                    )
                    # 添加error字段
                    formatted_done_msg["meta"]["error"] = error_message
                    sse_callback(formatted_done_msg["meta"])
                else:
                    formatted_done_msg = format_all_agents_done(
                        message="消息处理已完成，但智能体响应失败"
                    )
                    error_message = f"智能体处理失败，错误原因: {error_info}"
                    formatted_done_msg["meta"]["error"] = error_message
                    sse_callback(formatted_done_msg["meta"])
                
                # 结束流
                if result_queue:
                    result_queue.put(None)
            
            return response_completed
        else:
            error_msg = "行动任务中没有可用的任务智能体（监督者智能体不参与默认消息处理）"
            logger.error(f"[会话服务（顺序）] 错误: {error_msg}")
            sse_callback({
                "connectionStatus": "error",
                "error": error_msg
            })
            if result_queue:
                result_queue.put(None)
            return False
    
    except Exception as e:
        # 处理异常
        error_msg = f"处理默认智能体消息时出错: {str(e)}"
        logger.error(f"[会话服务（顺序）] 异常: {error_msg}")

        try:
            # 尝试发送错误事件
            sse_callback({
                "connectionStatus": "error",
                "error": error_msg
            })
        except:
            logger.error("发送错误事件失败")

        # 结束流
        if result_queue:
            result_queue.put(None)
        
        return False
