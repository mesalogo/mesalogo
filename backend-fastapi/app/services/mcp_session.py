#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP会话抽象基类和实现类

提供统一的会话接口，支持 stdio、streamable_http、sse 三种通信方式。
"""

import asyncio
import logging
import os
import time
import traceback
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from mcp import ClientSession, StdioServerParameters, stdio_client
from mcp.client.sse import sse_client
from mcp.client.streamable_http import streamablehttp_client
from mcp.shared.exceptions import McpError

logger = logging.getLogger(__name__)


class MCPSession(ABC):
    """MCP会话抽象基类"""
    
    def __init__(self, server_id: str):
        self.server_id = server_id
        self._cmd_queue: Optional[asyncio.Queue] = None
        self._ready_event: Optional[asyncio.Event] = None
        self._session: Optional[ClientSession] = None
        self._worker_future = None
    
    @property
    def is_ready(self) -> bool:
        """检查会话是否就绪且有效"""
        if self._ready_event is None or not self._ready_event.is_set():
            return False
        # 检查 worker 是否还在运行
        if self._worker_future is not None and self._worker_future.done():
            return False
        # 检查 session 是否有效
        return self._session is not None
    
    @abstractmethod
    async def _worker(self) -> None:
        """会话 worker 协程，子类实现具体连接逻辑"""
        pass
    
    @abstractmethod
    def _get_session_type(self) -> str:
        """返回会话类型名称"""
        pass
    
    def start(self, loop: asyncio.AbstractEventLoop, timeout: int = 60) -> bool:
        """启动会话 worker
        
        Args:
            loop: 持久事件循环
            timeout: 等待就绪的超时时间（秒）
            
        Returns:
            bool: 是否启动成功
        """
        session_type = self._get_session_type()
        
        # 检查是否已就绪
        if self.is_ready:
            return True
        
        # 如果正在启动中，等待完成
        if self._ready_event is not None:
            try:
                asyncio.run_coroutine_threadsafe(
                    asyncio.wait_for(self._ready_event.wait(), timeout=timeout), loop
                ).result(timeout=timeout + 5)
                return True
            except Exception:
                self._reset()
        
        try:
            # 初始化队列和事件
            def init_in_loop():
                self._cmd_queue = asyncio.Queue()
                self._ready_event = asyncio.Event()
            
            loop.call_soon_threadsafe(init_in_loop)
            time.sleep(0.1)  # 等待初始化完成
            
            # 启动 worker
            self._worker_future = asyncio.run_coroutine_threadsafe(self._worker(), loop)
            
            # 等待 worker 开始（最多15秒）
            for _ in range(150):
                if self._ready_event is not None:
                    break
                if self._worker_future.done():
                    self._worker_future.result()
                    return False
                time.sleep(0.1)
            else:
                logger.error(f"{session_type} worker 启动超时: {self.server_id}")
                return False
            
            # 等待会话初始化完成
            asyncio.run_coroutine_threadsafe(
                asyncio.wait_for(self._ready_event.wait(), timeout=timeout), loop
            ).result(timeout=timeout + 5)
            
            logger.info(f"{session_type} 会话启动成功: {self.server_id}")
            return True
            
        except Exception as e:
            logger.error(f"启动 {session_type} 会话失败: {self.server_id}, {e}")
            return False
    
    def _reset(self) -> None:
        """重置会话状态"""
        self._cmd_queue = None
        self._ready_event = None
        self._session = None
        self._worker_future = None
    
    def send_command(self, loop: asyncio.AbstractEventLoop, cmd: dict, timeout: int = 120) -> Any:
        """向 worker 发送命令并等待结果
        
        Args:
            loop: 持久事件循环
            cmd: 命令字典
            timeout: 超时时间（秒）
            
        Returns:
            命令执行结果
        """
        if self._cmd_queue is None:
            return None
        
        result_future = loop.create_future()
        cmd["result_future"] = result_future
        
        loop.call_soon_threadsafe(self._cmd_queue.put_nowait, cmd)
        
        return asyncio.run_coroutine_threadsafe(
            asyncio.wait_for(result_future, timeout=timeout), loop
        ).result(timeout=timeout + 5)
    
    def stop(self, loop: asyncio.AbstractEventLoop) -> None:
        """停止会话 worker"""
        session_type = self._get_session_type()
        try:
            self.send_command(loop, {"type": "stop"}, timeout=10)
        except Exception as e:
            logger.warning(f"停止 {session_type} 会话时出错: {self.server_id}, {e}")
        finally:
            self._reset()
    
    def call_tool(self, loop: asyncio.AbstractEventLoop, tool_name: str, params: dict, timeout: int = 120) -> Any:
        """调用工具
        
        Args:
            loop: 持久事件循环
            tool_name: 工具名称
            params: 工具参数
            timeout: 超时时间（秒）
            
        Returns:
            工具调用结果
            
        Raises:
            ConnectionError: 会话已中止时抛出
        """
        session_type = self._get_session_type()
        
        # 检查会话是否有效，如果无效则抛出异常让调用方重新启动
        if not self.is_ready:
            raise ConnectionError(f"{session_type} 会话已中止: {self.server_id}，需要重新启动")
        
        logger.info(f"复用 {session_type} 会话调用: {self.server_id}/{tool_name}")
        return self.send_command(loop, {
            "type": "call_tool",
            "tool_name": tool_name,
            "params": params
        }, timeout=timeout)
    
    def list_tools(self, loop: asyncio.AbstractEventLoop, timeout: int = 30) -> Any:
        """获取工具列表
        
        Args:
            loop: 持久事件循环
            timeout: 超时时间（秒）
            
        Returns:
            工具列表
        """
        return self.send_command(loop, {"type": "list_tools"}, timeout=timeout)
    
    async def _process_commands(self) -> None:
        """处理命令循环（通用逻辑）"""
        session_type = self._get_session_type()
        
        while True:
            cmd = await self._cmd_queue.get()
            cmd_type = cmd.get("type")
            result_future = cmd.get("result_future")
            
            try:
                if cmd_type == "stop":
                    if result_future:
                        result_future.set_result(True)
                    break
                elif cmd_type == "call_tool":
                    if self._session is None:
                        raise ConnectionError(f"会话已关闭: {self.server_id}")
                    result = await self._session.call_tool(
                        cmd["tool_name"],
                        arguments=cmd["params"]
                    )
                    if result_future:
                        result_future.set_result(result)
                elif cmd_type == "list_tools":
                    if self._session is None:
                        raise ConnectionError(f"会话已关闭: {self.server_id}")
                    result = await self._session.list_tools()
                    if result_future:
                        result_future.set_result(result)
            except McpError as e:
                # MCP SDK 标准错误，转换为 ConnectionError 便于上层统一处理重连
                wrapped_error = ConnectionError(f"MCP会话错误: {self.server_id}, 原因: {e}")
                if result_future:
                    result_future.set_exception(wrapped_error)
                logger.error(f"{session_type} MCP错误: {self.server_id}, {cmd_type}, {e}")
                self._session = None
                break
            except Exception as e:
                if result_future:
                    result_future.set_exception(e)
                logger.error(f"{session_type} 命令执行失败: {self.server_id}, {cmd_type}, {e}")


class StdioSession(MCPSession):
    """Stdio 通信方式的 MCP 会话"""
    
    def __init__(self, server_id: str, command: str, args: List[str] = None, env: Dict[str, str] = None):
        super().__init__(server_id)
        self.command = command
        self.args = args or []
        self.env = env or {}
    
    def _get_session_type(self) -> str:
        return "stdio"
    
    async def _worker(self) -> None:
        """Stdio 会话 worker"""
        server_params = StdioServerParameters(
            command=self.command,
            args=self.args,
            env={**os.environ, **self.env}
        )
        
        try:
            async with stdio_client(server_params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    
                    self._session = session
                    self._ready_event.set()
                    logger.info(f"stdio 会话已建立: {self.server_id}")
                    
                    await self._process_commands()
                    
        except Exception as e:
            logger.error(f"stdio worker 异常退出: {self.server_id}, {e}")
            logger.error(f"详细错误: {traceback.format_exc()}")
        finally:
            self._session = None
            logger.info(f"stdio 会话已关闭: {self.server_id}")


class StreamableHttpSession(MCPSession):
    """StreamableHTTP 通信方式的 MCP 会话"""
    
    def __init__(self, server_id: str, url: str):
        super().__init__(server_id)
        self.url = url
    
    def _get_session_type(self) -> str:
        return "StreamableHTTP"
    
    async def _worker(self) -> None:
        """StreamableHTTP 会话 worker"""
        try:
            async with streamablehttp_client(self.url) as (read, write, _):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    
                    self._session = session
                    self._ready_event.set()
                    logger.info(f"StreamableHTTP 会话已建立: {self.server_id}, URL: {self.url}")
                    
                    await self._process_commands()
                    
        except Exception as e:
            logger.error(f"StreamableHTTP worker 异常退出: {self.server_id}, {e}")
            logger.error(f"详细错误: {traceback.format_exc()}")
        finally:
            self._session = None
            logger.info(f"StreamableHTTP 会话已关闭: {self.server_id}")


class SSESession(MCPSession):
    """SSE 通信方式的 MCP 会话"""
    
    def __init__(self, server_id: str, url: str):
        super().__init__(server_id)
        self.url = url
    
    def _get_session_type(self) -> str:
        return "SSE"
    
    async def _worker(self) -> None:
        """SSE 会话 worker"""
        try:
            async with sse_client(self.url) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    
                    self._session = session
                    self._ready_event.set()
                    logger.info(f"SSE 会话已建立: {self.server_id}, URL: {self.url}")
                    
                    await self._process_commands()
                    
        except Exception as e:
            logger.error(f"SSE worker 异常退出: {self.server_id}, {e}")
            logger.error(f"详细错误: {traceback.format_exc()}")
        finally:
            self._session = None
            logger.info(f"SSE 会话已关闭: {self.server_id}")


def create_session(server_id: str, server_config: dict) -> Optional[MCPSession]:
    """根据配置创建对应类型的会话
    
    Args:
        server_id: 服务器ID
        server_config: 服务器配置
        
    Returns:
        MCPSession 实例，如果配置无效则返回 None
    """
    comm_type = server_config.get('comm_type', 'stdio')
    
    if comm_type == 'stdio':
        command = server_config.get('command')
        if not command:
            logger.error(f"服务器 {server_id} 缺少 command 配置")
            return None
        return StdioSession(
            server_id=server_id,
            command=command,
            args=server_config.get('args', []),
            env=server_config.get('env', {})
        )
    
    elif comm_type == 'streamable_http':
        url = server_config.get('url')
        if not url:
            logger.error(f"服务器 {server_id} 缺少 url 配置")
            return None
        return StreamableHttpSession(server_id=server_id, url=url)
    
    elif comm_type == 'sse':
        url = server_config.get('url')
        if not url:
            logger.error(f"服务器 {server_id} 缺少 url 配置")
            return None
        return SSESession(server_id=server_id, url=url)
    
    else:
        logger.warning(f"服务器 {server_id} 使用不支持的通信类型: {comm_type}")
        return None
