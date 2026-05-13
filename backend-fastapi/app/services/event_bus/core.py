"""
事件总线核心模块

提供独立的事件总线系统，为并行实验室服务，同时为未来改造普通会话和任务奠定基础。

作者：ABM-LLM系统
创建时间：2025-01-20
"""

import json
import queue
import threading
import logging
from datetime import datetime
from typing import Dict, List, Any, Callable, Optional
from collections import defaultdict
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class Event:
    """事件数据类"""
    type: str
    data: Dict[str, Any]
    timestamp: datetime
    event_id: str = None
    
    def __post_init__(self):
        if self.event_id is None:
            import uuid
            self.event_id = str(uuid.uuid4())


class EventBus:
    """独立的事件总线，不依赖现有的Observer模式"""
    
    def __init__(self):
        self._subscribers = defaultdict(list)
        self._event_queue = queue.Queue()
        self._running = False
        self._worker_thread = None
        self._middleware = []
        self._lock = threading.Lock()
    
    def subscribe(self, event_type: str, handler: Callable[[Event], None]):
        """订阅事件
        
        Args:
            event_type: 事件类型，支持通配符 (如 'experiment.*')
            handler: 事件处理函数
        """
        with self._lock:
            self._subscribers[event_type].append(handler)
            logger.debug(f"订阅事件类型: {event_type}")
    
    def unsubscribe(self, event_type: str, handler: Callable[[Event], None]):
        """取消订阅事件
        
        Args:
            event_type: 事件类型
            handler: 事件处理函数
        """
        with self._lock:
            if event_type in self._subscribers:
                try:
                    self._subscribers[event_type].remove(handler)
                    logger.debug(f"取消订阅事件类型: {event_type}")
                except ValueError:
                    logger.warning(f"尝试取消订阅不存在的处理器: {event_type}")
    
    def publish(self, event_type: str, data: Dict[str, Any]):
        """发布事件
        
        Args:
            event_type: 事件类型
            data: 事件数据
        """
        event = Event(
            type=event_type,
            data=data,
            timestamp=datetime.now()
        )
        
        # 应用中间件
        for middleware in self._middleware:
            try:
                event = middleware(event)
                if event is None:
                    logger.debug(f"事件被中间件过滤: {event_type}")
                    return
            except Exception as e:
                logger.error(f"中间件处理事件失败: {str(e)}")
        
        self._event_queue.put(event)
        logger.debug(f"发布事件: {event_type}")
    
    def add_middleware(self, middleware: Callable[[Event], Optional[Event]]):
        """添加中间件
        
        Args:
            middleware: 中间件函数，接收事件并返回处理后的事件或None
        """
        self._middleware.append(middleware)
    
    def start_processing(self):
        """启动事件处理循环"""
        if self._running:
            logger.warning("事件总线已在运行")
            return
        
        self._running = True
        self._worker_thread = threading.Thread(target=self._process_events, daemon=True)
        self._worker_thread.start()
        logger.info("事件总线开始处理事件")
    
    def stop_processing(self):
        """停止事件处理循环"""
        self._running = False
        if self._worker_thread:
            self._worker_thread.join(timeout=5)
        logger.info("事件总线停止处理事件")
    
    def _process_events(self):
        """事件处理循环"""
        while self._running:
            try:
                event = self._event_queue.get(timeout=1)
                self._handle_event(event)
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"处理事件时出错: {str(e)}")
    
    def _handle_event(self, event: Event):
        """处理单个事件"""
        with self._lock:
            # 获取所有匹配的订阅者
            handlers = []
            
            # 精确匹配
            if event.type in self._subscribers:
                handlers.extend(self._subscribers[event.type])
            
            # 通配符匹配
            for pattern, pattern_handlers in self._subscribers.items():
                if self._match_pattern(pattern, event.type):
                    handlers.extend(pattern_handlers)
        
        # 执行处理器
        for handler in handlers:
            try:
                handler(event)
            except Exception as e:
                logger.error(f"事件处理器执行失败: {str(e)}")
    
    def _match_pattern(self, pattern: str, event_type: str) -> bool:
        """匹配事件类型模式"""
        if pattern == event_type:
            return True
        
        # 简单的通配符匹配
        if pattern.endswith('.*'):
            prefix = pattern[:-2]
            return event_type.startswith(prefix + '.')
        
        return False


# 事件类型常量
class ExperimentEvents:
    """实验事件类型"""
    CREATED = 'experiment.created'
    STARTED = 'experiment.started'
    COMPLETED = 'experiment.completed'
    FAILED = 'experiment.failed'
    STOPPED = 'experiment.stopped'


class RunEvents:
    """运行实例事件类型"""
    STARTED = 'run.started'
    STEP_COMPLETED = 'run.step_completed'
    COMPLETED = 'run.completed'
    FAILED = 'run.failed'
    STOPPED = 'run.stopped'


class MetricEvents:
    """度量事件类型"""
    COLLECTED = 'metric.collected'
    STOP_CONDITION_MET = 'stop_condition.met'


# 全局事件总线实例
experiment_bus = EventBus()
