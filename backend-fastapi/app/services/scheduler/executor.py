"""
执行器模块

负责执行一轮任务，调用现有的流层处理Agent响应

SSE消息发送：
- connected: 任务开始时
- round_info: 每轮开始时
- agent_info: 每个Agent开始响应前
- all_agents_done / done: 任务完成时
"""

import asyncio
import logging
import traceback
from typing import List, Dict, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from .scheduler import Task

logger = logging.getLogger(__name__)


def _send_sse_message(task: 'Task', message: dict):
    """发送SSE消息到前端"""
    if task.result_queue:
        from app.services.conversation.message_formater import serialize_message
        task.result_queue.put(serialize_message(message))


def _send_connected(task: 'Task'):
    """发送连接成功消息"""
    from app.services.conversation.message_formater import format_connection_status
    _send_sse_message(task, format_connection_status('connected'))


def _send_round_info(task: 'Task', round_num: int, total_rounds: int):
    """发送轮次信息"""
    from app.services.conversation.message_formater import format_round_info
    _send_sse_message(task, format_round_info(round_num, total_rounds))


def _send_agent_info(task: 'Task', agent: dict, round_num: int, total_rounds: int, 
                     response_order: int, total_agents: int, is_summarizing: bool = False,
                     is_dynamic_mode: bool = False):
    """发送Agent信息
    
    Args:
        is_dynamic_mode: 是否为自主调度模式，如果是则使用"步骤"而不是"轮次"
    """
    from app.models import Agent as AgentModel, Role
    from app.services.conversation.message_formater import format_agent_info
    
    agent_obj = AgentModel.query.get(agent['id'])
    if agent_obj:
        role = Role.query.get(agent_obj.role_id) if agent_obj.role_id else None
        role_name = role.name if role else "智能助手"
        
        if is_summarizing:
            turn_prompt = f"由智能体 {agent_obj.name}({role_name}) 总结任务"
        elif is_dynamic_mode:
            # 自主调度模式：使用"步骤"而不是"轮次"
            turn_prompt = f"智能体 {agent_obj.name}({role_name}) 开始执行"
        else:
            turn_prompt = f"轮到智能体 {agent_obj.name}({role_name}) 发言"
        
        msg = format_agent_info(
            turn_prompt=turn_prompt,
            agent_id=str(agent['id']),
            agent_name=f"{agent_obj.name}({role_name})",
            round_num=round_num,
            total_rounds=total_rounds,
            response_order=response_order,
            total_agents=total_agents,
            is_summarizing=is_summarizing
        )
        _send_sse_message(task, msg)


def _send_all_done(task: 'Task', total_rounds: int):
    """发送全部完成消息"""
    from app.services.conversation.message_formater import format_all_agents_done
    from app.services.summary_service import SummaryService
    
    # 检查是否需要触发上下文总结（自主任务使用独立开关）
    need_summarize = SummaryService.check_need_summarize(task.conversation_id, is_autonomous=True)
    
    msg = format_all_agents_done(
        message=f"任务完成，共进行了 {total_rounds} 轮",
        need_summarize=need_summarize
    )
    _send_sse_message(task, msg)


def _send_done(task: 'Task', message: str = '任务完成'):
    """发送结束消息"""
    from app.services.conversation.message_formater import format_connection_status
    _send_sse_message(task, format_connection_status('done', message=message))
    # 结束流
    if task.result_queue:
        task.result_queue.put(None)


def _send_error(task: 'Task', error: str):
    """发送错误消息"""
    from app.services.conversation.message_formater import format_connection_status
    _send_sse_message(task, format_connection_status('error', error=error))
    if task.result_queue:
        task.result_queue.put(None)


async def execute_planning_phase(task: 'Task') -> bool:
    """
    执行计划阶段
    
    如果配置了 enable_planning=True，由计划智能体制定计划
    """
    cfg = task.execution_config or {}
    enable_planning = cfg.get('enable_planning', False)
    
    if not enable_planning:
        return True
    
    logger.info(f"Task {task.id} executing planning phase")
    
    try:
        from app.services.conversation.autonomous_task_utils import execute_planning_phase as do_planning
        from app.models import ConversationAgent
        from app.services.conversation.callback_utils import create_standard_sse_callback
        
        conv_agents = ConversationAgent.query.filter_by(
            conversation_id=task.conversation_id
        ).all()
        
        if not conv_agents:
            logger.warning("No agents found for planning phase")
            return False
        
        sse_callback = create_standard_sse_callback(True, task.result_queue)
        
        # 获取停止条件（用于变量停止模式）
        stop_conditions = cfg.get('stop_conditions', [])
        condition_logic = cfg.get('condition_logic', 'and')
        is_variable_stop = task.execution_mode == "loop"
        
        # 根据模式确定描述
        if is_variable_stop:
            mode_description = "变量停止模式自主行动"
        else:
            mode_description = "自主行动"
        
        return do_planning(
            task_id=task.action_task_id,
            conversation_id=task.conversation_id,
            conv_agents=conv_agents,
            planner_agent_id=cfg.get('planner_agent_id'),
            topic=cfg.get('topic', ''),
            total_rounds=cfg.get('max_rounds', 1),
            streaming=True,
            sse_callback=sse_callback,
            mode_description=mode_description,
            stop_conditions=stop_conditions if is_variable_stop else None,
            condition_logic=condition_logic
        )
    except Exception as e:
        logger.error(f"Error in planning phase: {e}")
        return False


