"""
会话 API 路由 (Conversations)

Flask → FastAPI 变更:
- Blueprint → APIRouter
- request.get_json() → await request.json()  (async handlers)
- request.args.get() → Query()
- jsonify(data) → return dict
- jsonify(data), 4xx/5xx → raise HTTPException
- current_app.logger → logging.getLogger(__name__)
- current_app.config → settings (from core.config)
- SSE: Response(generate(), mimetype=...) → StreamingResponse(generate(), media_type=...)

合并自: base.py, messages.py, stream.py, autonomous.py, plans.py, utils.py
"""
import logging
import queue
import threading
import traceback
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.models import (
    Conversation,
    ConversationAgent,
    ConversationPlan,
    ConversationPlanItem,
    Agent,
    ActionTask,
    AutonomousTask,
    AutonomousTaskExecution,
    Message,
    db,
)
from app.extensions import db as ext_db
from app.services.conversation_service import ConversationService
from app.services.subscription_service import SubscriptionService
from app.utils.uuid_utils import UUIDValidator
from app.utils.datetime_utils import get_current_time_with_timezone

logger = logging.getLogger(__name__)

router = APIRouter()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 工具函数 (原 utils.py)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def validate_conversation_access(task_id, conversation_id=None, current_user=None):
    """
    验证对话访问权限

    Args:
        task_id: Action Task ID
        conversation_id: Conversation ID (可选)
        current_user: 当前用户 (可选)

    Returns:
        (success, task, conversation, error_response)
        在 FastAPI 中 error_response 为 HTTPException 或 None
    """
    task = ActionTask.query.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail='任务不存在')

    conversation = None
    if conversation_id:
        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail='对话不存在')

        # 验证对话属于该任务
        if conversation.action_task_id != task_id:
            raise HTTPException(status_code=400, detail='对话不属于该任务')

    return True, task, conversation, None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 基础 CRUD (原 base.py)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get('/action-tasks/{task_id}/conversations')
def get_action_task_conversations(task_id: str):
    """获取行动任务的会话列表"""
    try:
        conversations = ConversationService.get_conversations(task_id)
        return {'conversations': conversations}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'获取会话列表失败: {str(e)}')


@router.post('/action-tasks/{task_id}/conversations', status_code=201)
async def create_action_task_conversation(task_id: str, request: Request):
    """创建新的行动任务会话"""
    data = await request.json()

    # 验证必填字段
    if 'title' not in data:
        raise HTTPException(status_code=400, detail='缺少必填字段: title')

    # 验证 source_conversation_id（如果提供）
    source_conversation_id = data.get('source_conversation_id')
    if source_conversation_id:
        source_conv = Conversation.query.get(source_conversation_id)
        if not source_conv:
            raise HTTPException(status_code=404, detail='源会话不存在')
        if source_conv.action_task_id != task_id:
            raise HTTPException(status_code=400, detail='源会话不属于该行动任务')

    try:
        result = ConversationService.create_conversation(task_id, data)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'创建会话失败: {str(e)}')


@router.get('/action-tasks/{task_id}/conversations/{conversation_id}')
def get_action_task_conversation(task_id: str, conversation_id: str):
    """获取行动任务的特定会话（Redis 缓存优化）"""
    try:
        conversation = Conversation.query.get(conversation_id)
        if not conversation or conversation.action_task_id != task_id:
            raise HTTPException(status_code=404, detail='会话未找到或不属于该行动任务')

        # 获取会话的智能体（优先 Redis 缓存）
        agents = []
        try:
            from core.model_cache import get_conversation_agents_cached, get_agent_cached
            cached_cas = get_conversation_agents_cached(conversation_id)
            if cached_cas:
                for ca in cached_cas:
                    agent_dict = get_agent_cached(ca.get('agent_id'))
                    if agent_dict:
                        agents.append({
                            'id': agent_dict['id'],
                            'name': agent_dict['name'],
                            'description': agent_dict.get('description'),
                            'avatar': agent_dict.get('avatar'),
                            'is_default': ca.get('is_default', False)
                        })
        except Exception:
            pass

        # Redis 未命中 → DB 查询
        if not agents:
            conv_agents = ConversationAgent.query.filter_by(conversation_id=conversation_id).all()
            for ca in conv_agents:
                agent = Agent.query.get(ca.agent_id)
                if agent:
                    agents.append({
                        'id': agent.id,
                        'name': agent.name,
                        'description': agent.description,
                        'avatar': agent.avatar if hasattr(agent, 'avatar') else None,
                        'is_default': ca.is_default
                    })

        agent_count = len(agents)

        # 消息计数（优先 Redis）
        try:
            from core.model_cache import get_conversation_message_count
            message_count = get_conversation_message_count(conversation_id)
        except Exception:
            message_count = Message.query.filter_by(conversation_id=conversation_id).count()

        result = {
            'id': conversation.id,
            'title': conversation.title,
            'description': conversation.description,
            'status': conversation.status,
            'mode': conversation.mode,
            'created_at': conversation.created_at.isoformat() if conversation.created_at else None,
            'updated_at': conversation.updated_at.isoformat() if conversation.updated_at else None,
            'agent_count': agent_count,
            'message_count': message_count,
            'agents': agents
        }

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'获取会话详情失败: {str(e)}')


