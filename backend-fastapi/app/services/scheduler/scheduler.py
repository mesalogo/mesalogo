"""
任务调度器核心模块

包含：
- TaskState: 任务状态枚举
- Task: 任务数据类（配置驱动）
- TaskScheduler: 单例调度器
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Callable

logger = logging.getLogger(__name__)


class TaskState(Enum):
    """任务状态"""
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    STOPPED = "stopped"
    FAILED = "failed"


@dataclass
class Task:
    """
    任务数据类（配置驱动，非继承）
    
    通过 trigger_type + execution_mode + config 组合表达所有任务类型：
    - auto_conversation: manual + sequential
    - variable_stop: manual + loop
    - time_trigger: time + sequential
    - autonomous_scheduling: manual + dynamic
    - variable_trigger: variable + sequential
    """
    id: str
    action_task_id: str
    conversation_id: str
    state: TaskState = TaskState.PENDING
    
    # 触发配置（替代 Trigger 类继承）
    # manual: 立即执行
    # time: 定时触发，需要 trigger_config["interval_minutes"]
    # variable: 变量变化触发，需要 trigger_config["conditions"]
    trigger_type: str = "manual"
    trigger_config: Optional[Dict[str, Any]] = None
    
    # 执行配置（替代 Executor 类继承）
    # sequential: 顺序执行所有Agent
    # dynamic: 根据变量动态选择下一个Agent（autonomous_scheduling）
    # parallel: 并行执行所有Agent（未来扩展）
    # loop: 循环执行直到条件满足
    execution_mode: str = "sequential"
    execution_config: Optional[Dict[str, Any]] = None
    
    # 编排支持
    depends_on: Optional[List[str]] = None
    
    # 健壮性配置
    retry_config: Optional[Dict[str, Any]] = None  # {"max_retries": 3, "backoff": 2.0}
    timeout: Optional[int] = None  # 超时秒数
    
    # 运行时状态（不持久化）
    cancel_event: Optional[asyncio.Event] = field(default=None, repr=False)
    pause_event: Optional[asyncio.Event] = field(default=None, repr=False)
    current_round: int = 0
    error: Optional[str] = None
    
    # 流式输出队列
    result_queue: Optional[Any] = field(default=None, repr=False)
    
    # 额外上下文
    context: Optional[Dict[str, Any]] = field(default_factory=dict)
    
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class TaskScheduler:
    """
    单例任务调度器
    
    职责：
    - Task间的调度、依赖、触发时机
    - 暂停/恢复控制
    - 不关心Agent细节，只调度Task
    """
    _instance: Optional['TaskScheduler'] = None
    _tasks: Dict[str, Task]
    _lock: asyncio.Lock
    _executor_func: Optional[Callable] = None  # 执行函数，由外部注入
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._tasks = {}
            cls._instance._lock = None  # 延迟初始化，在事件循环中创建
            cls._instance._executor_func = None
        return cls._instance
    
    def _ensure_lock(self):
        """确保锁在当前事件循环中创建"""
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock
    
    @classmethod
    def get_instance(cls) -> 'TaskScheduler':
        """获取单例实例"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    @classmethod
    def reset_instance(cls):
        """重置单例（仅用于测试）"""
        cls._instance = None
    
    def set_executor(self, executor_func: Callable):
        """
        设置执行函数
        
        executor_func 签名: async def execute_round(task: Task) -> None
        """
        self._executor_func = executor_func
    
    async def submit_and_start(self, task: Task) -> str:
        """
        提交并启动任务
        
        Returns:
            task.id
        
        Raises:
            ValueError: 循环依赖检测失败
        """
        async with self._ensure_lock():
            # 检查循环依赖
            if self._check_circular_dependency(task):
                raise ValueError(f"Circular dependency detected for task {task.id}")
            
            task.created_at = datetime.now()
            self._tasks[task.id] = task
        
        # 启动任务协程
        asyncio.create_task(self._run_task(task))
        logger.info(f"Task submitted and started: {task.id}")
        return task.id
    
    async def stop(self, task_id: str) -> bool:
        """停止任务"""
        async with self._ensure_lock():
            task = self._tasks.get(task_id)
        
        if task and task.cancel_event:
            task.cancel_event.set()
            task.state = TaskState.STOPPED
            # 同时取消正在进行的流
            from .executor import cancel_task_stream
            await cancel_task_stream(task)
            logger.info(f"Task stopped: {task_id}")
            return True
        return False
    
    async def pause(self, task_id: str) -> bool:
        """暂停任务"""
        async with self._ensure_lock():
            task = self._tasks.get(task_id)
        
        if task and task.state == TaskState.RUNNING and task.pause_event:
            task.pause_event.clear()  # 阻塞等待
            task.state = TaskState.PAUSED
            logger.info(f"Task paused: {task_id}")
            return True
        return False
    
    async def resume(self, task_id: str) -> bool:
        """恢复任务"""
        async with self._ensure_lock():
            task = self._tasks.get(task_id)
        
        if task and task.state == TaskState.PAUSED and task.pause_event:
            task.pause_event.set()  # 解除阻塞
            task.state = TaskState.RUNNING
            logger.info(f"Task resumed: {task_id}")
            return True
        return False
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """获取任务"""
        return self._tasks.get(task_id)
    
    def get_tasks_by_action_task(self, action_task_id: str) -> List[Task]:
        """获取某个ActionTask下的所有任务"""
        return [t for t in self._tasks.values() if t.action_task_id == action_task_id]
    
    def get_active_tasks(self) -> List[Task]:
        """获取所有活跃任务"""
        return [t for t in self._tasks.values() 
                if t.state in (TaskState.PENDING, TaskState.RUNNING, TaskState.PAUSED)]
    
    async def _run_task(self, task: Task):
        """
        核心执行循环 - 一套代码处理所有类型
        """
        # 初始化控制事件
        task.cancel_event = asyncio.Event()
        task.pause_event = asyncio.Event()
        task.pause_event.set()  # 默认不暂停
        
        # 创建数据库记录（AutonomousTask + AutonomousTaskExecution）
        await self._create_db_records(task)
        
        # 等待依赖任务完成
        await self._wait_dependencies(task)
        
        if task.cancel_event.is_set():
            task.state = TaskState.STOPPED
            return
        
        task.state = TaskState.RUNNING
        task.started_at = datetime.now()
        
        try:
            from .triggers import wait_for_trigger
            from .executor import (
                _send_connected, _send_round_info, _send_all_done, _send_done, _send_error,
                execute_planning_phase, execute_summarize_phase
            )
            
            # 发送连接成功消息
            _send_connected(task)
            
            # 获取最大轮次
            cfg = task.execution_config or {}
            max_rounds = cfg.get('max_rounds', 1)
            
            # 执行计划阶段（如果启用）
            if cfg.get('enable_planning', False):
                await execute_planning_phase(task)
                if task.cancel_event.is_set():
                    _send_done(task, '任务被用户停止')
                    task.state = TaskState.STOPPED
                    task.completed_at = datetime.now()
                    return
            
            # 获取最大运行时间配置（分钟）
            max_runtime = cfg.get('maxRuntime', cfg.get('max_runtime', 0))
            
            # 对于 dynamic 模式，只调用一次 execute_round（内部有完整循环）
            if task.execution_mode == "dynamic":
                from .executor import execute_dynamic_loop
                await execute_dynamic_loop(task, max_rounds, max_runtime)
            else:
                # 其他模式保持原有的轮次循环逻辑
                while not task.cancel_event.is_set():
                    # 0. 检查暂停
                    await task.pause_event.wait()
                    
                    if task.cancel_event.is_set():
                        break
                    
                    # 0.1 检查最大运行时间
                    if max_runtime > 0 and task.started_at:
                        elapsed_minutes = (datetime.now() - task.started_at).total_seconds() / 60
                        if elapsed_minutes >= max_runtime:
                            logger.info(f"Task {task.id} reached max runtime: {max_runtime} minutes")
                            task.context["stop_reason"] = "max_runtime"
                            break
                    
                    # 1. 对于 variable 触发：执行前等待条件满足
                    if task.trigger_type == "variable":
                        await wait_for_trigger(task)
                        if task.cancel_event.is_set():
                            break
                    
                    # 发送轮次信息
                    _send_round_info(task, task.current_round + 1, max_rounds)
                    
                    # 2. 执行一轮（带超时和重试）
                    await self._execute_with_timeout_and_retry(task)
                    task.current_round += 1
                    
                    # 3. 持久化状态
                    await self._persist_state(task)
                    
                    # 3.1 记录并行实验步骤（变量快照）
                    await self._record_experiment_step(task)
                    
                    # 3.2 触发监督者轮次完成事件
                    await self._trigger_supervisor_event(task)
                    
                    # 4. 检查停止条件
                    if self._should_stop(task):
                        break
                    
                    # 5. 对于 time 触发：执行后等待下次触发（匹配原实现行为）
                    if task.trigger_type == "time":
                        await wait_for_trigger(task)
                        if task.cancel_event.is_set():
                            break
            
            # 执行总结阶段（如果启用且未被取消）
            if not task.cancel_event.is_set() and cfg.get('summarize', False):
                await execute_summarize_phase(task)
            
            # 检查任务最终状态
            if task.cancel_event and task.cancel_event.is_set():
                # 检查停止原因
                stop_reason = task.context.get("stop_reason", "user_cancelled")
                if task.state != TaskState.STOPPED:
                    task.state = TaskState.STOPPED
                
                # 根据停止原因发送不同的消息
                if stop_reason == "next_agent_not_set":
                    # nextAgent 未设置导致的停止（消息已在 executor 中发送，只需结束流）
                    _send_done(task)  # 只发送 done 信号，不重复发送消息
                    logger.info(f"Task stopped (nextAgent not set): {task.id}, rounds: {task.current_round}")
                elif stop_reason == "conditions_met":
                    # 停止条件满足
                    _send_done(task, '停止条件已满足，任务完成')
                    logger.info(f"Task stopped (conditions met): {task.id}, rounds: {task.current_round}")
                elif stop_reason == "max_runtime":
                    # 达到最大运行时间
                    _send_done(task, '已达到最大运行时间，任务停止')
                    logger.info(f"Task stopped (max runtime): {task.id}, rounds: {task.current_round}")
                elif stop_reason == "agent_not_found":
                    # 找不到智能体（消息已在 executor 中发送，只需结束流）
                    _send_done(task)
                    logger.info(f"Task stopped (agent not found): {task.id}, rounds: {task.current_round}")
                else:
                    # 用户手动停止
                    _send_done(task, '任务被用户停止')
                    logger.info(f"Task stopped by user: {task.id}, rounds: {task.current_round}")
            elif task.state == TaskState.RUNNING:
                # 正常完成
                task.state = TaskState.COMPLETED
                _send_all_done(task, task.current_round)
                _send_done(task, '任务完成')
                logger.info(f"Task completed: {task.id}, rounds: {task.current_round}")
            task.completed_at = datetime.now()
            
        except asyncio.TimeoutError:
            task.state = TaskState.FAILED
            task.error = "Task timeout"
            logger.error(f"Task timeout: {task.id}")
            _send_error(task, "任务超时")
        except asyncio.CancelledError:
            task.state = TaskState.STOPPED
            logger.info(f"Task cancelled: {task.id}")
            _send_done(task, '任务已取消')
        except Exception as e:
            task.state = TaskState.FAILED
            task.error = str(e)
            logger.error(f"Task failed: {task.id}, error: {e}")
            _send_error(task, str(e))
        finally:
            task.completed_at = datetime.now()
            await self._persist_state(task)
            # 对于 dynamic 模式，清理 nextAgent 变量
            if task.execution_mode == "dynamic":
                await self._cleanup_dynamic_variables(task)
    
    async def _wait_dependencies(self, task: Task):
        """等待依赖任务完成"""
        if not task.depends_on:
            return
        
        logger.info(f"Task {task.id} waiting for dependencies: {task.depends_on}")
        
        while not task.cancel_event.is_set():
            all_done = True
            for dep_id in task.depends_on:
                dep_task = self._tasks.get(dep_id)
                if not dep_task or dep_task.state not in (TaskState.COMPLETED,):
                    all_done = False
                    break
            
            if all_done:
                logger.info(f"Task {task.id} dependencies satisfied")
                break
            
            await asyncio.sleep(0.5)
    
    async def _execute_with_timeout_and_retry(self, task: Task):
        """带超时和重试的执行"""
        cfg = task.retry_config or {}
        max_retries = cfg.get("max_retries", 0)
        backoff = cfg.get("backoff", 2.0)
        
        for attempt in range(max_retries + 1):
            try:
                if task.timeout:
                    await asyncio.wait_for(
                        self._execute_round(task),
                        timeout=task.timeout
                    )
                else:
                    await self._execute_round(task)
                return
            except asyncio.TimeoutError:
                raise
            except Exception as e:
                if attempt == max_retries:
                    raise
                wait_time = backoff ** attempt
                logger.warning(f"Task {task.id} attempt {attempt + 1} failed, retrying in {wait_time}s: {e}")
                await asyncio.sleep(wait_time)
    
    async def _execute_round(self, task: Task):
        """执行一轮"""
        if self._executor_func:
            await self._executor_func(task)
        else:
            from .executor import execute_round
            await execute_round(task)
    
    def _should_stop(self, task: Task) -> bool:
        """根据 execution_config 判断是否停止
        
        注意：dynamic 模式的停止逻辑在 executor.execute_dynamic_loop 内部处理，
        不会调用此方法。
        """
        cfg = task.execution_config or {}
        
        # 检查最大轮数
        max_rounds = cfg.get("max_rounds")
        if max_rounds and task.current_round >= max_rounds:
            logger.info(f"Task {task.id} reached max rounds: {max_rounds}")
            return True
        
        # 检查最大执行次数（time_trigger用）
        max_executions = cfg.get("max_executions")
        if max_executions and task.current_round >= max_executions:
            logger.info(f"Task {task.id} reached max executions: {max_executions}")
            return True
        
        # 检查停止条件（variable_stop用）
        stop_conditions = cfg.get("stop_conditions")
        if stop_conditions:
            from .triggers import evaluate_stop_conditions
            if evaluate_stop_conditions(task, stop_conditions, cfg.get("condition_logic", "and")):
                logger.info(f"Task {task.id} stop conditions met")
                return True
        
        return False
    
    def _check_circular_dependency(self, task: Task) -> bool:
        """检测循环依赖，返回True表示有环"""
        if not task.depends_on:
            return False
        
        visited = set()
        path = set()
        
        def dfs(task_id: str) -> bool:
            if task_id in path:
                return True  # 发现环
            if task_id in visited:
                return False
            
            visited.add(task_id)
            path.add(task_id)
            
            t = self._tasks.get(task_id)
            if t and t.depends_on:
                for dep_id in t.depends_on:
                    if dfs(dep_id):
                        return True
            
            path.remove(task_id)
            return False
        
        # 先把新任务加入检测
        self._tasks[task.id] = task
        result = dfs(task.id)
        if result:
            del self._tasks[task.id]
        return result
    
    async def _create_db_records(self, task: Task):
        """
        创建数据库记录（AutonomousTask + AutonomousTaskExecution）
        """
        try:
            from app.models import AutonomousTask, AutonomousTaskExecution, db
            from app.utils.datetime_utils import get_current_time_with_timezone
            import uuid
            
            try:
                # 获取任务类型
                task_type = task.context.get('task_type', 'discussion') if task.context else 'discussion'
                cfg = task.execution_config or {}
                
                # 创建 AutonomousTask 记录
                autonomous_task = AutonomousTask(
                    id=str(uuid.uuid4()),
                    conversation_id=task.conversation_id,
                    type=task_type,
                    status='active',
                    config={
                        'topic': cfg.get('topic', ''),
                        'max_rounds': cfg.get('max_rounds', 1),
                        'scheduler_task_id': task.id
                    }
                )
                db.session.add(autonomous_task)
                db.session.flush()  # 获取ID
                
                # 创建 AutonomousTaskExecution 记录
                execution = AutonomousTaskExecution(
                    id=str(uuid.uuid4()),
                    autonomous_task_id=autonomous_task.id,
                    execution_type='manual',
                    trigger_source='user',
                    status='running',
                    start_time=get_current_time_with_timezone()
                )
                db.session.add(execution)
                db.session.commit()
                
                # 保存到 task.context 以便后续使用
                task.context['autonomous_task_id'] = autonomous_task.id
                task.context['execution_id'] = execution.id
                
                logger.info(f"Created AutonomousTask record: {autonomous_task.id}, type={task_type}")
            finally:
                db.session.remove()  # 释放连接回连接池
                    
        except Exception as e:
            logger.error(f"Error creating DB records: {e}")
            import traceback
            traceback.print_exc()

    async def _persist_state(self, task: Task):
        """
        同步状态到数据库（复用现有 AutonomousTask 表）
        """
        try:
            from app.models import AutonomousTask, AutonomousTaskExecution, db
            from app.utils.datetime_utils import get_current_time_with_timezone
            
            try:
                # 查找对应的自主任务记录
                autonomous_task = AutonomousTask.query.filter_by(
                    conversation_id=task.conversation_id
                ).order_by(AutonomousTask.created_at.desc()).first()
                
                if autonomous_task:
                    # 更新任务状态
                    status_map = {
                        TaskState.PENDING: 'pending',
                        TaskState.RUNNING: 'active',
                        TaskState.PAUSED: 'paused',
                        TaskState.COMPLETED: 'completed',
                        TaskState.STOPPED: 'stopped',
                        TaskState.FAILED: 'failed'
                    }
                    autonomous_task.status = status_map.get(task.state, 'active')
                    
                    # 更新执行记录
                    execution = AutonomousTaskExecution.query.filter_by(
                        autonomous_task_id=autonomous_task.id
                    ).order_by(AutonomousTaskExecution.created_at.desc()).first()
                    
                    if execution:
                        if task.state in (TaskState.COMPLETED, TaskState.STOPPED, TaskState.FAILED):
                            execution.status = status_map.get(task.state, 'completed')
                            execution.end_time = get_current_time_with_timezone()
                            execution.result = {
                                'status': task.state.value,
                                'rounds': task.current_round,
                                'error': task.error
                            }
                    
                    db.session.commit()
                    logger.debug(f"Task state persisted: {task.id}, state={task.state}, round={task.current_round}")
            finally:
                db.session.remove()  # 释放连接回连接池
                    
        except Exception as e:
            logger.error(f"Error persisting task state: {e}")
    
    async def _trigger_supervisor_event(self, task: Task):
        """
        触发监督者轮次完成事件
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
    
    async def _record_experiment_step(self, task: Task):
        """
        记录并行实验步骤（变量快照）
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
    
    async def _cleanup_dynamic_variables(self, task: Task):
        """
        清理自主调度模式的变量（nextAgent, nextAgentTODO）
        在任务结束时调用，确保下次启动任务时不会受到旧变量的影响
        """
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
                logger.info(f"Cleaned up dynamic variables for task {task.id}")
            except Exception as e:
                logger.warning(f"Failed to cleanup dynamic variables: {e}")
            finally:
                db.session.remove()
        except Exception as e:
            logger.error(f"Error cleaning up dynamic variables: {e}")
    
    async def recover_from_db(self):
        """
        启动时恢复未完成任务
        """
        try:
            from app.models import AutonomousTask, AutonomousTaskExecution
            
            # 查找所有运行中的任务
            running_tasks = AutonomousTask.query.filter(
                AutonomousTask.status.in_(['active', 'running'])
            ).all()
            
            recovered = 0
            for at in running_tasks:
                # 获取最近的执行记录
                execution = AutonomousTaskExecution.query.filter_by(
                    autonomous_task_id=at.id
                ).order_by(AutonomousTaskExecution.created_at.desc()).first()
                
                if execution:
                    # 创建Task对象
                    task = Task(
                        id=f"recovered_{at.id}",
                        action_task_id=str(at.conversation.action_task_id) if at.conversation else "",
                        conversation_id=str(at.conversation_id),
                        trigger_type=_map_type_to_trigger(at.type),
                        execution_mode=_map_type_to_execution(at.type),
                        execution_config=at.config or {},
                        current_round=0
                    )
                    
                    # 注册但不启动（需要用户确认）
                    self._tasks[task.id] = task
                    recovered += 1
                    logger.info(f"Recovered task: {task.id} from autonomous_task {at.id}")
            
            logger.info(f"TaskScheduler: recovered {recovered} tasks from database")
            
        except Exception as e:
            logger.error(f"Error recovering tasks from database: {e}")


def _map_type_to_trigger(task_type: str) -> str:
    """映射旧任务类型到trigger_type"""
    mapping = {
        'discussion': 'manual',
        'auto_discussion': 'manual',
        'conditional_stop': 'manual',
        'variable_stop': 'manual',
        'time_trigger': 'time',
        'variable_trigger': 'variable',
        'autonomous_scheduling': 'manual'
    }
    return mapping.get(task_type, 'manual')


def _map_type_to_execution(task_type: str) -> str:
    """映射旧任务类型到execution_mode"""
    mapping = {
        'discussion': 'sequential',
        'auto_discussion': 'sequential',
        'conditional_stop': 'loop',
        'variable_stop': 'loop',
        'time_trigger': 'sequential',
        'variable_trigger': 'sequential',
        'autonomous_scheduling': 'dynamic'
    }
    return mapping.get(task_type, 'sequential')