async def execute_summarize_phase(task: 'Task') -> bool:
    """
    执行总结阶段
    
    如果配置了 summarize=True，由总结智能体进行总结
    """
    cfg = task.execution_config or {}
    summarize = cfg.get('summarize', False)
    
    if not summarize:
        return True
    
    logger.info(f"Task {task.id} executing summarize phase")
    
    agents = await _get_task_agents(task)
    if not agents:
        return False
    
    # 获取总结智能体（指定的或第一个）
    summarizer_agent_id = cfg.get('summarizer_agent_id')
    summarizer = None
    
    if summarizer_agent_id:
        summarizer = next((a for a in agents if a['id'] == summarizer_agent_id), None)
    if not summarizer:
        summarizer = agents[0]
    
    # 发送总结Agent信息
    max_rounds = cfg.get('max_rounds', 1)
    _send_agent_info(
        task, summarizer,
        round_num=max_rounds,
        total_rounds=max_rounds,
        response_order=1,
        total_agents=1,
        is_summarizing=True
    )
    
    # 构建总结提示
    topic = cfg.get('topic', '')
    task.context['summarize_prompt'] = f"请根据上面的行动内容，详细总结所有观点和结论，突出重点和共识，以及存在的分歧。请将总结记录到共享工作区中，并将最终结论写入任务结论中。\n任务主题：{topic}"
    
    await _process_agent_response(task, summarizer, is_summarizing=True)
    
    return True


async def execute_round(task: 'Task') -> None:
    """
    执行一轮对话
    
    根据 execution_mode 分发到不同的执行策略：
    - sequential: 顺序执行所有Agent
    - dynamic: 根据变量动态选择下一个Agent
    - parallel: 并行执行所有Agent（未来扩展）
    - loop: 与sequential类似，但用于循环场景
    - orchestration: 编排模式，按流程图执行
    """
    mode = task.execution_mode
    
    if mode == "sequential" or mode == "loop":
        await _execute_sequential(task)
    
    elif mode == "dynamic":
        await _execute_dynamic(task)
    
    elif mode == "parallel":
        await _execute_parallel(task)
    
    elif mode == "orchestration":
        await _execute_orchestration(task)
    
    else:
        logger.warning(f"Unknown execution mode: {mode}, using sequential")
        await _execute_sequential(task)


async def _execute_sequential(task: 'Task') -> None:
    """
    顺序执行所有Agent
    
    对应原有的 auto_conversation, variable_stop, time_trigger, variable_trigger
    """
    agents = await _get_task_agents(task)
    
    if not agents:
        logger.warning(f"Task {task.id} has no agents")
        return
    
    # 获取轮次配置
    cfg = task.execution_config or {}
    max_rounds = cfg.get('max_rounds', 1)
    current_round = task.current_round + 1  # 当前轮次（1-based）
    
    # 获取停止条件（用于 loop 模式，即 variable_stop）
    stop_conditions = cfg.get('stop_conditions', [])
    condition_logic = cfg.get('condition_logic', 'and')
    
    # 警告：loop 模式下无停止条件且无最大轮次限制可能导致无限循环
    if task.execution_mode == "loop" and not stop_conditions and max_rounds >= 100:
        logger.warning(f"Task {task.id} is in loop mode without stop conditions and max_rounds={max_rounds}, may run indefinitely")
    
    for i, agent in enumerate(agents):
        # 执行前检查取消
        if task.cancel_event and task.cancel_event.is_set():
            logger.info(f"Task {task.id} cancelled before agent {agent['name']}")
            break
        
        # 对于 loop 模式（variable_stop）：在每个Agent发言前检查停止条件
        if task.execution_mode == "loop" and stop_conditions:
            from .triggers import evaluate_stop_conditions
            if evaluate_stop_conditions(task, stop_conditions, condition_logic):
                logger.info(f"Task {task.id} stop conditions met before agent {agent['name']}")
                task.cancel_event.set()  # 触发任务停止
                # 标记停止原因
                task.context["stop_reason"] = "conditions_met"
                break
        
        # 发送Agent信息到前端
        _send_agent_info(
            task, agent, 
            round_num=current_round, 
            total_rounds=max_rounds,
            response_order=i + 1,
            total_agents=len(agents)
        )
        
        await _process_agent_response(task, agent)
        
        # 执行后检查取消（防止继续下一个Agent）
        if task.cancel_event and task.cancel_event.is_set():
            logger.info(f"Task {task.id} cancelled after agent {agent['name']}")
            break


