"""
任务适配器模块

提供从旧API到新调度器的适配层，保持向后兼容

使用方式：
1. 在 autonomous.py 中替换原有的 start_*/stop_* 调用
2. 适配器内部转换为 TaskScheduler 的调用
"""

import asyncio
import logging
import queue
import uuid
from typing import Dict, Any, Optional

from .scheduler import TaskScheduler, Task, TaskState

logger = logging.getLogger(__name__)


def start_task(
    task_id: str,
    conversation_id: str,
    task_type: str,
    config: Dict[str, Any],
    streaming: bool = True,
    result_queue: Optional[queue.Queue] = None
) -> Dict[str, Any]:
    """
    启动任务（统一入口）
    
    这是所有任务类型的统一入口，替代原来的：
    - start_auto_discussion
    - start_variable_stop_conversation
    - start_time_trigger_conversation
    - start_autonomous_scheduling
    - start_variable_trigger_conversation
    
    Args:
        task_id: 行动任务ID
        conversation_id: 会话ID
        task_type: 任务类型 (discussion, conditional_stop, time_trigger, autonomous_scheduling, variable_trigger)
        config: 任务配置
        streaming: 是否流式输出
        result_queue: 结果队列
    
    Returns:
        Dict with status and task info
    """
    try:
        # 转换配置
        trigger_type, trigger_config, execution_mode, execution_config = _convert_config(task_type, config)
        
        # 创建Task对象
        task = Task(
            id=str(uuid.uuid4()),
            action_task_id=task_id,
            conversation_id=conversation_id,
            trigger_type=trigger_type,
            trigger_config=trigger_config,
            execution_mode=execution_mode,
            execution_config=execution_config,
            result_queue=result_queue,
            context={'task_type': task_type}
        )
        
        # 获取调度器实例
        scheduler = TaskScheduler.get_instance()
        
        # 使用事件循环启动任务
        loop = _get_or_create_event_loop()
        
        # 在事件循环中提交任务（fire-and-forget，不阻塞等待）
        asyncio.run_coroutine_threadsafe(
            scheduler.submit_and_start(task),
            loop
        )
        
        logger.info(f"Task started: {task.id}, type={task_type}")
        
        return {
            'status': 'success',
            'message': '任务已启动',
            'task_id': task.id,
            'scheduler_task_id': task.id
        }
        
    except Exception as e:
        logger.error(f"Error starting task: {e}")
        return {'status': 'error', 'message': str(e)}


def stop_task(task_id: str, conversation_id: str, task_type: str = None) -> bool:
    """
    停止任务（统一入口）
    
    Args:
        task_id: 行动任务ID
        conversation_id: 会话ID
        task_type: 任务类型（可选，用于兼容旧接口）
    
    Returns:
        是否成功停止
    """
    try:
        scheduler = TaskScheduler.get_instance()
        
        # 查找匹配的任务
        tasks = scheduler.get_tasks_by_action_task(task_id)
        
        if not tasks:
            logger.warning(f"No active tasks found for action_task {task_id}")
            return False
        
        # 获取事件循环
        loop = _get_or_create_event_loop()
        
        stopped = False
        for task in tasks:
            if task.conversation_id == conversation_id and task.state in (TaskState.RUNNING, TaskState.PAUSED):
                future = asyncio.run_coroutine_threadsafe(
                    scheduler.stop(task.id),
                    loop
                )
                try:
                    result = future.result(timeout=5)
                    if result:
                        stopped = True
                        logger.info(f"Task stopped: {task.id}")
                except Exception as e:
                    logger.error(f"Error stopping task {task.id}: {e}")
        
        return stopped
        
    except Exception as e:
        logger.error(f"Error stopping task: {e}")
        return False


def pause_task(task_id: str, conversation_id: str) -> bool:
    """暂停任务"""
    try:
        scheduler = TaskScheduler.get_instance()
        tasks = scheduler.get_tasks_by_action_task(task_id)
        
        loop = _get_or_create_event_loop()
        
        for task in tasks:
            if task.conversation_id == conversation_id and task.state == TaskState.RUNNING:
                future = asyncio.run_coroutine_threadsafe(
                    scheduler.pause(task.id),
                    loop
                )
                try:
                    result = future.result(timeout=5)
                    if result:
                        logger.info(f"Task paused: {task.id}")
                        return True
                except Exception as e:
                    logger.error(f"Error pausing task {task.id}: {e}")
        
        return False
        
    except Exception as e:
        logger.error(f"Error pausing task: {e}")
        return False


def resume_task(task_id: str, conversation_id: str) -> bool:
    """恢复任务"""
    try:
        scheduler = TaskScheduler.get_instance()
        tasks = scheduler.get_tasks_by_action_task(task_id)
        
        loop = _get_or_create_event_loop()
        
        for task in tasks:
            if task.conversation_id == conversation_id and task.state == TaskState.PAUSED:
                future = asyncio.run_coroutine_threadsafe(
                    scheduler.resume(task.id),
                    loop
                )
                try:
                    result = future.result(timeout=5)
                    if result:
                        logger.info(f"Task resumed: {task.id}")
                        return True
                except Exception as e:
                    logger.error(f"Error resuming task {task.id}: {e}")
        
        return False
        
    except Exception as e:
        logger.error(f"Error resuming task: {e}")
        return False


