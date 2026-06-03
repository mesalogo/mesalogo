"""
HTTP连接管理器

直接管理HTTP连接和线程，用于流式请求的取消
支持异步模式：通过 asyncio.Task.cancel() 实现真正的硬取消
"""

import asyncio
import logging
import threading
import time
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

class ConnectionManager:
    """HTTP连接管理器 - 直接管理连接和线程"""

    def __init__(self):
        self._active_connections: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        # 线程中断标志，用于强制终止流式处理
        self._thread_interrupt_flags: Dict[str, threading.Event] = {}
        # 周期性回收任务句柄（由 start/stop_periodic_cleanup 管理）
        self._cleanup_task: Optional[asyncio.Task] = None

    def register_connection(self, request_id: str, client: httpx.Client = None,
                          response: Optional[httpx.Response] = None,
                          thread: Optional[threading.Thread] = None,
                          async_task: Optional[asyncio.Task] = None,
                          event_loop: Optional[asyncio.AbstractEventLoop] = None) -> None:
        """
        注册HTTP连接

        Args:
            request_id: 请求ID
            client: httpx客户端对象（同步模式）
            response: 响应对象（可选）
            thread: 处理线程（可选）
            async_task: asyncio任务（异步模式，用于取消）
            event_loop: asyncio事件循环（异步模式）
        """
        with self._lock:
            # 如果已存在同名连接，先清理旧连接（避免旧的中断标志影响新连接）
            if request_id in self._active_connections:
                old_conn = self._active_connections[request_id]
                old_cancelled = old_conn.get('cancelled', False)
                logger.info(f"[连接管理器] 覆盖已有连接: {request_id}, 旧连接cancelled={old_cancelled}")
                # 尝试取消旧的异步任务
                old_task = old_conn.get('async_task')
                old_loop = old_conn.get('event_loop')
                if old_task and old_loop and not old_task.done():
                    try:
                        old_loop.call_soon_threadsafe(old_task.cancel)
                        logger.info(f"[连接管理器] 已取消旧的asyncio任务: {request_id}")
                    except Exception as e:
                        logger.debug(f"[连接管理器] 取消旧asyncio任务时出错: {request_id}, 错误: {str(e)}")

            # 清理旧的中断标志（确保新连接不会被旧标志误杀）
            if request_id in self._thread_interrupt_flags:
                old_flag = self._thread_interrupt_flags[request_id]
                if old_flag.is_set():
                    logger.info(f"[连接管理器] 清理旧的已设置中断标志: {request_id}")

            # 创建新的线程中断标志
            interrupt_flag = threading.Event()
            self._thread_interrupt_flags[request_id] = interrupt_flag

            self._active_connections[request_id] = {
                'client': client,  # httpx.Client (同步) 或 None (异步)
                'response': response,
                'thread': thread,
                'async_task': async_task,  # asyncio.Task (异步模式)
                'event_loop': event_loop,  # asyncio 事件循环
                'created_at': time.time(),
                'cancelled': False,
                'interrupt_flag': interrupt_flag
            }
            logger.info(f"[连接管理器] 已注册连接: {request_id}, 异步模式: {async_task is not None}")

    def force_close_connection(self, request_id: str) -> bool:
        """
        强制关闭连接 - 直接命中要害

        Args:
            request_id: 请求ID

        Returns:
            bool: 是否成功关闭
        """
        with self._lock:
            if request_id not in self._active_connections:
                logger.info(f"[连接管理器] 连接不存在: {request_id}")
                return True

            connection_info = self._active_connections[request_id]

            # 标记为已取消
            connection_info['cancelled'] = True

            # 设置线程中断标志
            interrupt_flag = connection_info.get('interrupt_flag')
            if interrupt_flag:
                interrupt_flag.set()
                logger.info(f"[连接管理器] 已设置线程中断标志: {request_id}")

            success = False

            try:
                # 1. 异步模式：取消 asyncio.Task（立即中断，抛出 CancelledError）
                async_task = connection_info.get('async_task')
                event_loop = connection_info.get('event_loop')
                if async_task and event_loop:
                    try:
                        if not async_task.done():
                            # 在事件循环中安全地取消任务
                            event_loop.call_soon_threadsafe(async_task.cancel)
                            logger.info(f"[连接管理器] 已取消asyncio任务（硬取消）: {request_id}")
                            success = True
                    except Exception as e:
                        logger.debug(f"[连接管理器] 取消asyncio任务时出错: {request_id}, 错误: {str(e)}")

                # 2. 同步模式：关闭 httpx.Client
                client = connection_info.get('client')
                if client:
                    try:
                        client.close()
                        logger.info(f"[连接管理器] 已关闭httpx客户端: {request_id}")
                        success = True
                    except Exception as e:
                        logger.debug(f"[连接管理器] 关闭httpx客户端时出错: {request_id}, 错误: {str(e)}")

                # 3. 关闭响应对象
                response = connection_info.get('response')
                if response:
                    try:
                        response.close()
                        logger.debug(f"[连接管理器] 已关闭响应对象: {request_id}")
                        success = True
                    except Exception as e:
                        logger.debug(f"[连接管理器] 关闭响应对象时出错: {request_id}, 错误: {str(e)}")

                # 4. 如果有处理线程，等待它检测到中断
                thread = connection_info.get('thread')
                if thread and thread.is_alive():
                    logger.debug(f"[连接管理器] 检测到活动线程，等待其检测中断: {request_id}")

                logger.info(f"[连接管理器] 成功强制关闭连接: {request_id}")

            except Exception as e:
                logger.error(f"[连接管理器] 强制关闭连接时出错: {request_id}, 错误: {str(e)}")
                # 即使出错也认为成功，避免前端卡住
                success = True

            finally:
                # 从活动连接中移除
                del self._active_connections[request_id]
                # 注意：不立即清理中断标志，让线程有时间检测到中断状态
                # 中断标志将在cleanup_old_connections中清理，或者在下次注册同名连接时覆盖
                logger.info(f"[连接管理器] 已从活动连接中移除: {request_id}")
                logger.debug(f"[连接管理器] 中断标志保留，等待线程检测: {request_id}")

            return success

    def force_close_connections_by_prefix(self, prefix: str) -> int:
        """
        关闭所有以指定前缀开头的连接
        
        Args:
            prefix: 请求ID前缀（如 "task_id:conversation_id:"）
            
        Returns:
            int: 成功关闭的连接数
        """
        with self._lock:
            matching_keys = [k for k in self._active_connections.keys() if k.startswith(prefix)]
        
        closed_count = 0
        for request_id in matching_keys:
            if self.force_close_connection(request_id):
                closed_count += 1
                
        logger.info(f"[连接管理器] 通过前缀 {prefix} 关闭了 {closed_count} 个连接")
        return closed_count

    # httpx 的关闭方法更简单，只需要 client.close() 和 response.close()
    # 不再需要复杂的底层 socket 操作

    def is_cancelled(self, request_id: str) -> bool:
        """
        检查连接是否已被取消

        Args:
            request_id: 请求ID

        Returns:
            bool: 是否已被取消
        """
        with self._lock:
            if request_id in self._active_connections:
                return self._active_connections[request_id].get('cancelled', False)
            return False

    def should_interrupt(self, request_id: str) -> bool:
        """
        检查线程是否应该中断

        Args:
            request_id: 请求ID

        Returns:
            bool: 是否应该中断
        """
        with self._lock:
            # 检查是否有设置的中断标志
            if request_id in self._thread_interrupt_flags:
                return self._thread_interrupt_flags[request_id].is_set()
            # 检查连接是否存在且被标记为取消
            if request_id in self._active_connections:
                return self._active_connections[request_id].get('cancelled', False)
            # 如果连接不存在且没有中断标志，返回 False
            # 因为新连接在注册前会调用此方法，不应被误判为需要中断
            return False

    def cleanup_old_connections(self, max_age_seconds: int = 3600) -> None:
        """
        清理超时的连接和中断标志

        Args:
            max_age_seconds: 最大存活时间（秒）
        """
        current_time = time.time()
        to_remove = []

        with self._lock:
            for request_id, conn_info in self._active_connections.items():
                if current_time - conn_info['created_at'] > max_age_seconds:
                    to_remove.append(request_id)

        for request_id in to_remove:
            logger.info(f"[连接管理器] 清理超时连接: {request_id}")
            self.force_close_connection(request_id)

        # 清理孤立的中断标志（没有对应活动连接的）
        with self._lock:
            orphaned_flags = []
            for request_id in self._thread_interrupt_flags:
                if request_id not in self._active_connections:
                    # 检查标志是否已经被设置了足够长的时间（给线程时间检测）
                    if self._thread_interrupt_flags[request_id].is_set():
                        orphaned_flags.append(request_id)

            for request_id in orphaned_flags:
                del self._thread_interrupt_flags[request_id]
                logger.debug(f"[连接管理器] 清理孤立的中断标志: {request_id}")

    async def _cleanup_loop(self, interval_seconds: int, max_age_seconds: int) -> None:
        """周期性回收循环：定时调用 cleanup_old_connections。

        interval 本身（分钟级）即墓碑标记（tombstone，见
        docs/agents/stream-cancel-architecture.md）的宽限期，远大于 worker 2s
        轮询周期，因此不会与仍在循环中的 worker 竞争误删。
        """
        logger.info(f"[连接管理器] 周期性回收已启动: 间隔={interval_seconds}s, 最大存活={max_age_seconds}s")
        while True:
            try:
                await asyncio.sleep(interval_seconds)
                self.cleanup_old_connections(max_age_seconds)
            except asyncio.CancelledError:
                logger.info("[连接管理器] 周期性回收已停止")
                raise
            except Exception as e:
                # 回收器自身绝不能因单次异常而退出，否则墓碑标记重新无界增长
                logger.warning(f"[连接管理器] 周期性回收单次迭代出错: {e}")

    def start_periodic_cleanup(self, interval_seconds: int = 300, max_age_seconds: int = 3600) -> None:
        """在当前事件循环启动后台回收任务（幂等）。"""
        if self._cleanup_task is not None and not self._cleanup_task.done():
            return
        self._cleanup_task = asyncio.create_task(
            self._cleanup_loop(interval_seconds, max_age_seconds)
        )

    def stop_periodic_cleanup(self) -> None:
        """取消后台回收任务。"""
        if self._cleanup_task is not None and not self._cleanup_task.done():
            self._cleanup_task.cancel()
        self._cleanup_task = None

# 全局连接管理器实例
connection_manager = ConnectionManager()