async def execute_dynamic_loop(task: 'Task', max_steps: int, max_runtime: int) -> None:
    """
    自主调度模式的完整执行循环（autonomous_scheduling）
    
    在一次调用中完成整个自主调度流程：
    - 执行第一个智能体
    - 检查 nextAgent，执行下一个
    - 重复直到 nextAgent 为空或达到最大步骤数
    
    Args:
        task: 任务对象
        max_steps: 最大步骤数（智能体发言次数上限）
        max_runtime: 最大运行时间（分钟），0表示不限制
    """
    from .triggers import wait_for_next_agent_variable
    from datetime import datetime
    
    cfg = task.execution_config or {}
    topic = cfg.get('topic', '')
    enable_planning = cfg.get('enable_planning', False)
    
    agents = await _get_task_agents(task)
    if not agents:
        logger.warning(f"Task {task.id} has no agents for dynamic execution")
        return
    
    # 清空可能存在的旧变量
    await _clear_next_agent_variable(task)
    
    # 第一步：执行第一个智能体
    agent = agents[0]
    next_todo = topic or '请基于各自角色和知识，进行自主调度协作'
    step = 0
    
    while not task.cancel_event.is_set() and step < max_steps:
        step += 1
        task.current_round = step  # 更新步骤数（用于显示和记录）
        
        # 检查暂停
        await task.pause_event.wait()
        if task.cancel_event.is_set():
            break
        
        # 检查最大运行时间
        if max_runtime > 0 and task.started_at:
            elapsed_minutes = (datetime.now() - task.started_at).total_seconds() / 60
            if elapsed_minutes >= max_runtime:
                logger.info(f"Task {task.id} reached max runtime: {max_runtime} minutes")
                task.context["stop_reason"] = "max_runtime"
                task.cancel_event.set()
                break
        
        # 发送步骤信息
        _send_round_info(task, step, max_steps)
        _send_agent_info(task, agent, round_num=step, total_rounds=max_steps,
                        response_order=1, total_agents=len(agents), is_dynamic_mode=True)
        
        # 构建提示
        if step == 1:
            prompt = f"""你正在开始这个协作任务。{' 请参考共享工作区中的计划。' if enable_planning else ''}

任务主题：{topic}

📊 **任务进度**：当前第 {step} 步（最多 {max_steps} 步）

请完成你的任务部分。

⚠️ **重要提醒**：完成任务后，你**必须**使用 `set_task_var` 工具设置以下两个变量：
1. `nextAgent` - 下一个行动的智能体名称（从参与者列表中选择，或设为空字符串""结束任务）
2. `nextAgentTODO` - 给下一个智能体的任务说明

如果不设置这些变量，任务将自动停止。"""
        else:
            prompt = f"""上一个智能体给你分配了以下任务：{next_todo}

任务主题：{topic}

📊 **任务进度**：当前第 {step} 步（最多 {max_steps} 步）

请完成分配给你的任务。

⚠️ **重要提醒**：完成任务后，你**必须**使用 `set_task_var` 工具设置以下两个变量：
1. `nextAgent` - 下一个行动的智能体名称（从参与者列表中选择，或设为空字符串""结束任务）
2. `nextAgentTODO` - 给下一个智能体的任务说明

如果不设置这些变量，任务将自动停止。"""
        
        # 执行智能体
        task.context["dynamic_prompt"] = prompt
        await _process_agent_response(task, agent)
        
        # 检查是否被取消
        if task.cancel_event.is_set():
            break
        
        # 持久化状态
        await _persist_task_state(task)
        
        # 记录并行实验步骤（变量快照）
        await _record_experiment_step_for_dynamic(task)
        
        # 触发监督者轮次完成事件
        await _trigger_supervisor_event_for_dynamic(task)
        
        # 等待并检查 nextAgent
        next_info = await wait_for_next_agent_variable(task)
        
        if next_info.get("should_stop", False):
            logger.info(f"Task {task.id} stopping at step {step}: nextAgent not set or empty")
            task.context["stop_reason"] = "next_agent_not_set"
            await send_task_message(task, "system", 
                "未指定下一个智能体，任务已停止。（提示：智能体应使用 set_task_var 工具设置 nextAgent 变量）")
            task.cancel_event.set()
            break
        
        # 查找下一个智能体
        next_agent = await _find_agent_by_name(task, next_info["next_agent"])
        if not next_agent:
            # 列出可选智能体
            agent_names = [a["name"] for a in agents]
            logger.warning(f"Task {task.id} agent not found: {next_info['next_agent']}")
            task.context["stop_reason"] = "agent_not_found"
            await send_task_message(task, "system", 
                f"找不到智能体 '{next_info['next_agent']}'，任务已停止。可选的智能体有：{', '.join(agent_names)}")
            task.cancel_event.set()
            break
        
        # 准备下一步
        agent = next_agent
        next_todo = next_info.get("next_todo", "继续执行任务")
        
        # 清除变量，准备下一步检测
        await _clear_next_agent_variable(task)
    
    # 检查是否达到最大步骤数
    if step >= max_steps and not task.cancel_event.is_set():
        logger.info(f"Task {task.id} reached max steps: {max_steps}")
        task.context["stop_reason"] = "max_steps"
        await send_task_message(task, "system", f"已达到最大步骤数 {max_steps}，任务停止。")
        task.cancel_event.set()


async def _persist_task_state(task: 'Task') -> None:
    """持久化任务状态（供 dynamic 模式内部使用）"""
    try:
        from app.models import AutonomousTask, AutonomousTaskExecution, db
        
        try:
            autonomous_task = AutonomousTask.query.filter_by(
                conversation_id=task.conversation_id
            ).order_by(AutonomousTask.created_at.desc()).first()
            
            if autonomous_task:
                execution = AutonomousTaskExecution.query.filter_by(
                    autonomous_task_id=autonomous_task.id
                ).order_by(AutonomousTaskExecution.created_at.desc()).first()
                
                if execution:
                    execution.result = execution.result or {}
                    execution.result['current_step'] = task.current_round
                    db.session.commit()
                    logger.debug(f"Task state persisted: {task.id}, step={task.current_round}")
        finally:
            db.session.remove()
    except Exception as e:
        logger.error(f"Error persisting task state: {e}")


