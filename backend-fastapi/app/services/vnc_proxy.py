"""
VNC 代理管理器

使用 websockify Python API 实现 WebSocket 到 VNC TCP 的代理
单端口 + Token 动态路由架构
"""
import secrets
import time
import socket
import threading
import logging
from typing import Optional, Dict, Tuple
from dataclasses import dataclass, field
from socketserver import ThreadingMixIn
from http.server import HTTPServer

from websockify.websocketproxy import ProxyRequestHandler
from websockify.token_plugins import BasePlugin

logger = logging.getLogger(__name__)

# 默认 WebSocket 代理端口
DEFAULT_WS_PORT = 6080


@dataclass
class VNCSession:
    """VNC 会话信息"""
    token: str
    target_host: str
    target_port: int
    created_at: float = field(default_factory=time.time)
    expires_at: float = 0

    def __post_init__(self):
        if self.expires_at == 0:
            self.expires_at = self.created_at + 3600
    
    @property
    def target(self) -> str:
        return f"{self.target_host}:{self.target_port}"


class MemoryTokenPlugin(BasePlugin):
    """
    内存 Token 插件
    
    实现 websockify token plugin 接口，用于动态路由
    """
    
    def __init__(self, src=None):
        super().__init__(src)
        self.tokens: Dict[str, Tuple[str, int]] = {}
    
    def lookup(self, token: str) -> Optional[Tuple[str, int]]:
        """查找 token 对应的目标地址"""
        return self.tokens.get(token)
    
    def add(self, token: str, host: str, port: int):
        """添加 token 映射"""
        self.tokens[token] = (host, port)
    
    def remove(self, token: str):
        """移除 token 映射"""
        self.tokens.pop(token, None)
    
    def clear(self):
        """清空所有映射"""
        self.tokens.clear()


class TokenProxyServer(ThreadingMixIn, HTTPServer):
    """
    基于 HTTPServer 的 WebSocket 代理服务器
    
    使用 ThreadingMixIn 支持多线程处理请求
    使用 token plugin 实现动态路由
    """
    
    def __init__(self, listen_host: str, listen_port: int, token_plugin: MemoryTokenPlugin):
        self.token_plugin = token_plugin
        self.target_host = None
        self.target_port = None
        self.wrap_cmd = None
        self.wrap_mode = None
        self.unix_target = None
        self.unix_listen = None
        self.ssl_target = False
        self.auth_plugin = None
        self.heartbeat = 30
        self.daemon = False
        self.only_upgrade = True
        self.verbose = False
        self.record = None
        self.run_once = False
        self.handler_id = 0
        
        super().__init__((listen_host, listen_port), ProxyRequestHandler)
    
    def process_request(self, request, client_address):
        """处理请求，增加计数器"""
        self.handler_id += 1
        super().process_request(request, client_address)


class VNCProxyManager:
    """
    VNC 代理管理器
    
    使用单一 websockify 服务器 + token 动态路由
    所有 VNC 连接通过同一个端口，根据 token 路由到不同目标
    """
    
    def __init__(self, ws_port: int = DEFAULT_WS_PORT, token_ttl: int = 3600):
        self.ws_port = ws_port
        self.token_ttl = token_ttl
        self.sessions: Dict[str, VNCSession] = {}
        self.token_plugin = MemoryTokenPlugin()
        self.server: Optional[TokenProxyServer] = None
        self.server_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
    
    def _ensure_server_running(self):
        """确保 websockify 服务器正在运行"""
        with self._lock:
            if self.server_thread and self.server_thread.is_alive():
                return
            
            try:
                self.server = TokenProxyServer(
                    listen_host='0.0.0.0',
                    listen_port=self.ws_port,
                    token_plugin=self.token_plugin,
                )
            except Exception as e:
                logger.error(f"Failed to create TokenProxyServer: {e}")
                raise RuntimeError(f"Failed to create proxy server: {e}")
            
            def run_server():
                try:
                    logger.info(f"Starting VNC proxy server on port {self.ws_port}")
                    self.server.serve_forever()
                except Exception as e:
                    logger.error(f"TokenProxyServer error: {e}")
            
            self.server_thread = threading.Thread(target=run_server, daemon=True)
            self.server_thread.start()
            time.sleep(0.3)
            logger.info(f"VNC proxy server started on ws://0.0.0.0:{self.ws_port}")
    
    def start(self, target: str) -> dict:
        """创建新的 VNC 会话"""
        self._ensure_server_running()
        
        target_host, target_port_str = target.rsplit(':', 1)
        target_port = int(target_port_str)
        
        token = secrets.token_urlsafe(32)
        
        session = VNCSession(
            token=token,
            target_host=target_host,
            target_port=target_port,
            expires_at=time.time() + self.token_ttl
        )
        
        self.sessions[token] = session
        self.token_plugin.add(token, target_host, target_port)
        
        self._cleanup_expired()
        
        logger.info(f"Created VNC session: token={token[:8]}... -> {target}")
        
        return {
            "token": token,
            "ws_port": self.ws_port,
            "expires_in": self.token_ttl
        }
    
    def validate_token(self, token: str) -> Optional[dict]:
        """验证 Token 并返回会话信息"""
        session = self.sessions.get(token)
        if not session:
            return None
        
        if time.time() > session.expires_at:
            self.stop(token)
            return None
        
        return {
            "target": session.target,
            "ws_port": self.ws_port
        }
    
    def stop(self, token: str) -> bool:
        """停止指定会话"""
        session = self.sessions.pop(token, None)
        if session:
            self.token_plugin.remove(token)
            logger.info(f"Removed VNC session: token={token[:8]}...")
            return True
        return False
    
    def stop_all(self):
        """停止所有会话"""
        for token in list(self.sessions.keys()):
            self.stop(token)
        
        if self.server:
            try:
                self.server.shutdown()
                # 等待服务器线程结束
                if self.server_thread:
                    self.server_thread.join(timeout=2.0)
                # 关闭 socket 释放端口
                self.server.server_close()
                logger.info("VNC proxy server stopped")
            except Exception as e:
                logger.warning(f"Error shutting down server: {e}")
            finally:
                self.server = None
                self.server_thread = None
    
    def get_active_count(self) -> int:
        """获取活跃会话数量"""
        self._cleanup_expired()
        return len(self.sessions)
    
    def _cleanup_expired(self):
        """清理过期会话"""
        now = time.time()
        expired = [t for t, s in self.sessions.items() if now > s.expires_at]
        for token in expired:
            self.stop(token)


vnc_proxy = VNCProxyManager()
