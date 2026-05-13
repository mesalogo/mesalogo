"""
统一任务调度系统 (KISS版)

三层架构：
- TaskScheduler: 任务调度层，管理Task间的依赖、触发时机
- Task: Agent编排层，管理单个任务内多个Agent的执行
- Stream: 流层（现有机制，保持不变）

设计原则：
- 配置优于继承：用配置字典区分任务类型
- 扁平结构：最多2层抽象
- 一套代码处理所有情况

使用方式：
1. 直接使用 TaskScheduler（推荐）：
   from app.services.scheduler import TaskScheduler, Task
   scheduler = TaskScheduler.get_instance()
   await scheduler.submit_and_start(task)

2. 使用适配器（兼容旧API）：
   from app.services.scheduler import start_task, stop_task, pause_task, resume_task
   start_task(task_id, conversation_id, "discussion", config)
"""

from .scheduler import TaskScheduler, Task, TaskState
from .task_adapter import (
    start_task,
    stop_task,
    pause_task,
    resume_task,
    get_task_status
)

__all__ = [
    # 核心类
    'TaskScheduler',
    'Task', 
    'TaskState',
    # 适配器函数
    'start_task',
    'stop_task',
    'pause_task',
    'resume_task',
    'get_task_status'
]
