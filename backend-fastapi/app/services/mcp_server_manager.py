#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP服务器管理器

本模块负责MCP服务器的配置加载和生命周期管理，提供以下功能：
- 从配置文件加载MCP服务器配置
- 管理MCP服务器的启动和停止
- 提供API接口用于管理MCP服务器
- 支持动态加载新的服务器配置
- 缓存工具模式(tool schema)以提高性能
"""

import os
import json
import uuid
import logging
import subprocess
import atexit
import asyncio
import concurrent.futures
import traceback
from typing import Dict, List, Optional, Any
# Legacy Flask imports removed — Flask Blueprint 路由已迁移到 app/api/routes/mcp_servers.py
# from flask import Blueprint, request, jsonify
from pathlib import Path
import requests

# MCP SDK导入
from mcp import ClientSession, StdioServerParameters, stdio_client
from mcp.client.sse import sse_client
from mcp.client.streamable_http import streamablehttp_client

# 导入公共配置
from config import BACKEND_URL, BASE_DIR

# 导入工具模式缓存管理器
from app.services.tool_schema_cache import tool_schema_cache, ToolSchemaCache

# 导入统一会话接口
from app.services.mcp_session import MCPSession, create_session

# 设置日志
logger = logging.getLogger(__name__)

class MCPServerManager:
    """MCP服务器管理器，负责启动、停止和管理MCP服务器

    本类负责管理Model Context Protocol服务器，包括：
    - 内置的环境变量服务器（内部）
    - 外部MCP服务器（如Playwright等）

    服务器使用JSON配置文件定义，支持四种通信方式：
    - stdio: 使用标准输入输出通信（默认，适合本地工具）
    - streamable_http: 使用StreamableHTTP协议（推荐，适合远程服务）
    - sse: 使用Server-Sent Events（适合流式响应）
    - http: 使用简单HTTP API（支持OpenAPI规范）

    配置示例：
    {
        "mcpServers": {
            "variables-server": {
                "command": "curl",
                "args": ["-s", "-X", "POST", "http://.../api/mcp/variables"],
                "description": "环境变量服务器",
                "internal": true,
                "comm_type": "stdio"
            },
            "remote-service": {
                "url": "http://localhost:8000/mcp",
                "description": "远程MCP服务",
                "internal": false,
                "comm_type": "streamable_http",
                "enabled": false
            }
        }
    }
    """

    def __init__(self):
        """初始化MCP服务器管理器"""
        self.servers_config = {}  # 服务器配置
        self.running_servers = {}  # 运行中的服务器进程
        self._sessions: Dict[str, MCPSession] = {}  # 统一会话管理
        self._async_executor = None  # 共享线程池执行器（延迟初始化）
        
        # 持久事件循环（用于会话管理，确保会话在同一事件循环中）
        self._persistent_loop = None
        self._loop_thread = None
        
        # Legacy Flask Blueprint 已移除，路由已迁移到 app/api/routes/mcp_servers.py
        # self.api_blueprint = Blueprint('mcp_servers', __name__, url_prefix='/api/mcp')
        # self._register_endpoints()

        # 在初始化时加载配置，避免重复加载
        self.load_config()

        # 确保在应用退出时关闭所有服务器
        atexit.register(self.cleanup)

    def _convert_to_serializable(self, obj: Any) -> Any:
        """将MCP对象转换为可JSON序列化的格式

        Args:
            obj: 要转换的对象

        Returns:
            转换后的对象
        """
        if obj is None:
            return None

        # 处理基本类型
        if isinstance(obj, (str, int, float, bool)) or obj is None:
            return obj

        # 处理具有dict方法的对象（如Pydantic模型）
        if hasattr(obj, 'dict'):
            return obj.dict()

        # 处理具有model_dump方法的对象（Pydantic v2）
        if hasattr(obj, 'model_dump'):
            return obj.model_dump()

        # 处理具有__dict__属性的对象
        if hasattr(obj, '__dict__'):
            # 过滤掉内部字段
            return {k: self._convert_to_serializable(v) for k, v in obj.__dict__.items()
                   if not k.startswith('_') and not callable(v)}

        # 处理列表或元组
        if isinstance(obj, (list, tuple)):
            return [self._convert_to_serializable(item) for item in obj]

        # 处理字典
        if isinstance(obj, dict):
            return {k: self._convert_to_serializable(v) for k, v in obj.items()}

        # 对于其他类型，尝试转换为字符串
        try:
            return str(obj)
        except:
            return f"<不可序列化的对象: {type(obj).__name__}>"

    def cleanup(self):
        """清理资源：关闭所有服务器进程和线程池"""
        self.stop_all_servers()
        # 关闭共享的线程池执行器
        if self._async_executor is not None:
            self._async_executor.shutdown(wait=False)
            self._async_executor = None
        # 停止持久事件循环
        self._stop_persistent_loop()

    def _get_persistent_loop(self):
        """获取或创建持久的事件循环（在后台线程中运行）"""
        import threading
        
        need_new_loop = (
            self._loop_thread is None
            or not self._loop_thread.is_alive()
            or self._persistent_loop is None
            or self._persistent_loop.is_closed()
        )
        
        if need_new_loop:
            # 清理旧的已关闭循环
            if self._persistent_loop is not None and self._persistent_loop.is_closed():
                logger.warning("持久事件循环已关闭，正在重新创建")
                self._persistent_loop = None
                self._loop_thread = None
            
            def run_loop(loop):
                asyncio.set_event_loop(loop)
                loop.run_forever()
            
            self._persistent_loop = asyncio.new_event_loop()
            self._loop_thread = threading.Thread(
                target=run_loop, 
                args=(self._persistent_loop,),
                daemon=True,
                name="mcp_event_loop"
            )
            self._loop_thread.start()
            logger.info("持久事件循环已启动")
        return self._persistent_loop

    def _stop_persistent_loop(self):
        """停止持久事件循环"""
        if self._persistent_loop is not None:
            self._persistent_loop.call_soon_threadsafe(self._persistent_loop.stop)
            if self._loop_thread is not None:
                self._loop_thread.join(timeout=5)
            self._persistent_loop = None
            self._loop_thread = None
            logger.info("持久事件循环已停止")

    def _cleanup_session(self, server_id: str) -> None:
        """清理已中止的会话
        
        Args:
            server_id: 服务器ID
        """
        if server_id in self._sessions:
            try:
                self._sessions[server_id]._reset()
            except Exception:
                pass
            del self._sessions[server_id]
        if server_id in self.running_servers:
            del self.running_servers[server_id]
        logger.info(f"已清理中止的会话: {server_id}")

    def load_config(self) -> Dict:
        """从配置文件加载MCP服务器配置

        Returns:
            Dict: 加载的服务器配置
        """
        # 获取MCP配置文件路径
        config_path = Path(BASE_DIR) / 'mcp_config.json'

        logger.info(f"加载MCP服务器配置: {config_path}")

        if not config_path.exists():
            logger.warning(f"MCP配置文件不存在: {config_path}，使用默认配置")
            # 创建默认配置
            self.servers_config = {
                "mcpServers": {
                    "variables-server": {
                        "command": "curl",
                        "args": ["-s", "-X", "POST", f"{BACKEND_URL}/api/mcp/variables"],
                        "internal": True,
                        "description": "环境变量和智能体变量MCP服务器",
                        "comm_type": "stdio"  # 默认使用标准输入输出通信
                    }
                }
            }
            self._save_config()
        else:
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    self.servers_config = json.load(f)
                logger.info(f"成功加载MCP服务器配置: {len(self.servers_config.get('mcpServers', {}))} 个服务器")

                # 日志输出所有加载的服务器
                for server_id, config in self.servers_config.get('mcpServers', {}).items():
                    logger.info(f"已加载服务器配置: {server_id}, 内部服务器: {config.get('internal', False)}")
            except json.JSONDecodeError as e:
                logger.error(f"MCP配置文件格式错误: {e}")
                self.servers_config = {"mcpServers": {}}

        return self.servers_config

    def _save_config(self) -> None:
        """保存MCP服务器配置到文件"""
        config_path = Path(BASE_DIR) / 'mcp_config.json'

        try:
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(self.servers_config, f, indent=2, ensure_ascii=False)
            logger.info(f"MCP服务器配置已保存: {config_path}")
        except Exception as e:
            logger.error(f"保存MCP服务器配置失败: {e}")

    def enable_server(self, server_id: str) -> Dict:
        """启用指定的MCP服务器（更改配置状态）

        Args:
            server_id: 服务器ID

        Returns:
            Dict: 包含启用状态的字典
        """
        if not self.servers_config:
            self.load_config()

        server_config = self.servers_config.get('mcpServers', {}).get(server_id)
        if not server_config:
            logger.error(f"服务器 {server_id} 不存在")
            return {"status": "error", "message": f"服务器 {server_id} 不存在"}

        # 检查服务器是否是内部服务器
        if server_config.get('internal', False):
            logger.info(f"服务器 {server_id} 是内部服务器，始终处于启用状态")
            # 确保内部服务器始终标记为启用
            if 'enabled' not in server_config or not server_config['enabled']:
                server_config['enabled'] = True
                self._save_config()
                logger.info(f"已更新配置文件，标记内部服务器 {server_id} 为启用状态")
            return {"status": "enabled", "server_id": server_id, "internal": True}

        # 先尝试启动服务器进程
        result = self.start_server(server_id)

        # 如果启动失败，不更新配置文件，返回错误状态
        if result.get("status") == "error":
            logger.error(f"启动服务器 {server_id} 失败，不会标记为启用: {result.get('message')}")
            return {
                "status": "error",
                "server_id": server_id,
                "message": f"启动服务器失败，未标记为启用: {result.get('message')}",
                "enabled": False,
                "running": False
            }

        # 启动成功后，更新配置文件，标记服务器为启用状态
        server_config['enabled'] = True
        self._save_config()
        logger.info(f"服务器 {server_id} 启动成功，已更新配置文件标记为启用状态")

        return {
            "status": "enabled",
            "server_id": server_id,
            "running": True,
            "message": "服务器已启用并成功启动"
        }

    def start_server(self, server_id: str) -> Dict:
        """启动指定的MCP服务器进程

        Args:
            server_id: 服务器ID

        Returns:
            Dict: 包含启动状态的字典
        """
        if server_id in self.running_servers:
            logger.info(f"服务器 {server_id} 已经在运行")
            return {"status": "running", "server_id": server_id}

        if not self.servers_config:
            self.load_config()

        server_config = self.servers_config.get('mcpServers', {}).get(server_id)
        if not server_config:
            logger.error(f"服务器 {server_id} 不存在")
            return {"status": "error", "message": f"服务器 {server_id} 不存在"}

        # 检查服务器是否是内部服务器
        if server_config.get('internal', False):
            logger.info(f"服务器 {server_id} 是内部服务器，不需要单独启动")
            return {"status": "running", "server_id": server_id, "internal": True}

        try:
            comm_type = server_config.get('comm_type', 'stdio')  # 默认使用stdio通信

            # 根据通信类型进行不同处理
            if comm_type == 'http':
                # 普通HTTP通信方式，验证URL可用性
                url = server_config.get('url')
                if not url:
                    logger.error(f"服务器 {server_id} 使用HTTP通信方式但未提供URL")
                    return {
                        "status": "error",
                        "server_id": server_id,
                        "message": "使用HTTP通信方式必须提供URL"
                    }

                try:
                    logger.info(f"正在验证HTTP服务器 {server_id} 的URL: {url}")
                    response = requests.get(url, timeout=10)
                    self.running_servers[server_id] = "http_connection"
                    logger.info(f"HTTP服务器 {server_id} 连接成功，状态码: {response.status_code}")

                    tools = self._verify_server_running(server_id, timeout=10)
                    if tools is not None:
                        logger.info(f"HTTP服务器 {server_id} 验证成功，获取到 {len(tools)} 个工具")
                        self.refresh_tools(server_id)
                        return {
                            "status": "running",
                            "server_id": server_id,
                            "tools_count": ToolSchemaCache._count_tools(tools)
                        }
                    else:
                        if server_id in self.running_servers:
                            del self.running_servers[server_id]
                        return {
                            "status": "error",
                            "server_id": server_id,
                            "message": "HTTP服务器连接成功，但无法获取工具列表"
                        }
                except Exception as e:
                    logger.error(f"HTTP服务器 {server_id} 连接失败: {e}")
                    return {
                        "status": "error",
                        "server_id": server_id,
                        "message": f"HTTP服务器连接失败: {str(e)}"
                    }
            else:
                # stdio/sse/streamable_http 使用统一会话接口
                return self._connect_session(server_id, server_config)
        except Exception as e:
            logger.error(f"启动服务器 {server_id} 失败: {e}")
            return {"status": "error", "message": str(e)}

    def _connect_session(self, server_id: str, server_config: dict) -> Dict:
        """建立与MCP服务器的会话连接
        
        注意：这只是建立会话连接，不是启动服务器进程。
        对于 stdio 类型，会话包含了进程管理；
        对于 streamable_http/sse 类型，服务器是独立运行的，这里只建立连接。
        
        Args:
            server_id: 服务器ID
            server_config: 服务器配置
            
        Returns:
            Dict: 包含连接状态的字典
        """
        comm_type = server_config.get('comm_type', 'stdio')
        
        try:
            # 创建会话对象
            session = create_session(server_id, server_config)
            if session is None:
                return {
                    "status": "error",
                    "server_id": server_id,
                    "message": f"无法创建 {comm_type} 会话，请检查配置"
                }
            
            # 获取持久事件循环并启动会话
            loop = self._get_persistent_loop()
            success = session.start(loop, timeout=60)
            
            if not success:
                return {
                    "status": "error",
                    "server_id": server_id,
                    "message": f"建立 {comm_type} 会话连接失败"
                }
            
            # 保存会话并标记服务器为运行中
            self._sessions[server_id] = session
            self.running_servers[server_id] = f"{comm_type}_session"
            
            # 获取工具列表验证连接
            tools_result = session.list_tools(loop, timeout=30)
            if tools_result:
                tools = self._convert_to_serializable(tools_result)
                tool_schema_cache.set_tools(server_id, tools)
                logger.info(f"服务器 {server_id} 会话连接成功，获取到 {ToolSchemaCache._count_tools(tools)} 个工具")
                return {
                    "status": "running",
                    "server_id": server_id,
                    "tools_count": ToolSchemaCache._count_tools(tools),
                    "message": f"{comm_type} 会话已建立"
                }
            else:
                self._cleanup_session(server_id)
                return {
                    "status": "error",
                    "server_id": server_id,
                    "message": "会话建立后无法获取工具列表"
                }
        except Exception as e:
            logger.error(f"建立 {comm_type} 会话连接失败: {server_id}, {e}")
            self._cleanup_session(server_id)
            return {
                "status": "error",
                "server_id": server_id,
                "message": f"会话连接失败: {str(e)}"
            }

    def _reconnect_session(self, server_id: str) -> Dict:
        """重新建立与MCP服务器的会话连接
        
        当会话中断时调用此方法重连，不涉及服务器启停。
        
        Args:
            server_id: 服务器ID
            
        Returns:
            Dict: 包含重连状态的字典
        """
        server_config = self.servers_config.get('mcpServers', {}).get(server_id)
        if not server_config:
            return {"status": "error", "message": f"服务器配置不存在: {server_id}"}
        
        comm_type = server_config.get('comm_type', 'stdio')
        logger.info(f"正在重新建立 {comm_type} 会话连接: {server_id}")
        
        # 清理旧会话
        self._cleanup_session(server_id)
        
        # 建立新连接
        return self._connect_session(server_id, server_config)

    def disable_server(self, server_id: str) -> Dict:
        """禁用指定的MCP服务器（更改配置状态）

        Args:
            server_id: 服务器ID

        Returns:
            Dict: 包含禁用状态的字典
        """
        if not self.servers_config:
            self.load_config()

        server_config = self.servers_config.get('mcpServers', {}).get(server_id)
        if not server_config:
            logger.error(f"服务器 {server_id} 不存在")
            return {"status": "error", "message": f"服务器 {server_id} 不存在"}

        # 检查服务器是否是内部服务器
        if server_config.get('internal', False):
            logger.info(f"服务器 {server_id} 是内部服务器，不能被禁用")
            return {"status": "error", "message": f"内部服务器 {server_id} 不能被禁用", "internal": True}

        # 更新配置文件，标记服务器为禁用状态
        server_config['enabled'] = False
        self._save_config()
        logger.info(f"已更新配置文件，标记服务器 {server_id} 为禁用状态")

        # 停止服务器进程
        result = self.stop_server(server_id)

        # 如果停止失败，返回错误状态
        if result.get("status") == "error":
            logger.error(f"禁用服务器 {server_id} 成功，但停止失败: {result.get('message')}")
            return {
                "status": "error",
                "server_id": server_id,
                "message": f"服务器已标记为禁用，但停止失败: {result.get('message')}",
                "enabled": False,
                "running": True
            }

        return {
            "status": "disabled",
            "server_id": server_id,
            "running": False,
            "message": "服务器已禁用并成功停止"
        }

    def stop_server(self, server_id: str) -> Dict:
        """停止指定的MCP服务器进程

        Args:
            server_id: 服务器ID

        Returns:
            Dict: 包含停止状态的字典
        """
        server_type = self.running_servers.get(server_id)
        if not server_type:
            # 检查是否有残留的会话需要清理（统一接口）
            if server_id in self._sessions:
                loop = self._get_persistent_loop()
                self._sessions[server_id].stop(loop)
                del self._sessions[server_id]
            logger.info(f"服务器 {server_id} 未运行")
            return {"status": "stopped", "server_id": server_id}

        try:
            # 如果是HTTP连接，直接从列表中移除
            if server_type == "http_connection":
                logger.info(f"HTTP服务器 {server_id} 已从运行列表中移除")
                del self.running_servers[server_id]
                tool_schema_cache.remove_tools(server_id)
                return {"status": "stopped", "server_id": server_id}

            # 使用统一会话接口停止会话
            if server_id in self._sessions:
                logger.info(f"正在关闭会话: {server_id}")
                loop = self._get_persistent_loop()
                self._sessions[server_id].stop(loop)
                del self._sessions[server_id]
                del self.running_servers[server_id]
                tool_schema_cache.remove_tools(server_id)
                logger.info(f"服务器 {server_id} 已停止，并清除了工具缓存")
                return {"status": "stopped", "server_id": server_id}

            # 兼容旧代码：如果是 subprocess.Popen 进程对象
            if hasattr(server_type, 'terminate'):
                server_type.terminate()
                try:
                    server_type.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server_type.kill()

            # 从运行列表中移除
            del self.running_servers[server_id]
            tool_schema_cache.remove_tools(server_id)
            logger.info(f"服务器 {server_id} 已停止，并清除了工具缓存")

            return {"status": "stopped", "server_id": server_id}
        except Exception as e:
            logger.error(f"停止服务器 {server_id} 失败: {e}")
            return {"status": "error", "message": str(e)}

    def _verify_sse_endpoint(self, url: str, timeout: int = 10) -> bool:
        """验证SSE端点是否可用

        Args:
            url: SSE端点URL
            timeout: 超时时间（秒）

        Returns:
            bool: 是否验证成功
        """
        import requests
        import time

        try:
            logger.info(f"正在验证SSE端点: {url}")

            # 创建一个流式请求来测试SSE连接
            response = requests.get(
                url,
                timeout=timeout,
                stream=True,
                headers={
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache'
                }
            )

            if response.status_code != 200:
                logger.error(f"SSE端点返回错误状态码: {response.status_code}")
                return False

            # 检查Content-Type是否为text/event-stream
            content_type = response.headers.get('content-type', '')
            if 'text/event-stream' not in content_type:
                logger.warning(f"SSE端点Content-Type不正确: {content_type}")
                # 不直接返回False，因为有些服务器可能没有设置正确的Content-Type

            # 尝试读取一些初始数据来验证连接
            start_time = time.time()
            try:
                for line in response.iter_lines(decode_unicode=True):
                    if line:
                        logger.info(f"SSE端点验证成功，收到数据: {line[:100]}...")
                        response.close()  # 关闭连接
                        return True

                    # 如果超过3秒还没有收到数据，也认为连接成功
                    if time.time() - start_time > 3:
                        logger.info("SSE端点连接成功（超时但连接正常）")
                        response.close()
                        return True

            except Exception as e:
                logger.warning(f"读取SSE数据时出现异常，但连接可能正常: {e}")
                response.close()
                return True  # 连接建立成功，即使读取数据有问题

            response.close()
            return True

        except requests.exceptions.Timeout:
            logger.error(f"SSE端点连接超时: {url}")
            return False
        except requests.exceptions.ConnectionError as e:
            logger.error(f"SSE端点连接失败: {e}")
            return False
        except Exception as e:
            logger.error(f"验证SSE端点时发生未知错误: {e}")
            return False

    async def _call_sse_tool(self, server_id: str, url: str, tool_name: str, params: Dict) -> Dict:
        """通过SSE传输调用MCP工具

        Args:
            server_id: 服务器ID
            url: SSE端点URL
            tool_name: 工具名称
            params: 工具参数

        Returns:
            Dict: 工具调用结果
        """
        try:
            logger.info(f"通过SSE调用工具 {tool_name}，服务器: {server_id}, URL: {url}")

            # MCP客户端已在文件顶部导入

            # 创建SSE客户端
            async with sse_client(url) as (read, write):
                # 创建MCP客户端会话
                async with ClientSession(read, write) as session:
                    # 初始化会话
                    await session.initialize()

                    logger.info(f"SSE会话已初始化，准备调用工具 {tool_name}")

                    # 调用工具
                    result = await session.call_tool(tool_name, arguments=params)

                    logger.info(f"SSE工具调用成功: {tool_name}")

                    # 将结果转换为可JSON序列化的格式
                    return self._convert_to_serializable(result)

        except Exception as e:
            logger.error(f"SSE工具调用失败: {server_id}/{tool_name}, 错误: {e}")

            logger.error(f"详细错误信息: {traceback.format_exc()}")
            return {
                "error": str(e),
                "error_type": type(e).__name__,
                "details": traceback.format_exc(),
                "is_error": True
            }

    async def _call_streamable_http_tool(self, server_id: str, url: str, tool_name: str, params: Dict) -> Dict:
        """通过StreamableHTTP传输调用MCP工具

        Args:
            server_id: 服务器ID
            url: StreamableHTTP端点URL
            tool_name: 工具名称
            params: 工具参数

        Returns:
            Dict: 工具调用结果
        """
        try:
            logger.info(f"通过StreamableHTTP调用工具 {tool_name}，服务器: {server_id}, URL: {url}")

            # 创建StreamableHTTP客户端
            async with streamablehttp_client(url) as (read, write, _):
                # 创建MCP客户端会话
                async with ClientSession(read, write) as session:
                    # 初始化会话
                    await session.initialize()

                    logger.info(f"StreamableHTTP会话已初始化，准备调用工具 {tool_name}")

                    # 调用工具
                    result = await session.call_tool(tool_name, arguments=params)

                    logger.info(f"StreamableHTTP工具调用成功: {tool_name}")

                    # 将结果转换为可JSON序列化的格式
                    return self._convert_to_serializable(result)

        except Exception as e:
            logger.error(f"StreamableHTTP工具调用失败: {server_id}/{tool_name}, 错误: {e}")

            logger.error(f"详细错误信息: {traceback.format_exc()}")
            return {
                "error": str(e),
                "error_type": type(e).__name__,
                "details": traceback.format_exc(),
                "is_error": True
            }

    def _verify_server_running(self, server_id: str, timeout: int = 10) -> Optional[List[Dict]]:
        """验证服务器是否正常工作，通过尝试获取工具列表

        Args:
            server_id: 服务器ID
            timeout: 超时时间（秒）

        Returns:
            List[Dict]: 工具列表，如果获取失败则返回None
        """
        # 创建一个Future对象，用于异步获取工具列表
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            # 创建一个任务，设置超时
            future = asyncio.ensure_future(self._fetch_tools_from_server(server_id), loop=loop)

            # 运行任务，设置超时
            try:
                tools = loop.run_until_complete(asyncio.wait_for(future, timeout=timeout))

                # 如果工具列表为空，也视为失败
                if not tools:
                    logger.warning(f"服务器 {server_id} 返回了空的工具列表")
                    return None

                return tools
            except asyncio.TimeoutError:
                logger.error(f"获取服务器 {server_id} 工具列表超时（{timeout}秒）")
                return None
            except Exception as e:
                logger.error(f"获取服务器 {server_id} 工具列表失败: {e}")
                return None
        finally:
            # 关闭事件循环
            loop.close()

    def stop_all_servers(self) -> None:
        """停止所有运行中的MCP服务器进程（不更改配置）"""
        logger.info("正在停止所有MCP服务器进程...")

        for server_id in list(self.running_servers.keys()):
            result = self.stop_server(server_id)
            if result.get("status") == "error":
                logger.error(f"停止服务器 {server_id} 失败: {result.get('message')}")

    def list_servers(self) -> List[Dict]:
        """列出所有MCP服务器

        Returns:
            List[Dict]: 服务器信息列表
        """
        # 确保配置已加载
        if not self.servers_config or not self.servers_config.get('mcpServers'):
            try:
                logger.info("服务器列表为空，尝试重新加载配置")
                self.load_config()
            except Exception as e:
                logger.error(f"重新加载配置失败: {e}")

        server_list = []
        logger.info(f"准备返回服务器列表，配置中的服务器数量: {len(self.servers_config.get('mcpServers', {}))}")

        for server_id, config in self.servers_config.get('mcpServers', {}).items():
            # 判断服务器是否启用：从配置文件中读取，内部服务器始终为启用状态
            is_enabled = config.get('enabled', False) or config.get('internal', False)

            # 判断服务器是否正在运行：检查运行中的进程列表
            # 内部服务器总是被视为运行中
            is_running = server_id in self.running_servers or config.get('internal', False)

            server_info = {
                "id": server_id,
                "command": config.get('command'),
                "args": config.get('args', []),
                "description": config.get('description', ''),
                "internal": config.get('internal', False),
                "comm_type": config.get('comm_type', 'stdio'),
                "url": config.get('url'),
                "api_spec_type": config.get('api_spec_type', 'mcp'),  # API规范类型
                "enabled": is_enabled,  # 配置状态：是否启用
                "running": is_running,  # 运行状态：是否正在运行
                "env": config.get('env', {}),  # 添加环境变量
                "status": "running" if is_enabled else "stopped"  # 保持状态字段名称不变，前端会显示为"已启用"/"已禁用"
            }
            server_list.append(server_info)
            logger.debug(f"添加服务器到列表: {server_id}, 状态: {server_info['status']}")

        logger.info(f"返回服务器列表，共 {len(server_list)} 个服务器")
        return server_list

    def add_server(self, server_id: str, config: Dict) -> Dict:
        """添加新的MCP服务器配置

        Args:
            server_id: 服务器ID
            config: 服务器配置

        Returns:
            Dict: 包含操作结果的字典
        """
        if not self.servers_config:
            self.load_config()

        if server_id in self.servers_config.get('mcpServers', {}):
            logger.warning(f"服务器 {server_id} 已存在，将更新配置")

        # 更新配置
        if 'mcpServers' not in self.servers_config:
            self.servers_config['mcpServers'] = {}

        self.servers_config['mcpServers'][server_id] = config
        self._save_config()

        logger.info(f"服务器 {server_id} 配置已添加")

        # 如果服务器标记为启用，则自动启动它
        if config.get('enabled', False) and not config.get('internal', False):
            logger.info(f"新添加的服务器 {server_id} 标记为启用，正在启动...")
            self.start_server(server_id)
        else:
            # 即使没有启动，也要刷新工具缓存（可能是内部服务器或配置更新）
            self.refresh_tools(server_id)

        return {"status": "success", "server_id": server_id}

    def update_server(self, server_id: str, config: Dict) -> Dict:
        """更新MCP服务器配置

        Args:
            server_id: 服务器ID
            config: 新的服务器配置

        Returns:
            Dict: 包含操作结果的字典
        """
        if not self.servers_config:
            self.load_config()

        if server_id not in self.servers_config.get('mcpServers', {}):
            logger.error(f"服务器 {server_id} 不存在")
            return {"status": "error", "message": f"服务器 {server_id} 不存在"}

        # 检查服务器是否在运行
        if server_id in self.running_servers:
            # 停止服务器
            self.stop_server(server_id)

        # 更新配置
        self.servers_config['mcpServers'][server_id] = config
        self._save_config()

        logger.info(f"服务器 {server_id} 配置已更新")

        # 如果服务器标记为启用，则自动启动它
        if config.get('enabled', False) and not config.get('internal', False):
            logger.info(f"服务器 {server_id} 标记为启用，正在启动...")
            self.start_server(server_id)
        else:
            # 即使没有启动，也要刷新工具缓存（可能是内部服务器或配置更新）
            self.refresh_tools(server_id)

        return {"status": "success", "server_id": server_id}

    def delete_server(self, server_id: str) -> Dict:
        """删除MCP服务器配置

        Args:
            server_id: 服务器ID

        Returns:
            Dict: 包含操作结果的字典
        """
        if not self.servers_config:
            self.load_config()

        if server_id not in self.servers_config.get('mcpServers', {}):
            logger.error(f"服务器 {server_id} 不存在")
            return {"status": "error", "message": f"服务器 {server_id} 不存在"}

        # 检查服务器是否是内部服务器
        is_internal = self.servers_config['mcpServers'][server_id].get('internal', False)
        if is_internal:
            logger.error(f"内部服务器 {server_id} 不能被删除")
            return {"status": "error", "message": f"内部服务器 {server_id} 不能被删除"}

        # 检查服务器是否在运行
        if server_id in self.running_servers:
            # 停止服务器
            self.stop_server(server_id)

        # 删除配置
        del self.servers_config['mcpServers'][server_id]
        self._save_config()

        # 清除工具缓存
        tool_schema_cache.remove_tools(server_id)

        logger.info(f"服务器 {server_id} 配置已删除，并清除了工具缓存")
        return {"status": "success", "server_id": server_id}

    async def _fetch_tools_from_server(self, server_id: str) -> List[Dict]:
        """从服务器获取工具列表（不使用缓存）

        Args:
            server_id: 服务器ID

        Returns:
            List[Dict]: 工具信息列表
        """
        try:
            # 确保配置已加载
            if not self.servers_config:
                self.load_config()

            # 获取服务器配置
            server_config = self.servers_config.get('mcpServers', {}).get(server_id)
            if not server_config:
                raise ValueError(f"服务器 {server_id} 不存在")

            # 对于内部服务器，使用特殊处理
            if server_config.get('internal', False):
                # 内部服务器直接使用预定义的工具列表
                if server_id == 'variables-server':
                    from app.mcp_servers.variables_server import get_tools
                    tools = get_tools()
                    return tools
                elif server_id == 'knowledge-base':
                    from app.mcp_servers.knowledge_base_server import get_tools
                    tools = get_tools()
                    return tools
                elif server_id == 'planner-server':
                    from app.mcp_servers.planner_server import get_tools_list
                    tools = get_tools_list()
                    return tools
                elif server_id == 'skill-server':
                    from app.mcp_servers.skill_server import get_tools as get_skill_tools
                    tools = get_skill_tools()
                    return tools
                elif server_id == 'subagent-server':
                    from app.mcp_servers.subagent_server import get_tools as get_subagent_tools
                    tools = get_subagent_tools()
                    return tools
                else:
                    raise NotImplementedError(f"不支持的内部服务器: {server_id}")

            # 检查通信方式
            comm_type = server_config.get('comm_type', 'stdio')

            # 对于HTTP/SSE/StreamableHTTP类型的MCP服务器，使用HTTP请求获取工具列表
            if comm_type in ['http', 'sse', 'streamable_http']:
                url = server_config.get('url')
                if not url:
                    logger.error(f"HTTP/SSE/StreamableHTTP服务器 {server_id} 未提供URL")
                    return []

                try:
                    # 检查端点类型（完全依赖配置的 comm_type，不进行 URL 推断）
                    is_sse_endpoint = comm_type == 'sse'
                    is_streamable_http = comm_type == 'streamable_http'

                    if is_streamable_http:
                        # 对于StreamableHTTP端点，使用MCP客户端连接获取工具列表
                        logger.info(f"StreamableHTTP端点，通过StreamableHTTP连接获取工具列表")
                        try:
                            return await self._fetch_tools_via_streamable_http(url)
                        except Exception as e:
                            logger.error(f"通过StreamableHTTP获取工具列表失败: {e}")
                            return []
                    elif is_sse_endpoint:
                        # 对于SSE端点，直接通过SSE连接获取工具列表
                        logger.info(f"SSE端点，通过SSE连接获取工具列表")
                        try:
                            return await self._fetch_tools_via_sse(url)
                        except Exception as e:
                            logger.error(f"通过SSE获取工具列表失败: {e}")
                            return []

                    # 检查配置中是否指定了 API 规范类型
                    api_spec_type = server_config.get('api_spec_type', 'mcp')  # 默认为 MCP 格式

                    # 尝试从HTTP服务器获取工具列表
                    logger.info(f"从HTTP服务器 {server_id} 获取工具列表: {url} (API规范类型: {api_spec_type})")
                    response = requests.get(url, timeout=10)

                    if response.status_code != 200:
                        logger.error(f"HTTP服务器 {server_id} 返回错误状态码: {response.status_code}")
                        return []

                    # 解析响应内容
                    content = response.json()

                    # 根据配置的 API 规范类型进行转换
                    if api_spec_type == 'openapi':
                        logger.info(f"配置指定为OpenAPI规范，正在转换为MCP工具列表")
                        tools = self._convert_openapi_to_tools(content)
                    else:
                        # 默认假设是标准MCP工具列表
                        tools = content if isinstance(content, list) else []

                        # 如果不是列表，可能是包装在某个属性中
                        if not tools and isinstance(content, dict):
                            if 'tools' in content:
                                tools = content['tools']
                            elif 'paths' in content:
                                # 可能是OpenAPI规范但没有正确检测到
                                logger.info(f"检测到可能的OpenAPI规范，尝试转换为MCP工具列表")
                                tools = self._convert_openapi_to_tools(content)

                    # 简单验证工具列表格式
                    if not isinstance(tools, list):
                        logger.error(f"HTTP服务器 {server_id} 返回的工具列表格式不正确")
                        return []

                    logger.info(f"成功从HTTP服务器 {server_id} 获取工具列表，共 {len(tools)} 个工具")
                    return tools
                except Exception as e:
                    logger.error(f"从HTTP服务器 {server_id} 获取工具列表失败: {e}")
        
                    logger.error(f"详细错误信息: {traceback.format_exc()}")
                    return []

            # 对于有活跃会话的服务器，通过统一接口获取工具列表
            if server_id in self._sessions:
                loop = self._get_persistent_loop()
                tools_result = self._sessions[server_id].list_tools(loop, timeout=30)
                tools = self._convert_to_serializable(tools_result) if tools_result else []
                return tools
            
            # 没有会话时，创建临时连接获取工具列表
            command = server_config.get('command')
            args = server_config.get('args', [])
            env = server_config.get('env', {})

            server_params = StdioServerParameters(
                command=command,
                args=args,
                env=env
            )

            async with stdio_client(server_params) as (read_stream, write_stream):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    tools_result = await session.list_tools()
                    tools = self._convert_to_serializable(tools_result)
                    logger.debug(f"STDIO获取工具结果: {type(tools)} - {tools}")
                    return tools

        except Exception as e:
            logger.error(f"获取服务器 {server_id} 的工具列表失败: {e}")

            logger.error(f"详细错误信息: {traceback.format_exc()}")
            return []

    async def _fetch_tools_via_sse(self, sse_url: str) -> List[Dict]:
        """通过SSE连接获取工具列表

        Args:
            sse_url: SSE端点URL

        Returns:
            List[Dict]: 工具列表
        """
        try:
            # MCP客户端已在文件顶部导入

            logger.info(f"建立SSE连接到: {sse_url}")

            # 使用MCP的SSE客户端连接
            async with sse_client(sse_url) as (read_stream, write_stream):
                # 创建客户端会话
                async with ClientSession(read_stream, write_stream) as session:
                    # 初始化客户端
                    await session.initialize()

                    # 发送list_tools请求
                    tools_result = await session.list_tools()

                    # 将结果转换为可JSON序列化的格式
                    tools = self._convert_to_serializable(tools_result)

                    logger.debug(f"SSE获取工具结果: {type(tools)} - {tools}")
                    return tools

        except ImportError as e:
            logger.error(f"MCP SSE客户端不可用: {e}")
            return []
        except Exception as e:
            logger.error(f"SSE连接获取工具列表失败: {e}")

            logger.error(f"详细错误信息: {traceback.format_exc()}")
            return []

    async def _fetch_tools_via_streamable_http(self, url: str) -> List[Dict]:
        """通过StreamableHTTP连接获取工具列表

        Args:
            url: StreamableHTTP端点URL

        Returns:
            List[Dict]: 工具列表
        """
        try:
            logger.info(f"建立StreamableHTTP连接到: {url}")

            # 使用MCP的StreamableHTTP客户端连接
            async with streamablehttp_client(url) as (read_stream, write_stream, _):
                # 创建客户端会话
                async with ClientSession(read_stream, write_stream) as session:
                    # 初始化客户端
                    await session.initialize()

                    # 发送list_tools请求
                    tools_result = await session.list_tools()

                    # 将结果转换为可JSON序列化的格式
                    tools = self._convert_to_serializable(tools_result)

                    logger.debug(f"StreamableHTTP获取工具结果: {type(tools)} - {tools}")
                    return tools

        except ImportError as e:
            logger.error(f"MCP StreamableHTTP客户端不可用: {e}")
            return []
        except Exception as e:
            logger.error(f"StreamableHTTP连接获取工具列表失败: {e}")

            logger.error(f"详细错误信息: {traceback.format_exc()}")
            return []





    def _convert_openapi_to_tools(self, openapi_spec: Dict) -> List[Dict]:
        """将OpenAPI规范转换为MCP工具列表

        Args:
            openapi_spec: OpenAPI规范对象

        Returns:
            List[Dict]: MCP工具列表
        """
        tools = []

        # 检查必须的OpenAPI字段
        if not isinstance(openapi_spec, dict) or 'paths' not in openapi_spec:
            logger.error("无效的OpenAPI规范: 缺少paths字段")
            return []

        # 提取OpenAPI基本信息
        info = openapi_spec.get('info', {})
        api_title = info.get('title', '未命名API')

        # 处理每个路径
        for path, path_item in openapi_spec.get('paths', {}).items():
            for method, operation in path_item.items():
                if method.lower() not in ['get', 'post', 'put', 'delete', 'patch']:
                    continue

                # 提取操作信息
                operation_id = operation.get('operationId', f"{method}_{path}".replace('/', '_'))
                summary = operation.get('summary', '')
                description = operation.get('description', summary)

                # 创建输入模式
                input_schema = {
                    "type": "object",
                    "properties": {},
                    "required": []
                }

                # 处理参数
                for param in operation.get('parameters', []):
                    param_name = param.get('name', '')
                    param_required = param.get('required', False)
                    param_schema = param.get('schema', {"type": "string"})
                    param_description = param.get('description', '')

                    if param_name:
                        input_schema["properties"][param_name] = {
                            **param_schema,
                            "description": param_description
                        }
                        if param_required:
                            input_schema["required"].append(param_name)

                # 处理请求体
                request_body = operation.get('requestBody', {})
                if request_body:
                    content = request_body.get('content', {})
                    json_content = content.get('application/json', {})
                    if json_content:
                        body_schema = json_content.get('schema', {})
                        if body_schema.get('type') == 'object' and 'properties' in body_schema:
                            # 将请求体参数添加到输入模式
                            for prop_name, prop_schema in body_schema['properties'].items():
                                input_schema["properties"][prop_name] = prop_schema

                            # 添加必填属性
                            for required_prop in body_schema.get('required', []):
                                if required_prop not in input_schema["required"]:
                                    input_schema["required"].append(required_prop)

                # 创建MCP工具
                tool = {
                    "name": operation_id,
                    "description": description or f"{method.upper()} {path}",
                    "inputSchema": input_schema,
                    "annotations": {
                        "title": summary or operation_id,
                        "readOnlyHint": method.lower() == 'get',
                        "destructiveHint": method.lower() in ['delete', 'put'],
                        "idempotentHint": method.lower() in ['put', 'get'],
                        "openWorldHint": True
                    },
                    "meta": {
                        "path": path,
                        "method": method.upper(),
                        "api": api_title
                    }
                }

                tools.append(tool)

        logger.info(f"从OpenAPI规范转换了 {len(tools)} 个MCP工具")
        return tools

    def _is_server_enabled(self, server_id: str) -> bool:
        """检查服务器是否启用

        Args:
            server_id: 服务器ID

        Returns:
            bool: 服务器是否启用
        """
        # 确保配置已加载
        if not self.servers_config:
            self.load_config()

        # 检查服务器是否存在
        server_config = self.servers_config.get('mcpServers', {}).get(server_id)
        if not server_config:
            return False

        # 判断服务器是否启用
        is_enabled = server_id in self.running_servers or server_config.get('internal', False)

        # 如果配置文件中明确标记为禁用，则覆盖运行状态
        if 'enabled' in server_config and not server_config['enabled'] and not server_config.get('internal', False):
            is_enabled = False

        return is_enabled

    def _get_async_executor(self):
        """获取或创建共享的线程池执行器"""
        if self._async_executor is None:
            self._async_executor = concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="mcp_async_")
        return self._async_executor

    def _run_async_safely(self, coro):
        """安全地运行异步协程，支持在已有事件循环中调用

        Args:
            coro: 要运行的协程

        Returns:
            协程的返回值
        """
        try:
            # 检测是否已经在事件循环中运行
            asyncio.get_running_loop()
            # 已经在事件循环中，使用线程池执行器在另一个线程中运行
            def run_with_context():
                return asyncio.run(coro)

            # 使用共享的线程池执行器，避免频繁创建销毁
            executor = self._get_async_executor()
            future = executor.submit(run_with_context)
            return future.result(timeout=60)  # 添加超时保护
        except RuntimeError:
            # 不在事件循环中，可以直接使用 asyncio.run()
            return asyncio.run(coro)

    def refresh_tools(self, server_id: str) -> List[Dict]:
        """刷新指定服务器的工具列表缓存

        Args:
            server_id: 服务器ID

        Returns:
            List[Dict]: 工具信息列表
        """
        logger.info(f"正在刷新服务器 {server_id} 的工具列表缓存")

        # 检查服务器是否启用
        if not self._is_server_enabled(server_id):
            logger.info(f"服务器 {server_id} 未启用，清空缓存")
            tool_schema_cache.remove_tools(server_id)
            return []

        try:
            # 使用统一会话接口获取工具列表
            if server_id in self._sessions:
                loop = self._get_persistent_loop()
                tools_result = self._sessions[server_id].list_tools(loop, timeout=30)
                tools = self._convert_to_serializable(tools_result) if tools_result else []
            else:
                # 其他类型使用通用方法
                tools = self._run_async_safely(self._fetch_tools_from_server(server_id))

            # 更新缓存（缓存设置时会自动记录工具数量）
            tool_schema_cache.set_tools(server_id, tools)
            return tools
        except Exception as e:
            logger.error(f"刷新服务器 {server_id} 的工具列表缓存失败: {e}")
            return []

    def get_tools(self, server_id: str) -> List[Dict]:
        """获取MCP服务器提供的工具列表，优先从缓存获取，缓存为空时自动刷新

        Args:
            server_id: 服务器ID

        Returns:
            List[Dict]: 工具信息列表，如果服务器未启用则返回空列表
        """
        # 检查服务器是否启用
        if not self._is_server_enabled(server_id):
            logger.info(f"服务器 {server_id} 未启用，不返回工具列表")
            return []

        # 优先从缓存获取
        if tool_schema_cache.has_tools(server_id):
            logger.debug(f"从缓存获取服务器 {server_id} 的工具列表")
            return tool_schema_cache.get_tools(server_id)

        # 缓存为空时自动刷新
        logger.info(f"服务器 {server_id} 的工具列表缓存为空，自动刷新")
        return self.refresh_tools(server_id)

    async def call_tool_async(self, server_id: str, tool_name: str, params: Dict) -> Dict:
        """异步调用MCP工具

        Args:
            server_id: 服务器ID
            tool_name: 工具名称
            params: 工具参数

        Returns:
            Dict: 工具调用结果
        """
        try:
            # 获取服务器配置
            server_config = self.servers_config.get('mcpServers', {}).get(server_id)
            if not server_config:
                raise ValueError(f"服务器 {server_id} 不存在")

            # 对于内部服务器，使用特殊处理
            if server_config.get('internal', False):
                # 内部服务器（例如variables-server）直接调用处理函数
                if server_id == 'variables-server':
                    from app.mcp_servers.variables_server import handle_request
                    request_data = {
                        "name": tool_name,
                        "input": params,
                        "id": str(uuid.uuid4())
                    }
                    return handle_request(request_data)
                elif server_id == 'knowledge-base':
                    from app.mcp_servers.knowledge_base_server import handle_request
                    request_data = {
                        "name": tool_name,
                        "input": params,
                        "id": str(uuid.uuid4())
                    }
                    return handle_request(request_data)
                elif server_id == 'planner-server':
                    from app.mcp_servers.planner_server import handle_request
                    request_data = {
                        "name": tool_name,
                        "input": params,
                        "id": str(uuid.uuid4())
                    }
                    return handle_request(request_data)
                elif server_id == 'skill-server':
                    from app.mcp_servers.skill_server import handle_request
                    request_data = {
                        "name": tool_name,
                        "input": params,
                        "id": str(uuid.uuid4())
                    }
                    return handle_request(request_data)
                elif server_id == 'subagent-server':
                    from app.mcp_servers.subagent_server import handle_request
                    # SubAgent 需要 caller_agent_id，从线程上下文获取
                    caller_agent_id = None
                    try:
                        from app.services.thread_context import g
                        if g.conversation_context is not None:
                            caller_agent_id = g.conversation_context.get('agent_id')
                    except Exception:
                        pass
                    request_data = {
                        "name": tool_name,
                        "input": params,
                        "id": str(uuid.uuid4()),
                        "caller_agent_id": caller_agent_id
                    }
                    return handle_request(request_data)
                else:
                    raise NotImplementedError(f"不支持的内部服务器: {server_id}")

            # 检查通信方式
            comm_type = server_config.get('comm_type', 'stdio')

            # 对于HTTP/SSE/StreamableHTTP类型的MCP服务器，使用HTTP请求调用工具
            if comm_type in ['http', 'sse', 'streamable_http']:
                url = server_config.get('url')
                if not url:
                    raise ValueError(f"HTTP/SSE/StreamableHTTP服务器 {server_id} 未提供URL")

                # 检查端点类型（完全依赖配置的 comm_type，不进行 URL 推断）
                is_sse_endpoint = comm_type == 'sse'
                is_streamable_http = comm_type == 'streamable_http'

                if is_streamable_http:
                    # 对于StreamableHTTP端点，使用MCP客户端通过StreamableHTTP传输调用工具
                    return await self._call_streamable_http_tool(server_id, url, tool_name, params)
                elif is_sse_endpoint:
                    # 对于SSE端点，使用MCP客户端通过SSE传输调用工具
                    return await self._call_sse_tool(server_id, url, tool_name, params)

                # 检查配置中是否指定了 API 规范类型
                api_spec_type = server_config.get('api_spec_type', 'mcp')

                if api_spec_type == 'openapi':
                    # 如果是OpenAPI规范URL，需要先获取工具元数据
                    # 从缓存中获取工具列表
                    tools = tool_schema_cache.get_tools(server_id)

                    # 如果缓存中没有，则重新获取
                    if not tools:
                        tools = await self._fetch_tools_from_server(server_id)

                    # 查找匹配的工具
                    tool_metadata = None
                    for tool in tools:
                        if tool.get('name') == tool_name:
                            tool_metadata = tool
                            break

                    if not tool_metadata:
                        raise ValueError(f"找不到工具 {tool_name} 的元数据")

                    # 从元数据中提取API路径和HTTP方法
                    meta = tool_metadata.get('meta', {})
                    path = meta.get('path')
                    method = meta.get('method', 'GET')

                    if not path:
                        raise ValueError(f"工具 {tool_name} 缺少API路径元数据")

                    # 构建完整的API URL
                    base_url = url.rsplit('/', 1)[0]  # 移除最后一部分(openapi.json)
                    api_url = f"{base_url}{path}"

                    # 根据参数构建请求
                    logger.info(f"调用OpenAPI工具 {tool_name}，方法: {method}, URL: {api_url}，参数: {params}")

                    # 根据HTTP方法发送请求
                    method = method.upper()
                    if method == 'GET':
                        response = requests.get(api_url, params=params, timeout=30)
                    elif method == 'POST':
                        response = requests.post(api_url, json=params, timeout=30)
                    elif method == 'PUT':
                        response = requests.put(api_url, json=params, timeout=30)
                    elif method == 'DELETE':
                        response = requests.delete(api_url, json=params, timeout=30)
                    elif method == 'PATCH':
                        response = requests.patch(api_url, json=params, timeout=30)
                    else:
                        raise ValueError(f"不支持的HTTP方法: {method}")

                    if response.status_code >= 400:
                        logger.error(f"OpenAPI调用返回错误状态码: {response.status_code}")
                        return {
                            "error": f"API返回错误状态码: {response.status_code}",
                            "error_type": "HTTPError",
                            "is_error": True,
                            "details": response.text,
                            "status_code": response.status_code
                        }
                    else:
                        # 状态码200的响应应该被视为成功，即使响应内容可能包含错误信息
                        logger.info(f"OpenAPI调用返回状态码{response.status_code}，视为成功响应")

                    # 尝试解析JSON响应
                    try:
                        result = response.json()
                    except ValueError:
                        # 如果不是JSON，直接返回文本内容
                        # 注意：这里不再将文本包装在字典中，避免误解为错误
                        return response.text

                    return result
                else:
                    # 创建标准MCP工具调用请求数据
                    request_data = {
                        "name": tool_name,
                        "input": params,
                        "id": str(uuid.uuid4())
                    }

                    try:
                        # 尝试调用HTTP服务器的工具
                        logger.info(f"向HTTP服务器 {server_id} 发送工具调用请求: {tool_name}")
                        response = requests.post(url, json=request_data, timeout=30)

                        if response.status_code != 200:
                            logger.error(f"HTTP服务器 {server_id} 返回错误状态码: {response.status_code}")
                            return {
                                "error": f"服务器返回错误状态码: {response.status_code}",
                                "error_type": "HTTPError",
                                "is_error": True,
                                "status_code": response.status_code
                            }

                        # 尝试解析响应内容
                        try:
                            result = response.json()
                        except ValueError:
                            # 如果不是JSON，直接返回文本内容
                            # 注意：这里不再将文本包装在字典中，避免误解为错误
                            return response.text

                        return result
                    except Exception as e:
                        logger.error(f"调用HTTP服务器 {server_id} 的工具 {tool_name} 失败: {e}")
            
                        logger.error(f"详细错误信息: {traceback.format_exc()}")
                        return {
                            "error": str(e),
                            "error_type": type(e).__name__,
                            "details": traceback.format_exc(),
                            "is_error": True
                        }

            # 对于有活跃会话的服务器，通过统一接口调用
            if server_id in self._sessions:
                loop = self._get_persistent_loop()
                try:
                    result = self._sessions[server_id].call_tool(loop, tool_name, params, timeout=120)
                    return self._convert_to_serializable(result)
                except ConnectionError as e:
                    # 会话已中止，尝试重新连接
                    logger.warning(f"会话已中止，尝试重新连接: {server_id}, {e}")
                    reconnect_result = self._reconnect_session(server_id)
                    if reconnect_result.get("status") == "running":
                        # 重新调用工具
                        result = self._sessions[server_id].call_tool(loop, tool_name, params, timeout=120)
                        return self._convert_to_serializable(result)
                    else:
                        return {"error": f"重新连接会话失败: {reconnect_result.get('message')}", "is_error": True}
            else:
                # 服务器未启动，返回错误
                logger.error(f"服务器 {server_id} 未启动，无法调用工具")
                return {"error": f"服务器 {server_id} 未启动，请先启动服务器", "is_error": True}

        except Exception as e:
            logger.error(f"调用工具 {tool_name} 失败: {e}")

            logger.error(f"详细错误堆栈: {traceback.format_exc()}")
            return {"error": str(e), "error_type": type(e).__name__, "details": traceback.format_exc()}

    def call_tool(self, server_id: str, tool_name: str, params: Dict) -> Dict:
        """调用MCP工具（同步包装异步方法）

        Args:
            server_id: 服务器ID
            tool_name: 工具名称
            params: 工具参数

        Returns:
            Dict: 工具调用结果，如果服务器未启用则返回错误
        """
        # 检查服务器是否启用
        if not self._is_server_enabled(server_id):
            logger.warning(f"服务器 {server_id} 未启用，无法调用工具")
            return {"error": f"服务器 {server_id} 未启用，无法调用工具", "is_error": True}

        # 确保params是字典类型
        if isinstance(params, str):
            try:
                # 尝试将JSON字符串转换为字典
                params = json.loads(params)
                logger.info(f"已将JSON字符串参数转换为字典: {params}")
            except json.JSONDecodeError as e:
                logger.error(f"无法将参数转换为字典: {e}")
                return {"error": f"参数格式错误: {e}", "error_type": "JSONDecodeError", "details": f"无法解析JSON字符串: {params}", "is_error": True}

        # 使用统一会话接口调用工具
        if server_id in self._sessions:
            try:
                loop = self._get_persistent_loop()
                result = self._sessions[server_id].call_tool(loop, tool_name, params, timeout=120)
                return self._convert_to_serializable(result)
            except ConnectionError as e:
                # 会话已中止，尝试重新连接
                logger.warning(f"会话已中止，尝试重新连接: {server_id}, {e}")
                reconnect_result = self._reconnect_session(server_id)
                if reconnect_result.get("status") == "running":
                    # 重新调用工具
                    loop = self._get_persistent_loop()
                    result = self._sessions[server_id].call_tool(loop, tool_name, params, timeout=120)
                    return self._convert_to_serializable(result)
                else:
                    return {"error": f"重新连接会话失败: {reconnect_result.get('message')}", "is_error": True}
            except Exception as e:
                logger.error(f"调用工具失败: {server_id}/{tool_name}, {e}")
                return {"error": str(e), "error_type": type(e).__name__, "is_error": True}
        else:
            # 其他类型使用通用方法
            return self._run_async_safely(self.call_tool_async(server_id, tool_name, params))

    # Legacy Flask endpoints removed — 路由已迁移到 app/api/routes/mcp_servers.py 和 app/api/routes/tool_schema_cache.py
    # def _register_endpoints(self) -> None: ...
    # def register_routes(self, app) -> None: ...

    def initialize_servers(self) -> None:
        """初始化MCP服务器（启动已启用的服务器并缓存工具列表）
        
        替代原来的 register_routes() 中的初始化逻辑，不再依赖 Flask app context。
        """
        try:
            logger.info("应用启动时加载MCP服务器配置")

            # 停止所有可能正在运行的服务
            self.stop_all_servers()

            # 清空工具模式缓存
            tool_schema_cache.clear()
            logger.info("已清空工具模式缓存，准备重新加载")

            # 启动所有在配置文件中标记为启用的服务器
            for server_id, config in self.servers_config.get('mcpServers', {}).items():
                # 对于非内部服务器，检查enabled字段
                if not config.get('internal', False):
                    if config.get('enabled', False):
                        logger.info(f"尝试启动标记为启用的MCP服务器: {server_id}")
                        result = self.start_server(server_id)
                        if result.get("status") == "error":
                            logger.error(f"启动服务器 {server_id} 失败: {result.get('message')}")
                            logger.info(f"服务器 {server_id} 启动失败，但保持启用状态不变")
                        else:
                            logger.info(f"服务器 {server_id} 启动成功，获取到 {result.get('tools_count', 0)} 个工具")
                    else:
                        logger.info(f"服务器 {server_id} 未标记为启用，跳过启动")

            # 保存配置文件
            self._save_config()

            # 对于内部服务器，也需要获取工具列表并缓存
            for server_id, config in self.servers_config.get('mcpServers', {}).items():
                if config.get('internal', False):
                    try:
                        logger.info(f"正在刷新并缓存内部服务器 {server_id} 的工具列表")
                        self.refresh_tools(server_id)
                    except Exception as tools_error:
                        logger.error(f"刷新内部服务器 {server_id} 的工具列表失败: {tools_error}")

            # 输出缓存状态
            cached_servers = tool_schema_cache.get_all_server_ids()
            logger.info(f"工具模式缓存初始化完成，共缓存了 {len(cached_servers)} 个服务器的工具模式: {cached_servers}")
        except Exception as e:
            logger.error(f"初始化MCP服务器失败: {e}")
            traceback.print_exc()

# 创建MCP服务器管理器实例
mcp_manager = MCPServerManager()