async def _record_experiment_step_for_dynamic(task: 'Task') -> None:
    """
    记录并行实验步骤（变量快照）- 供 dynamic 模式内部使用
    仅对属于并行实验的任务生效
    """
    try:
        from app.models import ActionTask, ParallelExperiment
        from app.services.parallel_experiment_service import ParallelExperimentService
        from app.extensions import db
        
        try:
            action_task = ActionTask.query.get(task.action_task_id)
            if not action_task or not action_task.is_experiment_clone:
                return
            
            # 查找该任务所属的实验
            experiment = ParallelExperiment.query.filter(
                ParallelExperiment.status == 'running'
            ).all()
            
            for exp in experiment:
                if not exp.cloned_action_task_ids:
                    continue
                current_iter = exp.current_iteration or 1
                task_ids = exp.cloned_action_task_ids.get(str(current_iter), [])
                if task.action_task_id in task_ids:
                    ParallelExperimentService.record_step(
                        experiment_id=exp.id,
                        action_task_id=task.action_task_id,
                        step_number=task.current_round
                    )
                    logger.debug(f"Recorded experiment step: exp={exp.id}, task={task.action_task_id}, round={task.current_round}")
                    return
        finally:
            db.session.remove()
    except Exception as e:
        logger.error(f"Error recording experiment step: {e}")


async def _trigger_supervisor_event_for_dynamic(task: 'Task') -> None:
    """
    触发监督者轮次完成事件 - 供 dynamic 模式内部使用
    """
    try:
        from app.services.supervisor_event_manager import supervisor_event_manager
        from app.extensions import db
        
        try:
            supervisor_event_manager.on_round_completed(
                conversation_id=task.conversation_id,
                round_number=task.current_round
            )
        finally:
            db.session.remove()
    except Exception as e:
        logger.error(f"Error triggering supervisor event: {e}")


async def _execute_dynamic(task: 'Task') -> None:
    """
    动态Agent选择执行（autonomous_scheduling）- 兼容旧接口
    
    注意：此函数已被 execute_dynamic_loop 替代，保留仅为兼容性
    新的实现在 scheduler 中直接调用 execute_dynamic_loop
    """
    cfg = task.execution_config or {}
    max_rounds = cfg.get('max_rounds', 50)
    max_runtime = cfg.get('maxRuntime', cfg.get('max_runtime', 0))
    await execute_dynamic_loop(task, max_rounds, max_runtime)


async def _clear_next_agent_variable(task: 'Task') -> None:
    """清除 nextAgent 变量，避免重复触发"""
    try:
        from app.models import ActionTaskEnvironmentVariable, db
        try:
            for var_name in ['nextAgent', 'nextAgentTODO']:
                var = ActionTaskEnvironmentVariable.query.filter_by(
                    action_task_id=task.action_task_id, 
                    name=var_name
                ).first()
                if var:
                    var.value = ''
            db.session.commit()
        except Exception as e:
            logger.warning(f"Failed to clear next agent variables: {e}")
        finally:
            db.session.remove()
    except Exception as e:
        logger.error(f"Error clearing next agent variables: {e}")


async def _execute_parallel(task: 'Task') -> None:
    """
    并行执行所有Agent（未来扩展）
    """
    agents = await _get_task_agents(task)
    
    if not agents:
        logger.warning(f"Task {task.id} has no agents")
        return
    
    # 并行执行
    await asyncio.gather(*[
        _process_agent_response(task, agent) 
        for agent in agents
    ])


async def _get_task_agents(task: 'Task') -> List[Dict[str, Any]]:
    """
    获取任务关联的所有Agent
    
    Returns:
        List of agent info dicts
    """
    try:
        from app.models import ConversationAgent, Agent
        
        conv_agents = ConversationAgent.query.filter_by(
            conversation_id=task.conversation_id
        ).all()
        
        agents = []
        for ca in conv_agents:
            agent = Agent.query.get(ca.agent_id)
            if agent and not agent.is_observer:  # 过滤掉监督者智能体
                agents.append({
                    "id": agent.id,
                    "name": agent.name,
                    "conv_agent_id": ca.id,
                    "is_default": ca.is_default
                })
        
        return agents
            
    except Exception as e:
        logger.error(f"Error getting task agents: {e}")
        return []


async def _find_agent_by_name(task: 'Task', agent_name: str) -> Dict[str, Any]:
    """根据名称查找Agent"""
    agents = await _get_task_agents(task)
    
    for agent in agents:
        if agent["name"] == agent_name:
            return agent
    
    return None