def get_task_status(task_id: str, conversation_id: str) -> Optional[Dict[str, Any]]:
    """获取任务状态"""
    try:
        scheduler = TaskScheduler.get_instance()
        tasks = scheduler.get_tasks_by_action_task(task_id)
        
        for task in tasks:
            if task.conversation_id == conversation_id:
                return {
                    'id': task.id,
                    'state': task.state.value,
                    'current_round': task.current_round,
                    'trigger_type': task.trigger_type,
                    'execution_mode': task.execution_mode,
                    'error': task.error,
                    'created_at': task.created_at.isoformat() if task.created_at else None,
                    'started_at': task.started_at.isoformat() if task.started_at else None,
                    'completed_at': task.completed_at.isoformat() if task.completed_at else None
                }
        
        return None
        
    except Exception as e:
        logger.error(f"Error getting task status: {e}")
        return None


def _convert_config(task_type: str, config: Dict[str, Any]) -> tuple:
    """
    转换旧配置格式到新格式
    
    Returns:
        (trigger_type, trigger_config, execution_mode, execution_config)
    """
    trigger_type = "manual"
    trigger_config = {}
    execution_mode = "sequential"
    execution_config = {}
    
    if task_type == "discussion" or task_type == "auto_discussion":
        # 自动讨论模式
        trigger_type = "manual"
        execution_mode = "sequential"
        execution_config = {
            "max_rounds": config.get("rounds", 10),
            "topic": config.get("topic", ""),
            "summarize": config.get("summarize", True),
            "summarizer_agent_id": config.get("summarizer_agent_id"),
            "enable_planning": config.get("enable_planning", False),
            "planner_agent_id": config.get("planner_agent_id")
        }
    
    elif task_type == "conditional_stop" or task_type == "variable_stop":
        # 变量停止模式
        trigger_type = "manual"
        execution_mode = "loop"
        execution_config = {
            "topic": config.get("topic", ""),
            "stop_conditions": config.get("stopConditions", config.get("conditions", [])),
            "condition_logic": config.get("conditionLogic", "and"),
            "max_rounds": config.get("maxRounds", 100),
            "enable_planning": config.get("enable_planning", False),
            "planner_agent_id": config.get("planner_agent_id")
        }
    
    elif task_type == "time_trigger":
        # 时间触发模式
        trigger_type = "time"
        trigger_config = {
            "interval_minutes": config.get("intervalMinutes", config.get("interval_minutes", 5))
        }
        execution_mode = "sequential"
        execution_config = {
            "topic": config.get("topic", ""),
            "max_executions": config.get("maxExecutions", config.get("max_executions", 10)),
            "enable_planning": config.get("enablePlanning", config.get("enable_planning", False)),
            "planner_agent_id": config.get("plannerAgentId", config.get("planner_agent_id"))
        }
    
    elif task_type == "autonomous_scheduling":
        # 自主调度模式
        trigger_type = "manual"
        execution_mode = "dynamic"
        execution_config = {
            "topic": config.get("topic", ""),
            "max_rounds": config.get("maxRounds", config.get("max_rounds", 50)),
            "timeout_minutes": config.get("timeoutMinutes", config.get("timeout_minutes", 60)),
            "enable_planning": config.get("enable_planning", False),
            "planner_agent_id": config.get("planner_agent_id"),
            "next_agent_variable": "nextAgent",
            "next_todo_variable": "nextAgentTODO"
        }
    
    elif task_type == "variable_trigger":
        # 变量触发模式
        trigger_type = "variable"
        trigger_config = {
            "conditions": config.get("triggerConditions", config.get("conditions", [])),
            "logic": config.get("conditionLogic", "or")
        }
        execution_mode = "sequential"
        execution_config = {
            "topic": config.get("topic", ""),
            "max_triggers": config.get("maxTriggers", config.get("max_triggers", 100)),
            "enable_planning": config.get("enable_planning", False),
            "planner_agent_id": config.get("planner_agent_id")
        }
    
    elif task_type == "orchestration":
        # 编排模式
        trigger_type = "manual"
        execution_mode = "orchestration"
        execution_config = {
            "topic": config.get("topic", ""),
            "orchestration": config.get("orchestration", {}),
            "summarize": config.get("summarize", False),
            "summarizer_agent_id": config.get("summarizer_agent_id")
        }
    
    return trigger_type, trigger_config, execution_mode, execution_config


# 事件循环管理
_event_loop = None
_loop_thread = None


def _get_or_create_event_loop() -> asyncio.AbstractEventLoop:
    """获取或创建事件循环"""
    global _event_loop, _loop_thread
    
    if _event_loop is None or not _event_loop.is_running():
        import threading
        import time
        
        _event_loop = asyncio.new_event_loop()
        
        def run_loop():
            asyncio.set_event_loop(_event_loop)
            _event_loop.run_forever()
        
        _loop_thread = threading.Thread(target=run_loop, daemon=True)
        _loop_thread.start()
        
        # 等待事件循环启动
        for _ in range(50):  # 最多等待500ms
            if _event_loop.is_running():
                break
            time.sleep(0.01)
        
        logger.info("Created new event loop for TaskScheduler")
    
    return _event_loop


def shutdown_event_loop():
    """关闭事件循环"""
    global _event_loop, _loop_thread
    
    if _event_loop and _event_loop.is_running():
        _event_loop.call_soon_threadsafe(_event_loop.stop)
        if _loop_thread:
            _loop_thread.join(timeout=5)
        _event_loop = None
        _loop_thread = None
        logger.info("Event loop shutdown complete")
