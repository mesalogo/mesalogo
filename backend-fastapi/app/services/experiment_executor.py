"""
并行实验专用线程池执行器

将实验任务从 Gunicorn 线程中解耦，避免 LLM 调用阻塞 web 服务。
任务完成时主动触发下一个待执行任务（替代前端轮询触发）。
"""

import logging
import threading
from concurrent.futures import ThreadPoolExecutor, Future
from typing import Dict, Any, Optional, List, Set

logger = logging.getLogger(__name__)

# 全局线程池，worker 数量取所有实验中最大的 maxConcurrent
_executor: Optional[ThreadPoolExecutor] = None
_executor_size: int = 0
_lock = threading.Lock()

# 每个实验的状态
_experiment_state: Dict[str, Dict[str, Any]] = {}


def _get_executor(min_workers: int = 3) -> ThreadPoolExecutor:
    """获取线程池，按需扩容（线程池大小不用于控制并发，并发由 _dispatch 控制）"""
    global _executor, _executor_size
    if _executor is None or min_workers > _executor_size:
        with _lock:
            if _executor is None or min_workers > _executor_size:
                if _executor is not None:
                    _executor.shutdown(wait=False)
                _executor_size = min_workers
                _executor = ThreadPoolExecutor(
                    max_workers=_executor_size,
                    thread_name_prefix="experiment"
                )
                logger.info(f"Experiment executor created with max_workers={_executor_size}")
    return _executor


def submit_experiment_tasks(
    experiment_id: str,
    task_ids: List[str],
    task_config: Dict[str, Any],
    max_concurrent: int = 3
):
    """批量提交实验任务，内部控制并发数"""
    _get_executor(min_workers=max_concurrent)

    with _lock:
        state = _experiment_state.get(experiment_id)
        if state is None:
            _experiment_state[experiment_id] = {
                "pending": list(task_ids),
                "running": 0,
                "max_concurrent": max_concurrent,
                "task_config": task_config,
                "submitted": set(task_ids),  # 跟踪已提交的 task_id，防止重复
                "stopped": False,
            }
        else:
            # 重置状态（支持新一轮重新启动）
            state["stopped"] = False
            state["running"] = 0
            state["max_concurrent"] = max_concurrent
            state["task_config"] = task_config
            for tid in task_ids:
                if tid not in state["submitted"]:
                    state["pending"].append(tid)
                    state["submitted"].add(tid)

    _dispatch(experiment_id)


def cancel_experiment(experiment_id: str, all_task_ids: list = None):
    """清空实验的待执行队列 + 主动停止调度器中正在运行的任务
    
    Args:
        experiment_id: 实验ID
        all_task_ids: 该实验所有已创建的 ActionTask ID 列表。
            如果提供，会主动通过调度器停止所有正在运行的任务，
            而不是等到 LLM 调用返回后才检测到 cancel_event。
    """
    with _lock:
        state = _experiment_state.get(experiment_id)
        if state:
            state["pending"].clear()
            state["stopped"] = True
            logger.info(f"Experiment executor cancelled: exp={experiment_id}")
    
    # 主动停止调度器中所有正在运行的任务（不等 LLM 调用自然结束）
    if all_task_ids:
        try:
            from app.services.scheduler import stop_task
            from app.models import Conversation
            
            stopped_count = 0
            for task_id in all_task_ids:
                try:
                    conversation = Conversation.query.filter_by(action_task_id=task_id).first()
                    if conversation:
                        result = stop_task(task_id, conversation.id)
                        if result:
                            stopped_count += 1
                except Exception as e:
                    # 有些任务可能还没提交到调度器，忽略错误
                    pass
            if stopped_count > 0:
                logger.info(f"Experiment cancel: actively stopped {stopped_count} scheduler tasks for exp={experiment_id}")
        except Exception as e:
            logger.error(f"Error actively stopping scheduler tasks: {e}")


def _dispatch(experiment_id: str):
    """从待执行队列中取任务提交到线程池，不超过 max_concurrent"""
    with _lock:
        state = _experiment_state.get(experiment_id)
        if not state or state["stopped"]:
            return

        to_start = []
        task_config = state["task_config"]
        while state["pending"] and state["running"] < state["max_concurrent"]:
            tid = state["pending"].pop(0)
            state["running"] += 1
            to_start.append(tid)

        if not to_start:
            return

        logger.info(f"Experiment dispatch: exp={experiment_id}, dispatching={len(to_start)}, running_after={state['running']}, pending={len(state['pending'])}, max_concurrent={state['max_concurrent']}")

    executor = _get_executor()
    for tid in to_start:
        future = executor.submit(
            _run_task, experiment_id, tid, task_config
        )
        future.add_done_callback(
            lambda f, eid=experiment_id, t=tid: _on_task_done(f, eid, t)
        )
        logger.info(f"Experiment task dispatched: exp={experiment_id}, task={tid}")