async def _process_agent_response(task: 'Task', agent: Dict[str, Any], is_summarizing: bool = False) -> None:
    """
    处理单个Agent的响应
    
    调用现有的 ConversationService._process_single_agent_response
    """
    logger.info(f"Task {task.id} processing agent: {agent['name']} (id={agent['id']}), summarizing={is_summarizing}")
    
    def _call_service():
        # 构建提示
        prompt = _build_agent_prompt(task, agent, is_summarizing)
        
        # 获取SSE回调
        sse_callback = None
        if task.result_queue:
            from app.services.conversation.stream_handler import wrap_stream_callback
            sse_callback = wrap_stream_callback(task.result_queue)
        
        # 调用现有的单Agent响应处理
        from app.services.conversation_service import ConversationService
        
        return ConversationService._process_single_agent_response(
            task_id=task.action_task_id,
            conversation_id=task.conversation_id,
            human_message=None,  # 虚拟消息（自主任务）
            agent_id=agent["id"],
            content=prompt,
            sse_callback=sse_callback,
            result_queue=None,  # 不在这里结束流，由调度器控制
            response_order=task.current_round,
            isolation_mode=task.execution_config.get("isolation_mode", False) if task.execution_config else False
        )
    
    try:
        # 在发起LLM请求前，再次检查取消状态（解决取消滞后问题）
        if task.cancel_event and task.cancel_event.is_set():
            logger.info(f"Task {task.id} cancelled before LLM request for agent {agent['name']}")
            return
        
        # 使用 asyncio.to_thread 在线程池中执行同步代码
        response_completed, error_msg = await asyncio.to_thread(_call_service)
        
        if response_completed:
            logger.debug(f"Agent {agent['name']} response completed successfully")
            # 自主任务：每个agent发言后检查并执行上下文总结
            if not is_summarizing:
                await _check_and_summarize_context(task)
        else:
            logger.warning(f"Agent {agent['name']} response failed: {error_msg}")
            if error_msg:
                raise Exception(error_msg)
        
    except Exception as e:
        logger.error(f"Error processing agent {agent['name']}: {e}")
        raise


async def _check_and_summarize_context(task: 'Task') -> None:
    """
    自主任务中，每个agent发言后检查是否需要上下文总结，
    如果需要则直接在后端执行总结并通过SSE推送到前端。
    """
    def _do_summarize():
        from app.services.summary_service import SummaryService
        
        if not SummaryService.check_need_summarize(task.conversation_id, is_autonomous=True):
            return None
        
        logger.info(f"Task {task.id} 触发自动上下文总结: conversation_id={task.conversation_id}")
        return SummaryService.summarize_context(task.conversation_id)

    try:
        result = await asyncio.to_thread(_do_summarize)
        if result and task.result_queue:
            from app.services.conversation.message_formater import serialize_message
            
            summary_msg = {
                "content": None,
                "meta": {
                    "message": {
                        "id": result['message_id'],
                        "content": f"[上下文总结]\n\n{result['summary']}",
                        "role": "system",
                        "created_at": None,
                        "meta": {
                            "type": "context_summary"
                        }
                    }
                }
            }
            task.result_queue.put(serialize_message(summary_msg))
            logger.info(f"Task {task.id} 上下文总结已推送到前端")
    except Exception as e:
        logger.error(f"Task {task.id} 自动上下文总结失败: {e}")


def _build_agent_prompt(task: 'Task', agent: Dict[str, Any], is_summarizing: bool = False) -> str:
    """
    构建Agent提示
    
    根据不同的执行模式和配置构建提示内容
    """
    from app.services.conversation.callback_utils import format_stop_conditions
    
    cfg = task.execution_config or {}
    topic = cfg.get("topic", "")
    agent_name = agent.get("name", "智能体")
    
    # 总结阶段
    if is_summarizing:
        summarize_prompt = task.context.get("summarize_prompt")
        if summarize_prompt:
            return f"<div style='color: #A0A0A0;'>@{agent_name} {summarize_prompt}</div>\n"
        return f"<div style='color: #A0A0A0;'>@{agent_name} 请总结上述讨论内容。\n任务主题：{topic}</div>\n"
    
    # 动态模式的提示（autonomous_scheduling）
    dynamic_prompt = task.context.get("dynamic_prompt")
    if dynamic_prompt:
        # 清除动态提示，避免重复使用
        task.context["dynamic_prompt"] = None
        return f"<div style='color: #A0A0A0;'>@{agent_name} {dynamic_prompt}</div>\n"
    
    # 普通执行阶段
    max_rounds = cfg.get("max_rounds", 1)
    current_round = task.current_round + 1
    enable_planning = cfg.get("enable_planning", False)
    
    # 获取停止条件（用于变量停止模式）
    stop_conditions = cfg.get("stop_conditions", [])
    condition_logic = cfg.get("condition_logic", "and")
    is_variable_stop = task.execution_mode == "loop"
    
    # 生成停止条件提示文本
    conditions_hint = ""
    if is_variable_stop and stop_conditions:
        conditions_hint = f"\n{format_stop_conditions(stop_conditions, condition_logic)}"
    
    # 第一轮第一个智能体的特殊提示
    if current_round == 1 and task.context.get("first_agent_of_round", True):
        task.context["first_agent_of_round"] = False
        if enable_planning:
            return f"<div style='color: #A0A0A0;'>@{agent_name} 你是任务的第一个行动者，请参考共享工作区中计划智能体制定的计划，开始执行你的任务。有任何进展请更新共享工作区。\n任务主题：{topic}{conditions_hint}</div>\n"
        else:
            return f"<div style='color: #A0A0A0;'>@{agent_name} 你是任务的第一个行动者，请就任务主题开始你的任务。有任何进展请更新共享工作区。\n任务主题：{topic}{conditions_hint}</div>\n"
    
    # 普通提示
    if is_variable_stop:
        return f"<div style='color: #A0A0A0;'>@{agent_name} 请你基于之前的信息，继续执行你的任务。你是该任务中的第{current_round}轮行动者。任务将在满足停止条件时自动终止。有任何进展请更新共享工作区。\n任务主题：{topic}{conditions_hint}</div>\n"
    else:
        return f"<div style='color: #A0A0A0;'>@{agent_name} 请你基于之前的信息，继续执行你的任务。你是该任务中的第{current_round}（共计{max_rounds}轮）轮行动者。有任何进展请更新共享工作区。\n任务主题：{topic}</div>\n"