@router.post('/action-tasks/{task_id}/conversations/{conversation_id}/summarize-context')
def summarize_conversation_context(task_id: str, conversation_id: str):
    """总结会话的上下文消息（自动总结功能）"""
    try:
        # 先 rollback 清除可能的脏 session（LLM 回复刚 commit，scoped_session 可能有残留）
        try:
            db.session.rollback()
        except Exception:
            pass
        
        conversation = Conversation.query.get(conversation_id)
        if not conversation or conversation.action_task_id != task_id:
            raise HTTPException(status_code=404, detail='会话未找到或不属于该行动任务')

        from app.services.summary_service import SummaryService
        result = SummaryService.summarize_context(conversation_id)

        return {
            'success': True,
            'message_id': result['message_id'],
            'summary_length': len(result['summary'])
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # 确保异常后 session 被清理，不污染后续请求（如紧接着的 GET /plans/active）
        try:
            db.session.rollback()
        except Exception:
            pass
        logger.error(f"总结上下文失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f'总结上下文失败: {str(e)}')


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 消息管理 (原 messages.py)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get('/action-tasks/{task_id}/conversations/{conversation_id}/messages')
def get_conversation_messages(task_id: str, conversation_id: str):
    """获取会话的消息列表"""
    try:
        messages = ConversationService.get_conversation_messages(task_id, conversation_id)
        return {'messages': messages}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'获取消息失败: {str(e)}')


@router.post('/action-tasks/{task_id}/conversations/{conversation_id}/messages')
async def create_conversation_message(
    task_id: str,
    conversation_id: str,
    request: Request,
    stream: str = Query('0'),
):
    """在会话中发送新消息

    支持普通和流式两种返回方式：
    - 普通方式：直接返回JSON响应
    - 流式方式：使用SSE方式流式返回响应，通过?stream=1指定

    参数：
    - content: 消息内容（必填）
    - target_agent_id: 目标智能体ID（可选，单个智能体）
    - target_agent_ids: 目标智能体ID列表（可选，多个智能体，优先级高于target_agent_id）
    - user_id: 用户ID（可选）
    """
    try:
        is_stream = stream == '1'

        # 检查会话是否存在且属于该行动任务
        conversation = Conversation.query.get(conversation_id)
        if not conversation or conversation.action_task_id != task_id:
            raise HTTPException(status_code=404, detail='会话未找到或不属于该行动任务')

        # 获取任务信息以统计今日对话
        task = ActionTask.query.get(task_id)
        if task and task.user_id:
            try:
                SubscriptionService.increment_usage(
                    task.user_id,
                    'daily_conversations',
                    1,
                    period_type='daily'
                )
            except Exception as e:
                logger.warning(f"统计今日对话失败: {e}")

        # 获取请求数据
        data = await request.json()
        content = data.get('content')

        # 验证必填字段
        if not content:
            raise HTTPException(status_code=400, detail='缺少必填字段: content')

        logger.debug(
            f"[会话路由] 接收到发送消息请求: conversation_id={conversation_id}, "
            f"content={content}, stream={is_stream}"
        )

        # 准备消息数据
        message_data = {
            'content': content,
            'user_id': data.get('user_id'),
            'isolation_mode': data.get('isolation_mode', False),
            'smart_dispatch': data.get('smart_dispatch', False),
            'enable_subagent': data.get('enable_subagent', False)
        }

        # 处理目标智能体ID（支持单个或多个）
        if 'target_agent_ids' in data:
            message_data['target_agent_ids'] = data.get('target_agent_ids')
            logger.debug(f"[会话路由] 使用多个目标智能体: {message_data['target_agent_ids']}")
        elif 'target_agent_id' in data:
            message_data['target_agent_id'] = data.get('target_agent_id')
            logger.debug(f"[会话路由] 使用单个目标智能体: {message_data['target_agent_id']}")

        # 处理发送目标（监督者功能）
        send_target = data.get('send_target', 'task')
        message_data['send_target'] = send_target
        logger.debug(f"[会话路由] 发送目标: {send_target}")

        # 根据模式处理消息
        if not is_stream:
            # 普通模式
            human_message, agent_message = ConversationService.add_message_to_conversation(
                conversation_id, message_data
            )

            if not human_message:
                error_detail = "会话服务未能创建人类消息"
                logger.debug(f"错误: {error_detail}")
                raise HTTPException(status_code=500, detail=error_detail)

            result = {
                'message': '消息添加成功',
                'id': human_message.id,
                'human_message': {
                    'id': human_message.id,
                    'content': human_message.content,
                    'role': human_message.role,
                    'source': getattr(human_message, 'source', 'taskConversation'),
                    'agent_id': human_message.agent_id,
                    'created_at': human_message.created_at.isoformat() if human_message.created_at else None
                }
            }

            if agent_message:
                result['response'] = {
                    'id': agent_message.id,
                    'content': agent_message.content,
                    'role': agent_message.role,
                    'source': getattr(agent_message, 'source', 'taskConversation'),
                    'agent_id': agent_message.agent_id,
                    'created_at': agent_message.created_at.isoformat() if agent_message.created_at else None
                }

                if agent_message.agent_id:
                    agent = Agent.query.get(agent_message.agent_id)
                    if agent:
                        result['response']['agent_name'] = agent.name
                        result['response']['agent'] = {
                            'id': agent.id,
                            'name': agent.name,
                            'description': agent.description
                        }

            return result

        # 流式模式：创建队列和回调
        result_queue = queue.Queue()

        # 启动后台线程处理流式响应
        # NOTE: FastAPI 中无需传递 app_context，第一个参数传 None
        thread = threading.Thread(
            target=ConversationService.process_stream_message,
            args=(None, task_id, conversation_id, message_data, result_queue)
        )
        thread.daemon = True
        thread.start()

        # 返回 SSE 响应
        from app.services.conversation.stream_handler import queue_to_sse
        return StreamingResponse(
            queue_to_sse(result_queue),
            media_type='text/event-stream',
            headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.debug(f"消息处理异常: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'处理消息失败: {str(e)}')


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 流式处理 / 自动讨论 (原 stream.py)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post('/action-tasks/{task_id}/conversations/{conversation_id}/auto-discussion')
async def start_auto_discussion(
    task_id: str,
    conversation_id: str,
    request: Request,
    stream: str = Query('0'),
):
    """
    启动智能体自动讨论

    参数：
    - rounds: 讨论轮数，每轮指所有智能体各发言一次
    - topic: 讨论主题 (可选)
    - summarize: 是否在讨论结束后进行总结 (默认为True)
    - summarizerAgentId: 指定进行总结的智能体ID (可选，默认使用第一个智能体)
    """
    try:
        # 检查会话是否存在且属于该行动任务
        conversation = Conversation.query.get(conversation_id)
        if not conversation or conversation.action_task_id != task_id:
            raise HTTPException(status_code=404, detail='会话未找到或不属于该行动任务')

        # 获取请求数据
        data = await request.json()

        # 判断任务类型
        is_infinite = data.get('isInfinite', False)
        is_time_trigger = data.get('isTimeTrigger', False)
        is_variable_trigger = data.get('isVariableTrigger', False)

        is_stream = stream == '1'

        # 检查会话中是否有智能体
        conv_agents = ConversationAgent.query.filter_by(conversation_id=conversation_id).all()
        if not conv_agents or len(conv_agents) < 1:
            raise HTTPException(status_code=400, detail='会话中至少需要一个智能体才能进行自动讨论')

        if is_infinite:
            # ── 变量停止模式 ──
            topic = data.get('topic', '请基于各自角色和知识，持续进行行动，直到满足停止条件')
            stop_conditions = data.get('stopConditions', [])
            condition_logic = data.get('conditionLogic', 'and')
            try:
                max_runtime = int(data.get('maxRuntime', 0))
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail='最大运行时间必须是有效的数字')

            enable_planning = data.get('enablePlanning', False)
            planner_agent_id = data.get('plannerAgentId')

            config = {
                'topic': topic,
                'stopConditions': stop_conditions,
                'conditionLogic': condition_logic,
                'maxRuntime': max_runtime,
                'enable_planning': enable_planning,
                'planner_agent_id': planner_agent_id
            }

            from app.services.scheduler import start_task
            result_queue = queue.Queue() if is_stream else None

            result = start_task(
                task_id=task_id,
                conversation_id=conversation_id,
                task_type='conditional_stop',
                config=config,
                streaming=is_stream,
                result_queue=result_queue
            )

            if not is_stream:
                return result
            else:
                from app.services.conversation.stream_handler import queue_to_sse
                return StreamingResponse(
                    queue_to_sse(result_queue),
                    media_type='text/event-stream'
                )

        elif is_time_trigger:
            # ── 时间触发模式 ──
            try:
                try:
                    time_interval = int(data.get('timeInterval', 30))
                    max_executions = int(data.get('maxExecutions', 0))
                    total_time_limit = int(data.get('totalTimeLimit', 1440))
                except (ValueError, TypeError) as e:
                    raise HTTPException(
                        status_code=400,
                        detail=f'时间触发配置参数必须是有效的数字: {str(e)}'
                    )

                config = {
                    'timeInterval': time_interval,
                    'intervalMinutes': time_interval,
                    'maxExecutions': max_executions,
                    'triggerAction': 'single_round',
                    'enableTimeLimit': data.get('enableTimeLimit', False),
                    'totalTimeLimit': total_time_limit,
                    'topic': data.get('topic', '请基于各自角色和知识，持续进行行动'),
                    'speakingMode': data.get('speakingMode', 'sequential'),
                    'enablePlanning': data.get('enablePlanning', False),
                    'plannerAgentId': data.get('plannerAgentId')
                }

                if time_interval < 1 or time_interval > 1440:
                    raise HTTPException(
                        status_code=400,
                        detail=f'时间间隔必须在1-1440分钟之间，当前值: {time_interval}'
                    )

                if max_executions < 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f'最大执行次数不能为负数，当前值: {max_executions}'
                    )

                if config['enableTimeLimit']:
                    if total_time_limit < 1 or total_time_limit > 10080:
                        raise HTTPException(
                            status_code=400,
                            detail=f'总时长限制必须在1-10080分钟之间，当前值: {total_time_limit}'
                        )

                logger.info(
                    f"启动时间触发模式: task_id={task_id}, "
                    f"conversation_id={conversation_id}, config={config}"
                )

                from app.services.scheduler import start_task
                result_queue = queue.Queue() if is_stream else None

                result = start_task(
                    task_id=task_id,
                    conversation_id=conversation_id,
                    task_type='time_trigger',
                    config=config,
                    streaming=is_stream,
                    result_queue=result_queue
                )

                if not is_stream:
                    return result
                else:
                    from app.services.conversation.stream_handler import queue_to_sse
                    return StreamingResponse(
                        queue_to_sse(result_queue),
                        media_type='text/event-stream'
                    )

            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"启动时间触发模式失败: {str(e)}")
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f'启动时间触发模式失败: {str(e)}')

        elif is_variable_trigger:
            # ── 变量触发模式 ──
            try:
                try:
                    check_interval = int(data.get('checkInterval', 5))
                    max_triggers = int(data.get('maxTriggerExecutions', 0))
                    max_runtime = int(data.get('totalTimeLimit', 0))
                except (ValueError, TypeError) as e:
                    raise HTTPException(
                        status_code=400,
                        detail=f'变量触发配置参数必须是有效的数字: {str(e)}'
                    )

                config = {
                    'topic': data.get('topic', '请基于各自角色和知识，响应变量变化进行行动'),
                    'triggerConditions': data.get('triggerConditions', []),
                    'conditionLogic': data.get('triggerConditionLogic', 'or'),
                    'checkInterval': check_interval,
                    'maxTriggers': max_triggers,
                    'maxRuntime': max_runtime,
                    'enable_planning': data.get('enablePlanning', False),
                    'planner_agent_id': data.get('plannerAgentId')
                }

                from app.services.scheduler import start_task
                result_queue = queue.Queue() if is_stream else None

                result = start_task(
                    task_id=task_id,
                    conversation_id=conversation_id,
                    task_type='variable_trigger',
                    config=config,
                    streaming=is_stream,
                    result_queue=result_queue
                )

                if not is_stream:
                    return result
                else:
                    from app.services.conversation.stream_handler import queue_to_sse
                    return StreamingResponse(
                        queue_to_sse(result_queue),
                        media_type='text/event-stream'
                    )

            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"启动变量触发模式失败: {str(e)}")
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f'启动变量触发模式失败: {str(e)}')

        else:
            # ── 传统讨论模式 ──
            try:
                rounds = int(data.get('rounds', 1))
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail='讨论轮数必须是有效的整数')

            topic = data.get('topic', '请基于各自角色和知识，进行一次有深度的讨论')
            summarize = data.get('summarize', True)
            summarizer_agent_id = data.get('summarizerAgentId')
            enable_planning = data.get('enablePlanning', False)
            planner_agent_id = data.get('plannerAgentId')

            if rounds <= 0:
                raise HTTPException(status_code=400, detail='讨论轮数必须是大于0的整数')

            config = {
                'rounds': rounds,
                'topic': topic,
                'summarize': summarize,
                'summarizer_agent_id': summarizer_agent_id,
                'enable_planning': enable_planning,
                'planner_agent_id': planner_agent_id
            }

            from app.services.scheduler import start_task
            result_queue = queue.Queue() if is_stream else None

            result = start_task(
                task_id=task_id,
                conversation_id=conversation_id,
                task_type='discussion',
                config=config,
                streaming=is_stream,
                result_queue=result_queue
            )

            if not is_stream:
                return result
            else:
                from app.services.conversation.stream_handler import queue_to_sse
                return StreamingResponse(
                    queue_to_sse(result_queue),
                    media_type='text/event-stream'
                )

    except HTTPException:
        raise
    except Exception as e:
        logger.debug(f"自动讨论处理异常: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'处理自动讨论失败: {str(e)}')


@router.post('/action-tasks/{task_id}/conversations/{conversation_id}/cancel-stream')
async def cancel_streaming_response(task_id: str, conversation_id: str, request: Request):
    """取消当前正在进行的流式响应

    用于客户端中断当前流式输出并切换到下一个智能体（如果有）

    可选参数：
    - agent_id: 智能体ID，如果提供则只取消该智能体的流式任务
    """
    try:
        from app.services.conversation.stream_handler import cancel_streaming_task

        data = await request.json() if await request.body() else {}
        agent_id = data.get('agent_id')

        success = cancel_streaming_task(task_id, conversation_id, agent_id)

        # 如果是会话层面的"停止"（未指定agent_id），并且存在自主任务，顺带停止
        if success and not agent_id:
            try:
                active_autonomous_tasks = AutonomousTask.query.filter_by(
                    conversation_id=conversation_id,
                    status='active'
                ).all()

                if active_autonomous_tasks:
                    from app.services.scheduler.task_adapter import stop_task
                    for auto_task in active_autonomous_tasks:
                        try:
                            stop_task(task_id, conversation_id, auto_task.type)
                            logger.info(
                                f"已在取消流式响应时停止自主任务: type={auto_task.type}, "
                                f"conversation_id={conversation_id}"
                            )
                        except Exception as e:
                            logger.error(f"停止自主任务 {auto_task.type} 失败: {str(e)}")

            except Exception as stop_err:
                logger.error(f"取消流式响应时停止自主任务失败: {str(stop_err)}")

        if success:
            if agent_id:
                message = f"成功取消智能体 {agent_id} 的流式响应"
            else:
                message = "成功取消流式响应"
            return {'success': success, 'message': message, 'agent_id': agent_id}
        else:
            if agent_id:
                message = f"没有找到智能体 {agent_id} 的活动流式响应任务"
            else:
                message = "没有找到活动的流式响应任务"
            raise HTTPException(status_code=404, detail=message)

    except HTTPException:
        raise
    except Exception as e:
        logger.debug(f"取消流式响应异常: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'取消流式响应失败: {str(e)}')


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 自主任务管理 (原 autonomous.py)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get('/action-tasks/{task_id}/autonomous-tasks')
def get_action_task_autonomous_tasks(task_id: str):
    """获取行动任务的所有自主任务记录"""
    try:
        action_task = ActionTask.query.get(task_id)
        if not action_task:
            raise HTTPException(status_code=404, detail='行动任务未找到')

        autonomous_tasks = AutonomousTask.query.join(Conversation).filter(
            Conversation.action_task_id == task_id
        ).order_by(AutonomousTask.created_at.desc()).all()

        result = []
        for task in autonomous_tasks:
            executions = AutonomousTaskExecution.query.filter_by(
                autonomous_task_id=task.id
            ).order_by(AutonomousTaskExecution.created_at.desc()).all()

            execution_list = []
            for execution in executions:
                execution_data = {
                    'id': execution.id,
                    'execution_type': execution.execution_type,
                    'trigger_source': execution.trigger_source,
                    'trigger_data': execution.trigger_data,
                    'status': execution.status,
                    'start_time': execution.start_time.isoformat() if execution.start_time else None,
                    'end_time': execution.end_time.isoformat() if execution.end_time else None,
                    'result': execution.result,
                    'error_message': execution.error_message,
                    'created_at': execution.created_at.isoformat() if execution.created_at else None
                }
                execution_list.append(execution_data)

            conversation = Conversation.query.get(task.conversation_id)
            conversation_info = {
                'id': conversation.id,
                'name': conversation.title if conversation else f'会话 {task.conversation_id}'
            } if conversation else {'id': task.conversation_id, 'name': f'会话 {task.conversation_id}'}

            task_data = {
                'id': task.id,
                'conversation_id': task.conversation_id,
                'conversation': conversation_info,
                'type': task.type,
                'status': task.status,
                'config': task.config,
                'created_at': task.created_at.isoformat() if task.created_at else None,
                'updated_at': task.updated_at.isoformat() if task.updated_at else None,
                'executions': execution_list
            }
            result.append(task_data)

        return {
            'autonomous_tasks': result,
            'total': len(result)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取行动任务自主任务记录失败: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'获取行动任务自主任务记录失败: {str(e)}')


@router.get('/action-tasks/{task_id}/conversations/{conversation_id}/autonomous-tasks')
def get_conversation_autonomous_tasks(task_id: str, conversation_id: str):
    """获取特定会话的自主任务记录（保持兼容性）"""
    try:
        conversation = Conversation.query.get(conversation_id)
        if not conversation or conversation.action_task_id != task_id:
            raise HTTPException(status_code=404, detail='会话未找到或不属于该行动任务')

        autonomous_tasks = AutonomousTask.query.filter_by(
            conversation_id=conversation_id
        ).order_by(AutonomousTask.created_at.desc()).all()

        result = []
        for task in autonomous_tasks:
            executions = AutonomousTaskExecution.query.filter_by(
                autonomous_task_id=task.id
            ).order_by(AutonomousTaskExecution.created_at.desc()).all()

            execution_list = []
            for execution in executions:
                execution_data = {
                    'id': execution.id,
                    'execution_type': execution.execution_type,
                    'trigger_source': execution.trigger_source,
                    'trigger_data': execution.trigger_data,
                    'status': execution.status,
                    'start_time': execution.start_time.isoformat() if execution.start_time else None,
                    'end_time': execution.end_time.isoformat() if execution.end_time else None,
                    'result': execution.result,
                    'error_message': execution.error_message,
                    'created_at': execution.created_at.isoformat() if execution.created_at else None
                }
                execution_list.append(execution_data)

            conversation_info = {
                'id': conversation.id,
                'name': conversation.title if conversation else f'会话 {conversation_id}'
            }

            task_data = {
                'id': task.id,
                'conversation_id': task.conversation_id,
                'conversation': conversation_info,
                'type': task.type,
                'status': task.status,
                'config': task.config,
                'created_at': task.created_at.isoformat() if task.created_at else None,
                'updated_at': task.updated_at.isoformat() if task.updated_at else None,
                'executions': execution_list
            }
            result.append(task_data)

        return {
            'autonomous_tasks': result,
            'total': len(result)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取会话自主任务记录失败: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'获取会话自主任务记录失败: {str(e)}')


@router.post('/action-tasks/{task_id}/conversations/{conversation_id}/autonomous-tasks/{autonomous_task_id}/stop')
def stop_autonomous_task(task_id: str, conversation_id: str, autonomous_task_id: str):
    """停止指定的自主任务"""
    try:
        conversation = Conversation.query.get(conversation_id)
        if not conversation or conversation.action_task_id != task_id:
            raise HTTPException(status_code=404, detail='会话未找到或不属于该行动任务')

        autonomous_task = AutonomousTask.query.get(autonomous_task_id)
        if not autonomous_task or autonomous_task.conversation_id != conversation_id:
            raise HTTPException(status_code=404, detail='自主任务未找到或不属于该会话')

        if autonomous_task.status != 'active':
            raise HTTPException(
                status_code=400,
                detail=f'任务当前状态为{autonomous_task.status}，无法停止'
            )

        success = False
        error_message = None

        try:
            from app.services.scheduler import stop_task
            success = stop_task(task_id, conversation_id, autonomous_task.type)

            if success:
                logger.info(f"使用新调度器成功停止任务: task_id={task_id}, type={autonomous_task.type}")
            else:
                logger.warning("新调度器中未找到任务，直接更新数据库状态")
                success = True

            from app.services.conversation.stream_handler import cancel_streaming_task
            cancel_streaming_task(task_id, conversation_id)
            logger.info(f"已取消流式响应: task_id={task_id}, conversation_id={conversation_id}")

        except Exception as e:
            logger.error(f"调用停止函数失败: {str(e)}")
            error_message = f'停止任务时出错: {str(e)}'

        if success:
            try:
                db.session.refresh(autonomous_task)

                if autonomous_task.status == 'active':
                    autonomous_task.status = 'stopped'
                    logger.info(f"手动更新自主任务状态为stopped: {autonomous_task_id}")

                    latest_execution = AutonomousTaskExecution.query.filter_by(
                        autonomous_task_id=autonomous_task_id,
                        status='running'
                    ).order_by(AutonomousTaskExecution.created_at.desc()).first()

                    if latest_execution:
                        latest_execution.status = 'stopped'
                        latest_execution.end_time = datetime.now()
                        latest_execution.result = {
                            'status': 'stopped',
                            'message': '任务被用户手动停止'
                        }
                        logger.info(f"更新执行记录状态为stopped: {latest_execution.id}")

                    db.session.commit()
                    logger.info("数据库状态更新完成")
                else:
                    logger.info(f"任务状态已经是: {autonomous_task.status}")

                return {
                    'status': 'success',
                    'message': '自主任务已停止',
                    'autonomous_task_id': autonomous_task_id
                }
            except Exception as e:
                logger.error(f"更新任务状态失败: {str(e)}")
                traceback.print_exc()
                raise HTTPException(
                    status_code=500,
                    detail=f'任务已停止，但更新状态失败: {str(e)}'
                )
        else:
            raise HTTPException(
                status_code=500,
                detail=error_message or '停止任务失败'
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"停止自主任务失败: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'停止自主任务失败: {str(e)}')


@router.post('/action-tasks/{task_id}/conversations/{conversation_id}/autonomous-scheduling')
async def start_autonomous_scheduling(task_id: str, conversation_id: str, request: Request):
    """
    启动自主调度模式

    参数：
    - topic: 任务主题（可选）
    - planner_agent_id: 计划智能体ID（可选，不指定则使用第一个智能体）
    - max_rounds: 最大轮数（默认50）
    - timeout_minutes: 超时时间（默认60分钟）
    - stream: 是否使用流式输出（默认true，推荐使用流式响应）
    """
    try:
        # 验证UUID格式
        validation_error = UUIDValidator.validate_request_uuid(task_id, "task_id")
        if validation_error:
            raise HTTPException(status_code=validation_error.get("code", 400), detail=validation_error)

        validation_error = UUIDValidator.validate_request_uuid(conversation_id, "conversation_id")
        if validation_error:
            raise HTTPException(status_code=validation_error.get("code", 400), detail=validation_error)

        data = await request.json() if await request.body() else {}

        topic = data.get('topic', '请基于各自角色和知识，进行自主调度协作')
        planner_agent_id = data.get('plannerAgentId')
        max_rounds = int(data.get('maxRounds', 50))
        timeout_minutes = int(data.get('timeoutMinutes', 60))
        is_stream = data.get('stream', True)

        enable_planning = data.get('enablePlanning', False)

        config = {
            'topic': topic,
            'enable_planning': enable_planning,
            'planner_agent_id': planner_agent_id,
            'max_rounds': max_rounds,
            'maxRounds': max_rounds,
            'timeout_minutes': timeout_minutes,
            'timeoutMinutes': timeout_minutes
        }

        from app.services.scheduler import start_task
        result_queue = queue.Queue() if is_stream else None

        result = start_task(
            task_id=task_id,
            conversation_id=conversation_id,
            task_type='autonomous_scheduling',
            config=config,
            streaming=is_stream,
            result_queue=result_queue
        )

        if not is_stream:
            return result
        else:
            from app.services.conversation.stream_handler import queue_to_sse
            return StreamingResponse(
                queue_to_sse(result_queue),
                media_type='text/event-stream'
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"启动自主调度模式失败: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'启动自主调度模式失败: {str(e)}')


@router.post('/action-tasks/{task_id}/conversations/{conversation_id}/autonomous-tasks/{autonomous_task_id}/pause')
def pause_autonomous_task(task_id: str, conversation_id: str, autonomous_task_id: str):
    """
    暂停指定的自主任务

    暂停后任务会在当前轮次完成后停止执行，直到恢复
    """
    try:
        conversation = Conversation.query.get(conversation_id)
        if not conversation or conversation.action_task_id != task_id:
            raise HTTPException(status_code=404, detail='会话未找到或不属于该行动任务')

        autonomous_task = AutonomousTask.query.get(autonomous_task_id)
        if not autonomous_task or autonomous_task.conversation_id != conversation_id:
            raise HTTPException(status_code=404, detail='自主任务未找到或不属于该会话')

        if autonomous_task.status != 'active':
            raise HTTPException(
                status_code=400,
                detail=f'任务当前状态为{autonomous_task.status}，无法暂停'
            )

        from app.services.scheduler import pause_task
        success = pause_task(task_id, conversation_id)

        if success:
            autonomous_task.status = 'paused'
            db.session.commit()

            return {
                'status': 'success',
                'message': '自主任务已暂停',
                'autonomous_task_id': autonomous_task_id
            }
        else:
            raise HTTPException(
                status_code=400,
                detail='暂停任务失败，任务可能未在新调度器中运行'
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"暂停自主任务失败: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'暂停自主任务失败: {str(e)}')


@router.post('/action-tasks/{task_id}/conversations/{conversation_id}/autonomous-tasks/{autonomous_task_id}/resume')
def resume_autonomous_task(task_id: str, conversation_id: str, autonomous_task_id: str):
    """
    恢复指定的自主任务

    恢复已暂停的任务，继续执行
    """
    try:
        conversation = Conversation.query.get(conversation_id)
        if not conversation or conversation.action_task_id != task_id:
            raise HTTPException(status_code=404, detail='会话未找到或不属于该行动任务')

        autonomous_task = AutonomousTask.query.get(autonomous_task_id)
        if not autonomous_task or autonomous_task.conversation_id != conversation_id:
            raise HTTPException(status_code=404, detail='自主任务未找到或不属于该会话')

        if autonomous_task.status != 'paused':
            raise HTTPException(
                status_code=400,
                detail=f'任务当前状态为{autonomous_task.status}，无法恢复'
            )

        from app.services.scheduler import resume_task
        success = resume_task(task_id, conversation_id)

        if success:
            autonomous_task.status = 'active'
            db.session.commit()

            return {
                'status': 'success',
                'message': '自主任务已恢复',
                'autonomous_task_id': autonomous_task_id
            }
        else:
            raise HTTPException(
                status_code=400,
                detail='恢复任务失败，任务可能未在新调度器中运行'
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"恢复自主任务失败: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'恢复自主任务失败: {str(e)}')


@router.get('/action-tasks/{task_id}/conversations/{conversation_id}/autonomous-tasks/{autonomous_task_id}/status')
def get_autonomous_task_status(task_id: str, conversation_id: str, autonomous_task_id: str):
    """
    获取自主任务的实时状态

    返回调度器中任务的详细状态信息
    """
    try:
        conversation = Conversation.query.get(conversation_id)
        if not conversation or conversation.action_task_id != task_id:
            raise HTTPException(status_code=404, detail='会话未找到或不属于该行动任务')

        autonomous_task = AutonomousTask.query.get(autonomous_task_id)
        if not autonomous_task or autonomous_task.conversation_id != conversation_id:
            raise HTTPException(status_code=404, detail='自主任务未找到或不属于该会话')

        from app.services.scheduler import get_task_status
        scheduler_status = get_task_status(task_id, conversation_id)

        latest_execution = AutonomousTaskExecution.query.filter_by(
            autonomous_task_id=autonomous_task_id
        ).order_by(AutonomousTaskExecution.created_at.desc()).first()

        rounds_completed = None
        if latest_execution and latest_execution.result:
            rounds_completed = latest_execution.result.get('rounds')

        return {
            'autonomous_task': {
                'id': autonomous_task.id,
                'type': autonomous_task.type,
                'status': autonomous_task.status,
                'config': autonomous_task.config,
                'created_at': autonomous_task.created_at.isoformat() if autonomous_task.created_at else None
            },
            'scheduler_status': scheduler_status,
            'latest_execution': {
                'id': latest_execution.id,
                'status': latest_execution.status,
                'rounds_completed': rounds_completed,
                'start_time': latest_execution.start_time.isoformat() if latest_execution.start_time else None,
                'end_time': latest_execution.end_time.isoformat() if latest_execution.end_time else None
            } if latest_execution else None
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取自主任务状态失败: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'获取自主任务状态失败: {str(e)}')


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 计划管理 (原 plans.py)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get('/conversations/{conversation_id}/plans')
def get_conversation_plans(
    conversation_id: str,
    status: Optional[str] = Query(None),
):
    """
    获取会话的所有计划

    Query Parameters:
        status: 筛选状态（active/completed/cancelled）可选
    """
    try:
        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail='会话不存在')

        plans = ConversationPlan.query.filter_by(
            conversation_id=conversation_id
        ).order_by(ConversationPlan.created_at.desc()).all()

        if status:
            filtered_plans = []
            for plan in plans:
                plan_dict = plan.to_dict(include_items=True, include_progress=True)
                if plan_dict.get('status') == status:
                    filtered_plans.append(plan_dict)
            return filtered_plans

        return [plan.to_dict(include_items=True, include_progress=True) for plan in plans]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取会话计划失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f'获取计划失败: {str(e)}')


@router.get('/conversations/{conversation_id}/plans/active')
def get_active_plan(conversation_id: str):
    """
    获取当前会话的最新计划（包括已完成的计划）
    如果没有计划，返回 null 而不是 404 错误
    
    Redis 缓存：整体结果缓存 30s（前端高频轮询接口）
    """
    try:
        # 优先从 Redis 缓存读取
        try:
            from core.cache import cached_query
            cache_key = f"active_plan:{conversation_id}"

            def _load_active_plan():
                # rollback 确保 session 干净
                try:
                    db.session.rollback()
                except Exception:
                    pass
                
                conv = Conversation.query.get(conversation_id)
                if not conv:
                    return '__NOT_FOUND__'
                
                plan = ConversationPlan.query.filter_by(
                    conversation_id=conversation_id
                ).order_by(ConversationPlan.created_at.desc()).first()
                
                if not plan:
                    return None
                return plan.to_dict(include_items=True, include_progress=True)

            result = cached_query(cache_key, 30, _load_active_plan)
            if result == '__NOT_FOUND__':
                raise HTTPException(status_code=404, detail='会话不存在')
            return result
        except HTTPException:
            raise
        except Exception as _cache_err:
            logger.debug(f"Redis 缓存 active_plan 失败（fallback DB）: {_cache_err}")

        # fallback: 原始逻辑
        try:
            db.session.rollback()
        except Exception:
            pass
        
        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail='会话不存在')

        plan = ConversationPlan.query.filter_by(
            conversation_id=conversation_id
        ).order_by(ConversationPlan.created_at.desc()).first()

        if not plan:
            return None

        return plan.to_dict(include_items=True, include_progress=True)

    except HTTPException:
        raise
    except Exception as e:
        try:
            db.session.rollback()
        except Exception:
            pass
        logger.error(f"获取活跃计划失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f'获取活跃计划失败: {str(e)}')


@router.get('/conversations/{conversation_id}/plans/{plan_id}')
def get_plan_detail(conversation_id: str, plan_id: str):
    """获取计划详情"""
    try:
        plan = ConversationPlan.query.filter_by(
            id=plan_id,
            conversation_id=conversation_id
        ).first()

        if not plan:
            raise HTTPException(status_code=404, detail='计划不存在')

        return plan.to_dict(include_items=True, include_progress=True)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取计划详情失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f'获取计划详情失败: {str(e)}')


@router.put('/conversations/{conversation_id}/plans/{plan_id}')
async def update_plan(conversation_id: str, plan_id: str, request: Request):
    """更新计划信息（标题、描述）"""
    try:
        plan = ConversationPlan.query.filter_by(
            id=plan_id,
            conversation_id=conversation_id
        ).first()

        if not plan:
            raise HTTPException(status_code=404, detail='计划不存在')

        data = await request.json()

        if 'title' in data:
            plan.title = data['title']
        if 'description' in data:
            plan.description = data['description']

        plan.updated_at = get_current_time_with_timezone()

        db.session.commit()

        # 失效 active_plan 缓存
        try:
            from core.cache import invalidate_keys
            invalidate_keys(f"active_plan:{conversation_id}")
        except Exception:
            pass

        return plan.to_dict(include_items=True, include_progress=True)

    except HTTPException:
        raise
    except Exception as e:
        db.session.rollback()
        logger.error(f"更新计划失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f'更新计划失败: {str(e)}')


@router.delete('/conversations/{conversation_id}/plans/{plan_id}')
def delete_plan(conversation_id: str, plan_id: str):
    """删除计划"""
    try:
        plan = ConversationPlan.query.filter_by(
            id=plan_id,
            conversation_id=conversation_id
        ).first()

        if not plan:
            raise HTTPException(status_code=404, detail='计划不存在')

        db.session.delete(plan)
        db.session.commit()

        # 失效 active_plan 缓存
        try:
            from core.cache import invalidate_keys
            invalidate_keys(f"active_plan:{conversation_id}")
        except Exception:
            pass

        return {'message': '计划已删除'}

    except HTTPException:
        raise
    except Exception as e:
        db.session.rollback()
        logger.error(f"删除计划失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f'删除计划失败: {str(e)}')


@router.get('/conversations/{conversation_id}/plans/{plan_id}/items')
def get_plan_items(conversation_id: str, plan_id: str):
    """获取计划的所有任务项"""
    try:
        plan = ConversationPlan.query.filter_by(
            id=plan_id,
            conversation_id=conversation_id
        ).first()

        if not plan:
            raise HTTPException(status_code=404, detail='计划不存在')

        items = ConversationPlanItem.query.filter_by(
            plan_id=plan_id
        ).order_by(ConversationPlanItem.order_index).all()

        return [item.to_dict() for item in items]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取计划项失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f'获取计划项失败: {str(e)}')


@router.put('/conversations/{conversation_id}/plans/{plan_id}/items/{item_id}')
async def update_plan_item(
    conversation_id: str,
    plan_id: str,
    item_id: str,
    request: Request,
):
    """更新计划项（主要用于状态更新）"""
    try:
        plan = ConversationPlan.query.filter_by(
            id=plan_id,
            conversation_id=conversation_id
        ).first()

        if not plan:
            raise HTTPException(status_code=404, detail='计划不存在')

        item = ConversationPlanItem.query.filter_by(
            id=item_id,
            plan_id=plan_id
        ).first()

        if not item:
            raise HTTPException(status_code=404, detail='计划项不存在')

        data = await request.json()

        if 'status' in data:
            valid_statuses = ['pending', 'in_progress', 'completed', 'cancelled']
            if data['status'] not in valid_statuses:
                raise HTTPException(
                    status_code=400,
                    detail=f"无效的状态值: {data['status']}"
                )
            item.status = data['status']

        if 'title' in data:
            item.title = data['title']
        if 'description' in data:
            item.description = data['description']

        item.updated_at = get_current_time_with_timezone()
        plan.updated_at = get_current_time_with_timezone()

        db.session.commit()

        # 失效 active_plan 缓存
        try:
            from core.cache import invalidate_keys
            invalidate_keys(f"active_plan:{conversation_id}")
        except Exception:
            pass

        return item.to_dict()

    except HTTPException:
        raise
    except Exception as e:
        db.session.rollback()
        logger.error(f"更新计划项失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f'更新计划项失败: {str(e)}')