def _run_task(experiment_id: str, task_id: str, task_config: Dict[str, Any]):
    """在线程池中执行单个实验任务"""
    # 执行前检查实验是否已停止
    with _lock:
        state = _experiment_state.get(experiment_id)
        if state and state["stopped"]:
            logger.info(f"Experiment stopped, skipping task: exp={experiment_id}, task={task_id}")
            return

    try:
        from app.services.parallel_experiment_service import ParallelExperimentService
        ParallelExperimentService._start_autonomous_task(task_id, task_config)
    finally:
        from app import db
        db.session.remove()


def _on_task_done(future: Future, experiment_id: str, task_id: str):
    """任务完成回调：减少计数，异常时更新任务状态，按需创建新任务（延迟创建），调度下一个"""
    with _lock:
        state = _experiment_state.get(experiment_id)
        if state:
            state["running"] = max(0, state["running"] - 1)

    exc = future.exception()
    if exc:
        logger.error(f"Experiment task failed: exp={experiment_id}, task={task_id}, error={exc}", exc_info=exc)
        # 将失败的任务对应的 AutonomousTask 标记为 failed
        try:
            from app import db
            from app.models import Conversation, AutonomousTask
            try:
                conversation = Conversation.query.filter_by(action_task_id=task_id).first()
                if conversation:
                    autonomous_task = AutonomousTask.query.filter_by(
                        conversation_id=conversation.id
                    ).order_by(AutonomousTask.created_at.desc()).first()
                    if autonomous_task and autonomous_task.status in ('active', 'running'):
                        autonomous_task.status = 'failed'
                        db.session.commit()
                        logger.info(f"Marked autonomous task as failed: {autonomous_task.id}")
            finally:
                db.session.remove()
        except Exception as inner_exc:
            logger.error(f"Failed to update task status after error: {inner_exc}")

    # === 延迟创建：任务完成后从 pending_combinations 中按需创建新任务 ===
    _try_create_next_tasks(experiment_id)
    
    _dispatch(experiment_id)


def _try_create_next_tasks(experiment_id: str):
    """尝试从 pending_combinations 中创建新任务（延迟创建）
    
    在任务完成回调中调用，确保缓冲区始终有足够的待执行任务。
    """
    with _lock:
        state = _experiment_state.get(experiment_id)
        if not state or state.get("stopped"):
            return
        max_concurrent = state.get("max_concurrent", 3)
    
    try:
        from app import db
        from app.models import ParallelExperiment
        from app.services.parallel_experiment_service import ParallelExperimentService
        
        try:
            experiment = ParallelExperiment.query.get(experiment_id)
            if not experiment or experiment.status != 'running':
                return
            
            current_iteration = experiment.current_iteration or 0
            if not current_iteration:
                return
            
            iteration_key = str(current_iteration)
            pending = experiment.pending_combinations.get(iteration_key, []) if experiment.pending_combinations else []
            
            if not pending:
                return
            
            # 计算需要创建多少个：保持缓冲区为 max_concurrent 个
            # 检查当前已创建但还未执行完的任务数
            current_task_ids = experiment.cloned_action_task_ids.get(iteration_key, [])
            
            # 统计 pending 状态的已创建任务（已创建但还没运行/没运行完）
            from app.models import Conversation, AutonomousTask
            pending_created_count = 0
            for tid in current_task_ids:
                # 检查 executor 中是否还在 pending 队列
                with _lock:
                    s = _experiment_state.get(experiment_id)
                    if s and tid in s.get("pending", []):
                        pending_created_count += 1
            
            # 需要补充的数量
            needed = max_concurrent - pending_created_count
            if needed <= 0:
                return
            
            # 创建新任务
            new_task_ids = ParallelExperimentService._create_next_tasks(
                experiment, needed
            )
            
            if new_task_ids:
                # 重新查询剩余数量（_create_next_tasks 已经 commit 了）
                db.session.refresh(experiment)
                remaining_after = len(experiment.pending_combinations.get(iteration_key, [])) if experiment.pending_combinations else 0
                logger.info(f"延迟创建回调: exp={experiment_id}, created={len(new_task_ids)}, remaining_pending={remaining_after}")
        finally:
            db.session.remove()
    except Exception as e:
        logger.error(f"延迟创建任务失败: exp={experiment_id}, error={e}", exc_info=True)


def is_task_submitted(experiment_id: str, task_id: str) -> bool:
    """检查任务是否已提交过（防止重复提交）"""
    with _lock:
        state = _experiment_state.get(experiment_id)
        if state:
            return task_id in state["submitted"]
        return False


def get_running_count(experiment_id: str) -> int:
    with _lock:
        state = _experiment_state.get(experiment_id)
        return state["running"] if state else 0


def shutdown():
    global _executor, _executor_size
    if _executor:
        _executor.shutdown(wait=False)
        _executor = None
        _executor_size = 0
        logger.info("Experiment executor shutdown")