async def cancel_task_stream(task: 'Task') -> None:
    """
    取消任务时，同时取消正在进行的流
    
    复用现有的 cancel_streaming_task
    """
    try:
        from app.services.conversation.stream_handler import cancel_streaming_task
        
        # 取消流式任务
        cancel_streaming_task(
            task_id=task.action_task_id,
            conversation_id=task.conversation_id
        )
        logger.info(f"Task {task.id} stream cancelled")
        
    except Exception as e:
        logger.error(f"Error cancelling task stream: {e}")


async def send_task_message(task: 'Task', message_type: str, message: str) -> None:
    """
    发送任务消息到流
    """
    if task.result_queue:
        from app.services.conversation.message_formater import format_system_message, serialize_message
        import uuid
        from datetime import datetime
        
        message_id = str(uuid.uuid4())
        created_at = datetime.utcnow().isoformat() + "Z"
        
        msg = format_system_message(message_id, message, created_at)
        task.result_queue.put(serialize_message(msg))


# ============================================================
# 编排模式（Orchestration）执行器
# ============================================================

async def _execute_orchestration(task: 'Task') -> None:
    """
    编排模式执行 - 按流程图执行节点
    
    支持的节点类型：
    - start: 开始节点
    - end: 结束节点
    - agent: 智能体执行
    - task: 任务/指令节点
    - knowledge: 知识库查询
    - api: API调用
    - condition: 条件判断
    """
    cfg = task.execution_config or {}
    orch = cfg.get('orchestration', {})
    nodes = orch.get('nodes', [])
    edges = orch.get('edges', [])
    
    if not nodes:
        logger.warning(f"Task {task.id} orchestration has no nodes")
        await send_task_message(task, "system", "编排流程为空，无法执行")
        return
    
    # 初始化编排上下文
    orch_context = {
        'variables': {},      # 节点输出变量
        'prev_output': '',    # 上一步输出
        'step': 0,            # 当前步骤
        'node_outputs': {},   # 所有节点输出 {node_id: output}
    }
    
    # 构建节点映射和边映射
    node_map = {n['id']: n for n in nodes}
    edge_map = {}  # source_id -> [edges]
    for edge in edges:
        source = edge.get('source')
        if source not in edge_map:
            edge_map[source] = []
        edge_map[source].append(edge)
    
    # 找到开始节点
    start_node = next((n for n in nodes if n.get('type') == 'start'), None)
    if not start_node:
        logger.error(f"Task {task.id} orchestration has no start node")
        await send_task_message(task, "system", "编排流程缺少开始节点")
        return
    
    # 计算总步骤数（用于进度显示）
    executable_nodes = [n for n in nodes if n.get('type') not in ('start', 'end')]
    total_steps = len(executable_nodes)
    
    # 从开始节点开始执行
    current_node_id = start_node['id']
    visited = set()
    max_iterations = 100  # 防止无限循环
    iteration = 0
    
    try:
        while current_node_id and iteration < max_iterations:
            iteration += 1
            
            # 检查取消
            if task.cancel_event and task.cancel_event.is_set():
                logger.info(f"Task {task.id} orchestration cancelled")
                break
            
            # 防止循环
            if current_node_id in visited and node_map.get(current_node_id, {}).get('type') != 'condition':
                logger.warning(f"Task {task.id} detected loop at node {current_node_id}")
                break
            visited.add(current_node_id)
            
            # 获取当前节点
            current_node = node_map.get(current_node_id)
            if not current_node:
                logger.error(f"Task {task.id} node not found: {current_node_id}")
                break
            
            node_type = current_node.get('type')
            node_data = current_node.get('data', {})
            
            logger.info(f"Task {task.id} executing node: {current_node_id} (type={node_type})")
            
            # 根据节点类型执行
            next_node_id = None
            
            if node_type == 'start':
                # 开始节点：直接跳到下一个
                next_node_id = _get_next_node_id(current_node_id, edge_map)
                
            elif node_type == 'end':
                # 结束节点：执行总结（如果配置）并结束
                if node_data.get('summary'):
                    await execute_summarize_phase(task)
                logger.info(f"Task {task.id} orchestration reached end node")
                break
                
            elif node_type == 'agent':
                orch_context['step'] += 1
                _send_round_info(task, orch_context['step'], total_steps)
                output = await _execute_orch_agent_node(task, current_node, orch_context)
                orch_context['prev_output'] = output
                orch_context['node_outputs'][current_node_id] = output
                next_node_id = _get_next_node_id(current_node_id, edge_map)
                
            elif node_type == 'task':
                orch_context['step'] += 1
                _send_round_info(task, orch_context['step'], total_steps)
                output = await _execute_orch_task_node(task, current_node, orch_context)
                orch_context['prev_output'] = output
                orch_context['node_outputs'][current_node_id] = output
                next_node_id = _get_next_node_id(current_node_id, edge_map)
                
            elif node_type == 'knowledge':
                orch_context['step'] += 1
                _send_round_info(task, orch_context['step'], total_steps)
                output = await _execute_orch_knowledge_node(task, current_node, orch_context)
                orch_context['prev_output'] = output
                orch_context['node_outputs'][current_node_id] = output
                next_node_id = _get_next_node_id(current_node_id, edge_map)
                
            elif node_type == 'api':
                orch_context['step'] += 1
                _send_round_info(task, orch_context['step'], total_steps)
                output = await _execute_orch_api_node(task, current_node, orch_context)
                orch_context['prev_output'] = output
                orch_context['node_outputs'][current_node_id] = output
                next_node_id = _get_next_node_id(current_node_id, edge_map)
                
            elif node_type == 'condition':
                # 条件节点：评估条件，选择分支
                condition_result = _evaluate_orch_condition(task, current_node, orch_context)
                next_node_id = _get_condition_next_node(current_node_id, edge_map, condition_result)
                logger.info(f"Task {task.id} condition node {current_node_id} evaluated to {condition_result}")
                
            else:
                logger.warning(f"Task {task.id} unknown node type: {node_type}")
                next_node_id = _get_next_node_id(current_node_id, edge_map)
            
            current_node_id = next_node_id
        
        if iteration >= max_iterations:
            logger.error(f"Task {task.id} orchestration exceeded max iterations")
            await send_task_message(task, "system", "编排执行超过最大迭代次数，已停止")
            
    except Exception as e:
        logger.error(f"Task {task.id} orchestration error: {e}")
        await send_task_message(task, "system", f"编排执行出错: {str(e)}")
        raise


