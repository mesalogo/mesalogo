"""
整合的会话服务模块

提供会话管理、消息处理、提示词构建和LLM调用的功能

函数与关键变量说明:
---------------------------------------

会话管理函数:
* create_conversation - 创建子任务
  - task_id: 行动任务ID
  - data: 包含会话信息(title, description等)的字典

* create_conversation_for_action_task - 为新创建的行动任务创建默认会话
  - action_task: 行动任务实例

* get_conversations - 获取行动任务的会话列表
  - task_id: 行动任务ID

* get_conversation_messages - 获取会话的消息
  - task_id: 行动任务ID
  - conversation_id: 会话ID

* start_auto_discussion - 启动智能体自动讨论
  - task_id: 行动任务ID
  - conversation_id: 会话ID
  - rounds: 讨论轮数
  - topic: 讨论主题
  - summarize: 是否在讨论结束后由第一个智能体总结

* start_auto_discussion_stream - 启动智能体自动讨论（流式版本）
  - app_context: Flask应用上下文
  - task_id: 行动任务ID
  - conversation_id: 会话ID
  - rounds: 讨论轮数
  - topic: 讨论主题
  - summarize: 是否在讨论结束后由第一个智能体总结
  - result_queue: 结果队列

消息处理函数:
* _process_message_common - 处理消息的共享核心逻辑，构建提示词
  - conversation_id: 会话ID
  - content: 消息内容
  - target_agent_id: 目标智能体ID(可选)
  - user_id: 用户ID(可选)
  - target_agent_ids: 目标智能体ID列表(可选，多个智能体，优先级高于target_agent_id)
  - no_new_message: 是否跳过创建新消息 (可选，用于会话服务中复用已创建的消息)
  - existing_human_message: 已存在的人类消息对象 (可选，与no_new_message配合使用)
  - 返回: (human_message, agent, agent_role, role_model, model_messages, conversation, role_model_params, agent_info, model_settings)

* process_stream_message - 在单独线程中处理流式消息请求
  - app_context: Flask应用上下文
  - task_id: 行动任务ID
  - conversation_id: 会话ID
  - message_data: 消息数据
  - result_queue: 结果队列，用于返回SSE事件

* _process_single_agent_response - 处理单个智能体的响应(使用_process_message_common构建提示词)
  - task_id: 行动任务ID
  - conversation_id: 会话ID
  - human_message: 人类消息对象
  - agent_id: 智能体ID
  - content: 消息内容
  - sse_callback: SSE回调函数
  - result_queue: 结果队列(可选)
  - response_order: 响应顺序(可选)

工具函数:
* send_model_request_stream - 向模型API发送流式请求 [已废弃，使用ModelClient.send_request代替]
  - api_url: API地址
  - api_key: API密钥
  - messages: 消息列表
  - model: 模型名称
  - callback: 回调函数
  - agent_info: 智能体信息(可选)
  - **kwargs: 其他参数

注意: SSE相关函数已移至 app/services/conversation/stream_handler.py
"""
import json
import logging
import queue
import requests
import uuid
import re
import traceback
from typing import List, Dict, Any, Optional, Tuple, Callable
from datetime import datetime
import threading

from app.services.thread_context import g
from app.services.conversation.stream_handler import create_sse_response, queue_to_sse, wrap_stream_callback, handle_streaming_response, register_streaming_task
from app.services.conversation.tool_handler import execute_tool_call, parse_tool_calls
from app.services.conversation.message_processor import process_message_common, build_system_prompt, format_messages
from app.services.conversation.model_client import ModelClient
# 自动讨论功能已移至 app/services/conversation/auto_conversation.py
# 导入顺序会话处理函数
from app.services.conversation.sequential_conversation import process_sequential_message, process_default_agent_message
from app.models import db, Conversation, ConversationAgent, ActionTaskAgent, Message, Agent, ActionTask, RuleSet, Rule, ActionSpace, Role, RoleCapability, Capability, RoleTool, Tool, ActionTaskEnvironmentVariable, ActionSpaceRole
from app.services.mcp_routes_config import get_tool_url
from app.utils.datetime_utils import get_current_time_with_timezone
from config import BACKEND_URL, DEBUG_LLM_RESPONSE
from app.services.mcp_server_manager import mcp_manager
from app.services.summary_service import SummaryService

logger = logging.getLogger(__name__)