def _get_next_node_id(current_node_id: str, edge_map: dict) -> str:
    """获取下一个节点ID（普通节点，只有一个出边）"""
    edges = edge_map.get(current_node_id, [])
    if edges:
        return edges[0].get('target')
    return None


def _get_condition_next_node(current_node_id: str, edge_map: dict, condition_result: bool) -> str:
    """获取条件节点的下一个节点ID"""
    edges = edge_map.get(current_node_id, [])
    
    for edge in edges:
        # 检查边的 sourceHandle 来确定是 true 还是 false 分支
        source_handle = edge.get('sourceHandle', '')
        if condition_result and source_handle in ('true', 'yes', 'then', 'source-true'):
            return edge.get('target')
        elif not condition_result and source_handle in ('false', 'no', 'else', 'source-false'):
            return edge.get('target')
    
    # 如果没有找到匹配的分支，尝试返回第一个边
    if edges:
        return edges[0].get('target')
    return None


def _render_orch_template(template: str, task: 'Task', orch_context: dict) -> str:
    """渲染编排模板变量"""
    if not template:
        return template
    
    result = template
    
    # 替换 {{prev_output}}
    result = result.replace('{{prev_output}}', orch_context.get('prev_output', ''))
    
    # 替换 {{node_id.output}}
    import re
    node_output_pattern = r'\{\{(\w+)\.output\}\}'
    for match in re.finditer(node_output_pattern, result):
        node_id = match.group(1)
        node_output = orch_context.get('node_outputs', {}).get(node_id, '')
        result = result.replace(match.group(0), str(node_output))
    
    # 替换任务变量 {{task_var.xxx}}
    try:
        from app.models import ActionTaskEnvironmentVariable
        variables = ActionTaskEnvironmentVariable.query.filter_by(
            action_task_id=task.action_task_id
        ).all()
        for var in variables:
            result = result.replace(f'{{{{task_var.{var.name}}}}}', str(var.value or ''))
    except Exception as e:
        logger.warning(f"Failed to render task variables: {e}")
    
    return result


async def _execute_orch_agent_node(task: 'Task', node: dict, orch_context: dict) -> str:
    """执行智能体节点"""
    data = node.get('data', {})
    role_id = data.get('role_id')
    prompt_template = data.get('prompt', '')
    
    # 渲染模板
    prompt = _render_orch_template(prompt_template, task, orch_context)
    
    # 查找对应的 Agent
    agent = await _find_agent_by_role_id(task, role_id)
    if not agent:
        logger.warning(f"Agent with role_id {role_id} not found, skipping node {node['id']}")
        await send_task_message(task, "system", f"找不到角色ID为 {role_id} 的智能体，跳过该节点")
        return orch_context.get('prev_output', '')
    
    # 发送 Agent 信息
    _send_agent_info(
        task, agent,
        round_num=orch_context['step'],
        total_rounds=orch_context['step'],
        response_order=1,
        total_agents=1,
        is_dynamic_mode=True
    )
    
    # 设置动态提示并执行
    task.context["dynamic_prompt"] = prompt
    await _process_agent_response(task, agent)
    
    # 获取输出
    return await _get_last_agent_output_by_id(task, agent['id'])


async def _execute_orch_task_node(task: 'Task', node: dict, orch_context: dict) -> str:
    """执行任务/指令节点（使用默认智能体）"""
    data = node.get('data', {})
    instruction = data.get('instruction', '')
    
    # 渲染模板
    instruction = _render_orch_template(instruction, task, orch_context)
    
    # 获取第一个智能体作为执行者
    agents = await _get_task_agents(task)
    if not agents:
        logger.warning(f"No agents available for task node {node['id']}")
        await send_task_message(task, "system", "没有可用的智能体执行任务节点")
        return orch_context.get('prev_output', '')
    
    agent = agents[0]
    
    # 发送信息
    await send_task_message(task, "system", f"执行任务: {instruction[:50]}...")
    
    # 设置动态提示并执行
    task.context["dynamic_prompt"] = instruction
    await _process_agent_response(task, agent)
    
    # 获取输出
    return await _get_last_agent_output_by_id(task, agent['id'])


async def _execute_orch_knowledge_node(task: 'Task', node: dict, orch_context: dict) -> str:
    """执行知识库查询节点"""
    data = node.get('data', {})
    kb_id = data.get('kb_id')
    query_template = data.get('query', '')
    top_k = data.get('top_k', 5)
    
    # 渲染查询模板
    query = _render_orch_template(query_template, task, orch_context)
    
    if not kb_id or not query:
        logger.warning(f"Knowledge node {node['id']} missing kb_id or query")
        return ""
    
    try:
        from app.services.knowledge_base_service import KnowledgeBaseService
        results = KnowledgeBaseService.search(kb_id, query, top_k=top_k)
        result = ""
        if results:
            # 格式化结果
            formatted = []
            for i, r in enumerate(results, 1):
                content = r.get('content', r.get('text', ''))
                formatted.append(f"[{i}] {content}")
            result = "\n\n".join(formatted)
    except Exception as e:
        logger.error(f"Knowledge query error: {e}")
        result = ""
    
    await send_task_message(task, "system", f"知识库查询完成，找到 {len(result.split('[')) - 1} 条相关内容")
    return result


async def _execute_orch_api_node(task: 'Task', node: dict, orch_context: dict) -> str:
    """执行API调用节点"""
    import aiohttp
    
    data = node.get('data', {})
    method = data.get('method', 'GET').upper()
    url_template = data.get('url', '')
    headers = data.get('headers', {})
    body_template = data.get('body', {})
    
    # 渲染URL和body中的模板
    url = _render_orch_template(url_template, task, orch_context)
    
    # 渲染body（如果是字符串）
    body = body_template
    if isinstance(body_template, str):
        body = _render_orch_template(body_template, task, orch_context)
    
    if not url:
        logger.warning(f"API node {node['id']} missing url")
        return ""
    
    try:
        await send_task_message(task, "system", f"调用API: {method} {url[:50]}...")
        
        async with aiohttp.ClientSession() as session:
            kwargs = {'headers': headers}
            if method in ('POST', 'PUT', 'PATCH') and body:
                if isinstance(body, dict):
                    kwargs['json'] = body
                else:
                    kwargs['data'] = body
            
            async with session.request(method, url, **kwargs) as response:
                result = await response.text()
                status = response.status
                
        logger.info(f"API call completed: {method} {url} -> {status}")
        await send_task_message(task, "system", f"API调用完成，状态码: {status}")
        return result
        
    except Exception as e:
        logger.error(f"API call error: {e}")
        await send_task_message(task, "system", f"API调用失败: {str(e)}")
        return ""


def _evaluate_orch_condition(task: 'Task', node: dict, orch_context: dict) -> bool:
    """评估条件节点"""
    data = node.get('data', {})
    condition = data.get('condition', '')
    condition_type = data.get('condition_type', 'contains')
    
    # 渲染条件中的变量
    condition = _render_orch_template(condition, task, orch_context)
    prev_output = orch_context.get('prev_output', '')
    
    try:
        if condition_type == 'contains':
            # 包含判断: "xxx contains 'keyword'"
            if ' contains ' in condition:
                parts = condition.split(' contains ', 1)
                text = parts[0].strip()
                keyword = parts[1].strip().strip("'\"")
                return keyword in text
            # 简单判断 prev_output 是否包含 condition
            return condition in prev_output
            
        elif condition_type == 'equals':
            # 相等判断: "xxx == 'value'"
            if ' == ' in condition:
                parts = condition.split(' == ', 1)
                left = parts[0].strip()
                right = parts[1].strip().strip("'\"")
                return left == right
            return prev_output.strip() == condition.strip()
            
        elif condition_type == 'not_empty':
            # 非空判断
            return bool(prev_output.strip())
            
        elif condition_type == 'expression':
            # 表达式判断（简单数值比较）
            # 支持 > < >= <= == !=
            import re
            match = re.match(r'(.+?)\s*(>=|<=|>|<|==|!=)\s*(.+)', condition)
            if match:
                left = match.group(1).strip()
                op = match.group(2)
                right = match.group(3).strip()
                
                try:
                    left_val = float(left)
                    right_val = float(right)
                    
                    if op == '>': return left_val > right_val
                    elif op == '<': return left_val < right_val
                    elif op == '>=': return left_val >= right_val
                    elif op == '<=': return left_val <= right_val
                    elif op == '==': return left_val == right_val
                    elif op == '!=': return left_val != right_val
                except ValueError:
                    # 非数值，按字符串比较
                    if op == '==': return left == right
                    elif op == '!=': return left != right
            return False
            
        elif condition_type == 'regex':
            # 正则匹配
            import re
            try:
                return bool(re.search(condition, prev_output))
            except re.error:
                return False
                
        else:
            # 默认：非空判断
            return bool(condition.strip())
            
    except Exception as e:
        logger.error(f"Condition evaluation error: {e}")
        return False


async def _find_agent_by_role_id(task: 'Task', role_id: str) -> Dict[str, Any]:
    """根据 role_id 查找 Agent"""
    if not role_id:
        return None
    
    agents = await _get_task_agents(task)
    
    from app.models import Agent
    for agent in agents:
        agent_obj = Agent.query.get(agent['id'])
        if agent_obj and agent_obj.role_id == role_id:
            return agent
    return None


async def _get_last_agent_output_by_id(task: 'Task', agent_id: str) -> str:
    """获取智能体最后一条消息"""
    from app.models import Message
    msg = Message.query.filter_by(
        conversation_id=task.conversation_id,
        agent_id=agent_id
    ).order_by(Message.created_at.desc()).first()
    return msg.content if msg else ""