class ConversationService:
    """会话服务类，处理会话相关的所有业务逻辑"""

    # ==== 会话管理方法 ====

    @staticmethod
    def create_conversation(task_id: int, data: Dict[str, Any]) -> Dict:
        """创建子任务"""
        if 'title' not in data:
            raise ValueError("子任务标题不能为空")

        # 检查行动任务是否存在
        task = ActionTask.query.get(task_id)
        if not task:
            raise ValueError(f"行动任务不存在: {task_id}")

        # 创建子任务
        conversation = Conversation(
            title=data['title'],
            description=data.get('description', ''),
            action_task_id=task_id,
            mode=data.get('mode', 'sequential'),
            status='active'
        )

        db.session.add(conversation)
        db.session.commit()

        # 获取任务的智能体并添加到会话
        task_agents = ActionTaskAgent.query.filter_by(action_task_id=task_id).all()
        for task_agent in task_agents:
            agent = Agent.query.get(task_agent.agent_id)
            if agent:
                # 添加智能体到会话
                conv_agent = ConversationAgent(
                    conversation_id=conversation.id,
                    agent_id=agent.id,
                    is_default=task_agent.is_default
                )
                db.session.add(conv_agent)

        db.session.commit()

        # 新增：检查是否需要从源会话总结
        source_conversation_id = data.get('source_conversation_id')
        if source_conversation_id:
            # 检查是否配置了默认模型
            default_model = SummaryService.get_default_summary_model()
            if not default_model:
                logger.warning(f"未配置默认总结模型，跳过总结生成")
            else:
                try:
                    # 调用总结服务
                    summary = SummaryService.summarize_conversation(source_conversation_id)
                    
                    # 创建人类消息（作为上下文供 agent 使用）
                    summary_message = Message(
                        conversation_id=conversation.id,
                        action_task_id=task_id,
                        role='human',
                        content=f"**[上一会话总结]**\n\n{summary}",
                        created_at=get_current_time_with_timezone()
                    )
                    db.session.add(summary_message)
                    db.session.commit()
                    
                    logger.info(f"已为新会话 {conversation.id} 生成总结消息，源会话: {source_conversation_id}")
                except Exception as e:
                    logger.error(f"生成会话总结失败: {str(e)}")
                    # 不影响会话创建，总结失败只记录日志

        # 构建响应
        result = {
            'id': conversation.id,
            'title': conversation.title,
            'description': conversation.description,
            'status': conversation.status,
            'mode': conversation.mode,
            'created_at': conversation.created_at.isoformat() if conversation.created_at else None,
            'updated_at': conversation.updated_at.isoformat() if conversation.updated_at else None
        }

        return result

    @staticmethod
    def create_conversation_for_action_task(action_task: ActionTask) -> Dict:
        """为新创建的行动任务创建默认会话

        Args:
            action_task: 行动任务实例

        Returns:
            Dict: 创建的会话信息
        """
        # 创建默认会话数据
        conversation_data = {
            'title': f"{action_task.title} - 默认会话",
            'description': f"{action_task.title}的默认会话",
            'mode': action_task.mode
        }

        # 使用已有的创建会话方法
        return ConversationService.create_conversation(action_task.id, conversation_data)

    @staticmethod
    def get_conversations(task_id: int) -> List[Dict]:
        """获取行动任务的会话列表"""
        # 检查行动任务是否存在
        task = ActionTask.query.get(task_id)
        if not task:
            raise ValueError(f"行动任务未找到: {task_id}")

        # 获取会话，按创建时间降序排序
        conversations = Conversation.query.filter_by(action_task_id=task_id).order_by(Conversation.created_at.desc()).all()
        result = []

        for conv in conversations:
            # 获取会话的智能体数量和消息数量
            agent_count = ConversationAgent.query.filter_by(conversation_id=conv.id).count()
            message_count = Message.query.filter_by(conversation_id=conv.id).count()

            result.append({
                'id': conv.id,
                'title': conv.title,
                'description': conv.description,
                'status': conv.status,
                'mode': conv.mode,
                'created_at': conv.created_at.isoformat() if conv.created_at else None,
                'updated_at': conv.updated_at.isoformat() if conv.updated_at else None,
                'agent_count': agent_count,
                'message_count': message_count
            })

        return result

    @staticmethod
    def get_conversation_messages(task_id: int, conversation_id: int) -> List[Dict]:
        """获取会话的消息"""
        # 检查会话是否存在且属于该行动任务
        conversation = Conversation.query.get(conversation_id)
        if not conversation or conversation.action_task_id != task_id:
            raise ValueError(f"会话未找到或不属于行动任务: {task_id}")

        # 获取消息
        messages = Message.query.filter_by(conversation_id=conversation_id).order_by(Message.created_at).all()
        result = []

        for msg in messages:
            # 使用MessageService.format_message_for_api来处理多模态内容
            from app.services.message_service import MessageService
            message_data = MessageService.format_message_for_api(msg)

            # 添加会话特有的字段
            message_data.update({
                'source': getattr(msg, 'source', 'taskConversation'),  # 添加source字段，默认为taskConversation
                'meta': getattr(msg, 'meta', {}),  # 添加meta字段，默认为空字典
                'agent_id': msg.agent_id,  # 添加agent_id字段
                'thinking': msg.thinking
            })

            # 从meta字段中提取target_agent_ids并添加到消息数据中
            meta = getattr(msg, 'meta', {})
            if meta and 'target_agent_ids' in meta:
                message_data['target_agent_ids'] = meta['target_agent_ids']
            else:
                # 如果没有target_agent_ids，设置为None（前端会显示"发送给所有智能体"）
                message_data['target_agent_ids'] = None

            # 如果是智能体消息，添加智能体信息
            if msg.role == 'agent' and msg.agent_id:
                agent = Agent.query.get(msg.agent_id)
                if agent:
                    # 获取智能体的角色信息
                    agent_role = None
                    if hasattr(agent, 'role_id') and agent.role_id:
                        agent_role = Role.query.get(agent.role_id)

                    role_name = agent_role.name if agent_role else "智能助手"

                    message_data['agent_id'] = agent.id
                    message_data['agent_name'] = agent.name
                    message_data['role_name'] = role_name
                    message_data['agent'] = {
                        'id': agent.id,
                        'name': agent.name,
                        'role_name': role_name,
                        'description': agent.description
                    }

            result.append(message_data)

        return result

    @staticmethod
    def process_stream_message(app_context, task_id: int, conversation_id: int, message_data: dict, result_queue: queue.Queue):
        """
        在单独的线程中处理流式消息请求，通过消息队列返回结果

        Args:
            app_context: Flask应用上下文 (ignored in FastAPI, kept for API compatibility)
            task_id: 行动任务ID
            conversation_id: 会话ID
            message_data: 消息数据，包含content、target_agent_id或target_agent_ids等
            result_queue: 结果队列，用于返回SSE事件
        """
        # In FastAPI with scoped_session, app_context is not needed
        if True:
            try:
                content = message_data.get('content')
                target_agent_id = message_data.get('target_agent_id')
                target_agent_ids = message_data.get('target_agent_ids', [])
                user_id = message_data.get('user_id')
                send_target = message_data.get('send_target', 'task')  # 获取发送目标
                isolation_mode = message_data.get('isolation_mode', False)  # 获取隔离模式
                smart_dispatch = message_data.get('smart_dispatch', False)  # 获取智能分发模式
                enable_subagent = message_data.get('enable_subagent', False)  # SubAgent 协作开关

                # 将 SubAgent 开关存入 Flask g 上下文，供 prompt_builder 读取
                from app.services.thread_context import g
                g.enable_subagent = enable_subagent

                # 导入并注册流式任务（传入 send_target 避免key冲突）
                from app.services.conversation.stream_handler import wrap_stream_callback, register_streaming_task
                register_streaming_task(task_id, conversation_id, result_queue, send_target=send_target)

                # 创建回调函数
                sse_callback = wrap_stream_callback(result_queue)

                # 兼容单个智能体ID与多个智能体ID
                if target_agent_id and not target_agent_ids:
                    target_agent_ids = [target_agent_id]

                # 智能分发：如果开启且没有指定目标智能体，自动选择最佳智能体
                if smart_dispatch and not target_agent_ids:
                    from app.services.smart_dispatch_service import SmartDispatchService
                    best_agent_id = SmartDispatchService.select_best_agent(
                        task_id=task_id,
                        conversation_id=conversation_id,
                        message_content=content
                    )
                    if best_agent_id:
                        target_agent_ids = [best_agent_id]
                        logger.info(f"[会话服务] 智能分发选择智能体: {best_agent_id}")

                # 获取会话和任务信息
                conversation = Conversation.query.get(conversation_id)
                if not conversation:
                    error_msg = f"会话不存在，ID: {conversation_id}"
                    logger.error(f"[会话服务] 错误: {error_msg}")
                    sse_callback({
                        "connectionStatus": "error",
                        "error": error_msg
                    })
                    result_queue.put(None)
                    return

                action_task = ActionTask.query.get(task_id)
                if not action_task:
                    error_msg = f"行动任务不存在，ID: {task_id}"
                    logger.error(f"[会话服务] 错误: {error_msg}")
                    sse_callback({
                        "connectionStatus": "error",
                        "error": error_msg
                    })
                    result_queue.put(None)
                    return

                # 创建用户消息 - 使用process_message_common来处理source字段设置
                # 先创建一个临时的用户消息，然后通过process_message_common来设置正确的字段
                result = process_message_common(
                    conversation_id=conversation_id,
                    content=content,
                    target_agent_id=target_agent_id,
                    target_agent_ids=target_agent_ids,
                    user_id=user_id,
                    send_target=send_target,
                    isolation_mode=isolation_mode
                )

                if not result or len(result) != 9:
                    error_msg = f"创建用户消息失败，process_message_common返回无效结果"
                    logger.error(f"[会话服务] 错误: {error_msg}")
                    sse_callback({
                        "connectionStatus": "error",
                        "error": error_msg
                    })
                    result_queue.put(None)
                    return

                human_message = result[0]  # 获取创建的用户消息
                logger.debug(f"[会话服务] 已创建用户消息 ID={human_message.id} 内容={content[:50]}...")

                # 如果指定了目标智能体，只处理这些智能体的响应
                if target_agent_ids:
                    # 处理多个指定智能体的响应
                    for index, current_agent_id in enumerate(target_agent_ids):
                        agent = Agent.query.get(current_agent_id)
                        if not agent:
                            logger.warning(f"[会话服务] 警告: 找不到智能体 ID={current_agent_id}，跳过")
                            continue

                        # 发送智能体信息
                        agent_role = Role.query.get(agent.role_id) if hasattr(agent, 'role_id') and agent.role_id else None
                        role_name = agent_role.name if agent_role else "智能助手"
                        logger.debug(f"[会话服务] 发送智能体信息: {agent.name}({role_name})")
                        sse_callback({
                            "type": "agentInfo",
                            "turnPrompt": f"轮到智能体 {agent.name}({role_name}) 发言",
                            "agentId": str(current_agent_id),
                            "agentName": f"{agent.name}({role_name})",
                            "round": index + 1,
                            "totalRounds": len(target_agent_ids),
                            "responseOrder": index + 1,
                            "totalAgents": len(target_agent_ids)
                        })

                        # 处理当前智能体的响应
                        # 最后一个智能体时传递result_queue
                        logger.debug(f"[会话服务] 处理单个智能体响应: {agent.name}({role_name})")
                        is_last_agent = index == len(target_agent_ids) - 1
                        response_completed, error_msg = ConversationService._process_single_agent_response(
                            task_id, conversation_id, human_message, current_agent_id,
                            content, sse_callback,
                            result_queue if is_last_agent else None,  # 最后一个智能体时传递result_queue，结束流
                            response_order=index + 1,
                            isolation_mode=isolation_mode
                        )

                        # 如果处理失败，继续下一个智能体
                        if not response_completed:
                            logger.warning(f"[会话服务] 警告: 智能体 {agent.name}({role_name}) 处理失败，继续下一个")
                            agent_role = Role.query.get(agent.role_id) if hasattr(agent, 'role_id') and agent.role_id else None
                            role_name = agent_role.name if agent_role else "智能助手"
                            warning_msg = f"[会话服务] 警告: 智能体 {agent.name}({role_name}) 处理失败，继续下一个"
                            # 使用format_agent_error_done函数格式化错误消息
                            logger.debug(f"[会话服务] 格式化错误消息: {warning_msg}")
                            from app.services.conversation.message_formater import format_agent_error_done
                            formatted_error = format_agent_error_done(
                                agent_id=str(agent.id),
                                agent_name=agent.name,
                                role_name=role_name,
                                error_content=warning_msg
                            )

                            # 通过SSE发送格式化的错误消息
                            sse_callback(formatted_error["meta"])
                else:
                    # 处理顺序响应模式
                    if action_task.mode == 'sequential':
                        # 使用顺序会话处理函数
                        logger.info(f"[会话服务] 使用顺序会话处理函数")
                        process_sequential_message(
                            task_id=task_id,
                            conversation_id=conversation_id,
                            human_message=human_message,
                            content=content,
                            sse_callback=sse_callback,
                            result_queue=result_queue
                        )
                    else:
                        # 使用默认智能体处理函数
                        logger.info(f"[会话服务] 使用默认智能体处理函数")
                        process_default_agent_message(
                            task_id=task_id,
                            conversation_id=conversation_id,
                            human_message=human_message,
                            content=content,
                            sse_callback=sse_callback,
                            result_queue=result_queue
                        )

                # 注意：不需要在这里发送done事件，因为process_sequential_message和process_default_agent_message
                # 函数内部已经处理了流的结束，重复发送done事件会导致前端状态管理混乱

            except Exception as e:
                # 处理异常
                error_msg = f"处理消息时出错: {str(e)}"
                logger.error(f"[会话服务] 异常: {error_msg}")
                traceback.print_exc()

                try:
                    # 尝试发送错误事件
                    sse_callback({
                        "connectionStatus": "error",
                        "error": error_msg
                    })
                except:
                    logger.error("发送错误事件失败")

                # 结束流
                result_queue.put(None)

    @staticmethod
    def _process_single_agent_response(task_id, conversation_id, human_message, agent_id, content,
                                       sse_callback, result_queue=None, response_order=None, isolation_mode=False):
        """处理单个智能体的响应

        Args:
            task_id: 行动任务ID
            conversation_id: 会话ID
            human_message: 人类消息对象（可以为None，用于自动讨论中的虚拟消息）
            agent_id: 智能体ID
            content: 消息内容
            sse_callback: SSE回调函数
            result_queue: 结果队列，如果为None则不结束流
            response_order: 响应顺序（用于顺序响应模式）
            isolation_mode: 隔离模式，True时智能体只能看到自己与用户的消息历史

        Returns:
            tuple: (是否成功完成响应, 错误信息) - 如果成功则错误信息为None
        """
        try:
            # 设置会话上下文信息用于分区标识符生成
            from app.services.thread_context import g
            try:
                logger.debug(f"[会话上下文] 会话ID: {conversation_id}, 智能体ID: {agent_id}")

                # 获取会话信息
                conversation = Conversation.query.get(conversation_id)
                logger.debug(f"[会话上下文] 会话对象: {conversation}")

                agent = Agent.query.get(agent_id)
                logger.debug(f"[会话上下文] 智能体对象: {agent}")

                # 获取行动任务信息
                action_task = None
                if conversation and conversation.action_task_id:
                    # 使用全局导入的ActionTask类
                    from app.models import ActionTask as ActionTaskModel
                    action_task = ActionTaskModel.query.get(conversation.action_task_id)
                    logger.debug(f"[会话上下文] 行动任务对象: {action_task}")

                # 构建上下文信息
                g.conversation_context = {
                    'action_space_id': action_task.action_space_id if action_task else 'default',
                    'action_task_id': action_task.id if action_task else 'default',
                    'role_id': agent.role_id if agent and agent.role_id else 'default',
                    'agent_id': agent_id,
                    'conversation_id': conversation_id
                }
                logger.debug(f"[会话上下文] 设置分区上下文: {g.conversation_context}")
            except Exception as e:
                logger.warning(f"[会话上下文] 设置上下文失败: {e}")
                logger.debug(f"[会话上下文] 异常详情: {traceback.format_exc()}")
                # 设置默认上下文
                g.conversation_context = {
                    'action_space_id': 'default',
                    'action_task_id': 'default',
                    'role_id': 'default',
                    'agent_id': agent_id,
                    'conversation_id': conversation_id
                }

            # 判断是否为虚拟消息（自动讨论中不存在实际的human_message）
            is_virtual_message = human_message is None

            # 优化：在开始处理前检查自主任务是否已被停止
            # 关键修正：只检查虚拟消息（自主任务），不检查用户的正常消息
            if is_virtual_message and task_id:
                try:
                    # 使用新调度器检查任务状态
                    from app.services.scheduler import TaskScheduler, TaskState
                    scheduler = TaskScheduler.get_instance()
                    tasks = scheduler.get_tasks_by_action_task(str(task_id))
                    
                    # 检查是否有活动任务
                    is_task_active = any(
                        t.state in (TaskState.RUNNING, TaskState.PAUSED) 
                        for t in tasks
                    )

                    if not is_task_active and tasks:
                        # 有任务但都不是活动状态
                        logger.info(f"自主任务已被停止，跳过智能体 {agent_id} 的响应处理: task_id={task_id}")
                        return False, "自主任务已被停止"
                except Exception as e:
                    # 异常时不阻止执行，记录日志继续
                    logger.debug(f"检查自主任务状态时出错: {str(e)}")

            # 如果是虚拟消息，创建一个临时的human_message对象并通过SSE发送
            if is_virtual_message:
                # 发送虚拟消息到前端（仅当sse_callback存在时）
                if sse_callback:
                    sse_callback({
                        "content": content,
                        "meta": {
                            "type": "virtualMessage",
                            "isVirtual": True,
                            "virtualRole": "human",
                            "timestamp": datetime.now().isoformat(),
                            "message": {
                                "id": f"virtual-{uuid.uuid4()}",
                                "content": content,
                                "role": "human",
                                "timestamp": datetime.now().isoformat(),
                                "isVirtual": True
                            }
                        }
                    })

                human_message = Message(
                    content=content,
                    role='human',
                    conversation_id=conversation_id
                )

            # 使用process_message_common构建提示词和获取模型配置
            # 设置no_new_message=True，避免创建新的人类消息
            # 根据human_message的source字段确定send_target
            send_target = None
            if human_message and hasattr(human_message, 'source'):
                if human_message.source == 'supervisorConversation':
                    send_target = 'supervisor'
                elif human_message.source == 'taskConversation':
                    send_target = 'task'

            result = process_message_common(
                conversation_id=conversation_id,
                content=content,
                target_agent_id=agent_id,
                no_new_message=True,
                existing_human_message=human_message,
                send_target=send_target,
                isolation_mode=isolation_mode
            )

            # 确保结果完整
            if len(result) != 9:
                error_msg = f"process_message_common返回的结果不完整，预期9个值，实际{len(result)}个值"
                logger.error(f"[会话服务] 错误: {error_msg}")
                if result_queue:
                    if sse_callback:
                        sse_callback({
                            "connectionStatus": "error",
                            "error": error_msg
                        })
                    result_queue.put(None)
                return False, error_msg

            # 正确解包返回值
            returned_message, agent, agent_role, role_model, model_messages, conversation, role_model_params, agent_info, model_settings = result

            # 检查是否成功获取了智能体信息
            if not agent:
                error_msg = f"找不到智能体 ID={agent_id}"
                logger.error(f"[会话服务] 错误: {error_msg}")
                if result_queue:
                    if sse_callback:
                        sse_callback({
                            "connectionStatus": "error",
                            "error": error_msg
                        })
                    result_queue.put(None)
                return False, error_msg

            # 检查角色
            if not agent_role:
                error_msg = f"智能体 {agent.name} 没有关联的角色，无法生成回复"
                logger.error(f"[会话服务] 错误: {error_msg}")
                if result_queue:
                    if sse_callback:
                        sse_callback({
                            "connectionStatus": "error",
                            "error": error_msg
                        })
                    result_queue.put(None)
                return False, error_msg

            # 检查模型
            if not role_model:
                error_msg = f"找不到 {agent.name}({agent_role.name}) 的可用模型配置，请先配置默认模型"
                logger.error(f"[会话服务] 错误: {error_msg}")
                if result_queue:
                    if sse_callback:
                        sse_callback({
                            "connectionStatus": "error",
                            "error": error_msg
                        })
                    result_queue.put(None)
                return False, error_msg

            # 调用模型API获取流式响应
            response_text = ""

            # 内容回调
            def content_callback(chunk, meta=None):
                nonlocal response_text
                if chunk is not None:
                    response_text += chunk
                    if sse_callback:
                        sse_callback({"content": chunk})
                elif meta is not None:
                    if sse_callback:
                        sse_callback(meta)

            # 检查是否为外部角色，使用相应的客户端
            if agent_info.get('is_external', False):
                # 使用外部ModelClient处理外部角色
                from app.services.conversation.external_model_client import external_model_client

                # 构建角色配置，直接使用agent_info中的external_config
                role_config = {
                    'source': 'external',
                    'settings': {
                        'external_config': agent_info.get('external_config', {})
                    }
                }

                api_response = external_model_client.send_request_with_adapter(
                    role_config=role_config,
                    model_config=None,  # 外部角色不需要model_config
                    messages=model_messages,
                    model=role_model.model_id,
                    is_stream=True,
                    callback=content_callback,
                    agent_info=agent_info,
                    task_id=task_id,
                    conversation_id=conversation_id,
                    **role_model_params
                )
            else:
                # 使用标准ModelClient处理内部角色
                model_client = ModelClient()
                api_response = model_client.send_request(
                    api_url=role_model.base_url,
                    api_key=role_model.api_key,
                    messages=model_messages,
                    model=role_model.model_id,
                    is_stream=True,
                    callback=content_callback,  # 直接使用content_callback
                    agent_info=agent_info,  # 传递完整的agent_info，包含工具定义
                    task_id=task_id,  # 添加任务ID
                    conversation_id=conversation_id,  # 添加会话ID
                    send_target=send_target,  # 传递 send_target 用于区分监督者会话和任务会话
                    **role_model_params
                )

            # 检查响应是否包含错误
            # 检查是否是取消（返回空字符串表示正常取消，不是错误）
            if api_response == "":
                logger.info(f"[会话服务] 智能体响应被取消（非错误）")
                # 取消不是错误，返回 True 表示正常处理（跳过当前Agent，继续下一个）
                return True, None
            
            if api_response.startswith('Error:'):
                error_msg = api_response
                logger.error(f"[会话服务] 错误: {error_msg}")
                if result_queue:
                    if sse_callback:
                        sse_callback({
                            "connectionStatus": "error",
                            "error": error_msg
                        })
                    result_queue.put(None)
                return False, error_msg

            # 创建智能体回复消息并保存到数据库
            # 判断智能体是否为监督者，决定消息角色和source
            is_supervisor = hasattr(agent, 'is_observer') and agent.is_observer
            message_role = 'supervisor' if is_supervisor else 'agent'

            # 检查是否是监督者干预（从用户消息的meta字段判断）
            is_intervention = False
            if human_message and human_message.meta and 'type' in human_message.meta:
                is_intervention = True

            # 设置消息source和meta
            if is_supervisor:
                message_source = 'supervisorConversation'
                # 如果是干预消息，设置相应的meta信息
                if is_intervention:
                    message_meta = {
                        'type': 'info'
                    }
                else:
                    message_meta = {}
            else:
                message_source = 'taskConversation'
                message_meta = {}

            agent_message = Message(
                content=api_response,
                thinking=None,  # 不再单独存储thinking内容，所有内容都在content中
                role=message_role,
                source=message_source,
                meta=message_meta,
                action_task_id=task_id,
                conversation_id=conversation_id,
                agent_id=agent.id
            )

            db.session.add(agent_message)

            # 更新行动任务的updated_at时间
            if task_id:
                from app.utils.datetime_utils import get_current_time_with_timezone
                from app.models import ActionTask
                action_task = ActionTask.query.get(task_id)
                if action_task:
                    action_task.updated_at = get_current_time_with_timezone()
                    logger.debug(f"更新行动任务的updated_at时间: 任务ID={task_id}")

            db.session.commit()

            # 写入 Redis 消息缓存
            try:
                from core.model_cache import cache_message
                cache_message(agent_message)
            except Exception as _cache_err:
                logger.debug(f"Redis 缓存智能体消息失败（不影响业务）: {_cache_err}")

            logger.debug(f"[会话服务] 创建了智能体消息 ID={agent_message.id}")

            # 准备完成事件的响应对象
            role_name = agent_role.name if agent_role else "智能助手"
            response_object = {
                "response": {
                    "id": agent_message.id,
                    "content": api_response,
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "role_name": role_name,
                    # thinking字段已完全弃用，不再包含在响应中
                    "timestamp": agent_message.created_at.isoformat() if agent_message.created_at else None,
                    "response_order": response_order  # 添加响应顺序
                }
            }

            # 发送完成事件
            connection_status = "done" if result_queue else "agentDone"
            completion_event = {
                "connectionStatus": connection_status,
                "responseObj": response_object
            }
            
            # 如果是最终完成事件（done），检查是否需要触发上下文总结
            if connection_status == "done":
                need_summarize = SummaryService.check_need_summarize(conversation_id)
                if need_summarize:
                    completion_event["need_summarize"] = True
                    logger.info(f"[会话服务] 会话需要触发上下文总结: conversation_id={conversation_id}")
            
            logger.info(f"[会话服务] 发送完成事件: connectionStatus={connection_status}, agent_id={agent_id}, sse_callback={'存在' if sse_callback else '不存在'}")
            if sse_callback:
                sse_callback(completion_event)
                logger.info(f"[会话服务] 完成事件已发送到sse_callback: {completion_event}")
            else:
                logger.debug(f"[会话服务] sse_callback为None，跳过发送完成事件（自主任务场景）: agent_id={agent_id}")

            # 触发监督者事件检查（但监督者智能体的回复不需要被监督）
            try:
                if not agent.is_observer:  # 只有非监督者智能体的回复才触发规则检查
                    from app.services.supervisor_event_manager import supervisor_event_manager
                    supervisor_event_manager.on_agent_response_completed(
                        conversation_id=conversation_id,
                        agent_id=agent_id,
                        message_id=agent_message.id,
                        is_last_agent=(result_queue is not None)  # 如果传递了result_queue，说明是最后一个智能体
                    )
                else:
                    logger.debug(f"跳过监督者智能体 {agent_id} 的规则检查")
            except Exception as e:
                logger.error(f"触发监督者事件检查时出错: {str(e)}")
                # 不影响主流程，继续执行

            # 触发消息同步到图谱记忆（智能体回复完成后）
            try:
                logger.info(f"[消息同步至图谱] 准备同步消息到图谱记忆: 会话={conversation_id}, 智能体消息={agent_message.id}")
                from app.services.memory_sync_service import memory_sync_service
                # 异步同步消息到图谱记忆
                memory_sync_service.sync_conversation_round_async(
                    conversation_id=conversation_id,
                    agent_message_id=agent_message.id,
                    human_message_id=human_message.id if human_message else None
                )
                logger.debug(f"[消息同步至图谱] 已启动异步同步任务")
            except Exception as e:
                logger.error(f"同步消息到图谱记忆时出错: {str(e)}")
                logger.debug(f"同步异常详情: {traceback.format_exc()}")
                # 不影响主流程，继续执行

            # 更新ProjectIndex.md以反映当前workspace结构
            try:
                from app.services.workspace_service import workspace_service
                workspace_service.update_project_index_if_needed(task_id)
            except Exception as e:
                logger.error(f"更新ProjectIndex.md失败: {str(e)}")
                # 不影响主流程，继续执行

            # 只有在提供了result_queue的情况下才结束流
            if result_queue:
                result_queue.put(None)

            return True, None

        except Exception as e:
            # 检查是否是StreamCancelledException
            from app.services.conversation.stream_handler import StreamCancelledException

            if isinstance(e, StreamCancelledException):
                # 这是智能体被取消的情况，发送取消完成消息
                logger.info(f"[会话服务] 智能体 {agent_id} 被用户取消")

                try:
                    # 发送智能体取消完成消息
                    from app.services.conversation.message_formater import format_agent_cancel_done

                    # 获取智能体信息
                    agent = Agent.query.get(agent_id)
                    if agent:
                        agent_role = Role.query.get(agent.role_id) if hasattr(agent, 'role_id') and agent.role_id else None
                        role_name = agent_role.name if agent_role else "智能助手"

                        # 格式化取消完成消息
                        cancel_done_msg = format_agent_cancel_done(
                            agent_id=str(agent_id),
                            agent_name=agent.name,
                            role_name=role_name,
                            timestamp=None,
                            response_order=response_order or 1,
                            cancel_content=f"智能体响应被用户取消: {agent.name}({role_name})"
                        )

                        # 发送取消完成消息
                        if sse_callback:
                            sse_callback(cancel_done_msg["meta"])
                            logger.info(f"[会话服务] 已发送智能体 {agent_id} 取消完成消息")

                except Exception as format_error:
                    logger.error(f"[会话服务] 发送取消完成消息失败: {str(format_error)}")

                # 对于取消异常，不结束整个流，返回False让顺序处理继续下一个智能体
                return False, "智能体响应被用户取消"
            else:
                db.session.rollback()
                error_msg = f"处理智能体 {agent_id} 响应时出错: {str(e)}"
                logger.error(f"[会话服务] 异常: {error_msg}")
                traceback.print_exc()

                if result_queue:
                    try:
                        # 尝试发送错误事件
                        if sse_callback:
                            sse_callback({
                                "connectionStatus": "error",
                                "error": error_msg
                            })
                    except:
                        logger.error("发送错误事件失败")

                    # 结束流
                    result_queue.put(None)

                return False, str(e)

    # ==== 从prompts.py合并的方法 ====

    # extract_thinking函数已被移除，所有思考内容处理都在前端完成

    @staticmethod
    def send_model_request_stream(api_url: str, api_key: str, messages: List[Dict[str, str]],
                                model: str, callback: Callable = None, agent_info: Dict[str, Any] = None, **kwargs) -> str:
        """
        发送流式模型请求 (已废弃，请使用ModelClient.send_request替代)

        此方法仅作为向后兼容保留，内部已重构为使用ModelClient

        Args:
            api_url: API URL
            api_key: API密钥
            messages: 消息列表
            model: 模型名称
            callback: 回调函数，如果提供则使用流式响应
            agent_info: 智能体信息(可选)，包含角色和工具信息
            **kwargs: 其他参数

        Returns:
            如果是流式响应，返回首个chunk；否则返回完整响应
        """
        # 使用ModelClient代替直接实现
        model_client = ModelClient()
        is_stream = callback is not None

        return model_client.send_request(
            api_url=api_url,
            api_key=api_key,
            messages=messages,
            model=model,
            is_stream=is_stream,
            callback=callback,
            agent_info=agent_info,
            **kwargs
        )

    # ==== 自动讨论功能 ====
    # 自动讨论功能已移至 app/services/conversation/auto_conversation.py

    @staticmethod
    def add_message_to_conversation(conversation_id: int, message_data: Dict[str, Any], is_virtual: bool = False, isolation_mode: bool = False) -> Tuple[Optional[Message], Optional[Message]]:
        """将消息添加到会话，并获取智能体回复

        Args:
            conversation_id: 会话ID
            message_data: 消息数据，包含content、target_agent_id等
            is_virtual: 是否为虚拟消息（不存储到数据库）
            isolation_mode: 隔离模式，True时智能体只能看到自己与用户的消息历史

        Returns:
            Tuple[Message, Message]: (人类消息，智能体回复)
        """
        try:
            content = message_data.get('content')
            target_agent_id = message_data.get('target_agent_id')
            user_id = message_data.get('user_id')
            send_target = message_data.get('send_target')  # 获取发送目标

            # 检查虚拟消息
            if is_virtual:
                # 对于虚拟消息，不创建人类消息对象，直接处理智能体响应
                # 创建临时的human_message对象仅用于处理，不存入数据库
                temp_message = Message(
                    content=content,
                    role='human',
                    conversation_id=conversation_id
                )

                # 使用临时消息对象而不是None
                result = process_message_common(
                    conversation_id=conversation_id,
                    content=content,
                    target_agent_id=target_agent_id,
                    user_id=user_id,
                    no_new_message=True,
                    existing_human_message=temp_message,  # 使用临时消息对象
                    send_target=send_target,  # 使用传入的发送目标
                    isolation_mode=isolation_mode
                )

                # 设置human_message为None，保持返回值一致
                human_message = None
            else:
                # 正常消息处理流程
                result = process_message_common(
                    conversation_id=conversation_id,
                    content=content,
                    target_agent_id=target_agent_id,
                    user_id=user_id,
                    send_target=send_target,  # 使用传入的发送目标
                    isolation_mode=isolation_mode
                )

                # 从结果中获取human_message
                if result and len(result) == 9:
                    human_message = result[0]
                else:
                    human_message = None

            if not result or len(result) != 9:
                logger.error(f"处理消息时发生错误，结果无效: {result}")
                return None, None

            # 检查是否成功获取智能体信息
            if not result[1]:
                logger.warning(f"未找到智能体，无法生成回复")
                return human_message, None

            # 检查角色
            if not result[2]:
                logger.warning(f"智能体 {result[1].name} 没有关联角色，无法生成回复")
                return human_message, None

            # 检查模型
            if not result[3]:
                logger.warning(f"找不到 {result[1].name} 的可用模型，无法生成回复")
                return human_message, None

            # 检查是否为外部角色，使用相应的客户端
            agent_info = result[7]  # agent_info是索引7
            if agent_info.get('is_external', False):
                # 使用外部ModelClient处理外部角色
                from app.services.conversation.external_model_client import external_model_client

                # 构建角色配置，直接使用agent_info中的external_config
                role_config = {
                    'source': 'external',
                    'settings': {
                        'external_config': agent_info.get('external_config', {})
                    }
                }

                api_response = external_model_client.send_request_with_adapter(
                    role_config=role_config,
                    model_config=None,  # 外部角色不需要model_config
                    messages=result[4],
                    model=result[3].model_id,
                    is_stream=False,
                    agent_info=agent_info,
                    **result[6]
                )
            else:
                # 使用标准ModelClient处理内部角色
                model_client = ModelClient()
                api_response = model_client.send_request(
                    api_url=result[3].base_url,
                    api_key=result[3].api_key,
                    messages=result[4],
                    model=result[3].model_id,
                    is_stream=False,
                    agent_info=agent_info,
                    **result[6]
                )

            # 创建智能体回复消息
            # 判断智能体是否为监督者，决定消息角色和source
            agent = result[1]  # 智能体对象
            human_message = result[0]  # 用户消息对象
            is_supervisor = hasattr(agent, 'is_observer') and agent.is_observer
            message_role = 'supervisor' if is_supervisor else 'agent'

            # 检查是否是监督者干预（从用户消息的meta字段判断）
            is_intervention = False
            if human_message and human_message.meta and 'type' in human_message.meta:
                is_intervention = True

            # 设置消息source和meta
            if is_supervisor:
                message_source = 'supervisorConversation'
                # 如果是干预消息，设置相应的meta信息
                if is_intervention:
                    message_meta = {
                        'type': 'info'
                    }
                else:
                    message_meta = {}
            else:
                message_source = 'taskConversation'
                message_meta = {}

            agent_message = Message(
                content=api_response,
                role=message_role,
                source=message_source,
                meta=message_meta,
                agent_id=agent.id,
                action_task_id=result[5].action_task_id if result[5] else None,  # 修正：conversation是索引5
                conversation_id=conversation_id
            )

            db.session.add(agent_message)

            # 更新行动任务的updated_at时间
            task_id = result[5].action_task_id if result[5] else None
            if task_id:
                from app.utils.datetime_utils import get_current_time_with_timezone
                from app.models import ActionTask
                action_task = ActionTask.query.get(task_id)
                if action_task:
                    action_task.updated_at = get_current_time_with_timezone()
                    logger.debug(f"更新行动任务的updated_at时间: 任务ID={task_id}")

            db.session.commit()

            # 写入 Redis 消息缓存
            try:
                from core.model_cache import cache_message
                cache_message(agent_message)
            except Exception as _cache_err:
                logger.debug(f"Redis 缓存智能体消息失败（不影响业务）: {_cache_err}")

            return human_message, agent_message

        except Exception as e:
            db.session.rollback()
            logger.error(f"处理消息时出错: {str(e)}")
            traceback.print_exc()
            return None, None

