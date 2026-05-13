# VNC WebSocket 代理方案

## 概述

使用 Python `websockify` 库实现**单端口 + Token 动态路由**的 VNC 代理架构。所有 VNC 连接通过同一个固定端口（默认 6080），根据 URL 中的 token 参数动态路由到不同的 VNC 目标。

## 架构

```
┌─────────────────┐                      ┌─────────────────┐                  ┌─────────────────┐
│   前端 Browser  │                      │   后端 Python   │                  │   VNC Servers   │
│                 │  POST /vnc/start     │                 │                  │                 │
│  VNC Window 1   │ ────────────────────►│  生成 token1    │                  │  192.0.2.22   │
│  VNC Window 2   │ ────────────────────►│  生成 token2    │                  │  192.0.2.23   │
│  VNC Window 3   │ ────────────────────►│  生成 token3    │                  │  10.0.0.100     │
│                 │                      │                 │                  │                 │
│   (react-vnc)   │  ws://host:6080/?token=xxx            │                  │                 │
│                 │ ◄─────────────────────────────────────►│ ◄──────────────► │                 │
│                 │     单端口 + Token 路由                │  TCP 连接        │                 │
└─────────────────┘                      └─────────────────┘                  └─────────────────┘
```

## 单端口 Token 路由

- **单一固定端口**：所有 VNC 连接通过 6080 端口
- **Token 动态路由**：根据 `?token=xxx` 参数路由到对应 VNC 目标
- **内存 Token 插件**：使用自定义 `MemoryTokenPlugin` 管理 token 映射
- **无需端口映射**：Docker 部署只需映射一个端口

## 实现方案

### 1. VNC 代理管理器

**文件: `backend/app/services/vnc_proxy.py`**

```python
"""
VNC 代理管理器

使用 websockify Python API 实现 WebSocket 到 VNC TCP 的代理
单端口 + Token 动态路由架构
"""
import secrets
import time
import threading
import logging
from typing import Optional, Dict, Tuple
from dataclasses import dataclass, field
from socketserver import ThreadingMixIn
from http.server import HTTPServer

from websockify.websocketproxy import ProxyRequestHandler
from websockify.token_plugins import BasePlugin

logger = logging.getLogger(__name__)

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
    
    def a, token: str, host: str, port: int):
        """添加 token 映射"""
        self.tokens[token] = (host, port)
    
    def remove(self, token: str):
        """移除 token 映射"""
        self.tokens.pop(token, None)


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


class VNCProxyManager:
    """
    VNC 代理管理器
    
    使用单一 websockify 服务器 + token 动态路由
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
                r          
            self.server = TokenProxyServer(
                listen_host='0.0.0.0',
                listen_port=self.ws_port,
                token_plugin=self.token_plugin,
            )
            
            def run_server():
                logger.info(f"Starting VNC proxy server on port {self.ws_port}")
                self.server.serve_forever()
            
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
      logger.info(f"Created VNC session: token={token[:8]}... -> {target}")
        
        return {
            "token": token,
            "ws_port": self.ws_port,
            "expires_in": self.token_ttl
        }
    
    def stop(self, token: str) -> bool:
        """停止指定会话"""
        session = self.sessions.pop(token, None)
        if session:
            self.token_plugin.remove(token)
            logger.info(f"Removed VNC session: token={token[:8]}...")
            return True
        return False


vnc_proxy = VNCProxyManager()
```

### 2. API 路由

**文件: `backend/app/api/routes/vnc.py`**

```python
"""
VNC 代理 API 路由
"""
from flask import Blueprint, request, jsonify
from app.services.vnc_proxy import vnc_proxy
from app.models import MarketApp

vnc_bp = Blueprint('vnc_api', __name__)


@vnc_bp.route('/market/apps/next-rpa/vnc/start', methods=['POST'])
def start_vnc_session():
    """启动 VNC 代理会话"""
    data = request.json or {}
    target = data.get('target', '')
    
    try:
        result = vnc_proxy.start(target)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@vnc_bp.route('/market/apps/next-rpa/vnc/stop', methods=['POST'])
def stop_vnc_session():
    """停止指定的 VNC 代理会话"""
    token = request.args.get('token', '')
    success = vnc_proxy.stop(token)
    return jsonify({'success': success})


@vnc_bp.route('/market/apps/next-rpa/vnc/status', methods=['GET'])
def get_vnc_status():
    """获取 VNC 代理状态"""
    return jsonify({'active_sessions': vnc_proxy.get_active_count()})
```

## 前端使用

### VNC 代理服务

**文件: `frontend/src/services/marketService.ts`**

```typescript
export const vncProxyService = {
  async start(target: string): Promise<{ token: string; ws_port: number; expires_in: number }> {
    const response = await api.post('/market/apps/next-rpa/vnc/start', { target });
    return response.data;
  },

  async stop(token: string): Promise<void> {
    await api.post(`/market/apps/next-rpa/vnc/stop?token=${token}`);
  },

  async getStatus(): Promise<{ active_sessions: number }> {
    const response = await api.get('/market/apps/next-rpa/vnc/status');
    return response.data;
  },

  /**
   * 获取 WebSocket 代理 URL (单端口 + token 路由)
   * @param wsPort - websockify 监听端口
   * @param token - 会话 token，用于路由到正确的 VNC 目标
   */
  getProxyUrl(wsPort: number, token: string): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    return `${protocol}//${host}:${wsPort}/?token=${token}`;
  }
};
```

### 使用示例

```tsx
const [vncToken, setVncToken] = useState<string | null>(null);
const [vncWsPort, setVncWsPort] = useState<number | null>(null);

// 启动 VNC
const handleLaunchNextRPA = async (app) => {
  const vncUrl = app.connection?.localConfig?.vncUrl;
  let vncTarget = vncUrl.replace(/^wss?:\/\//, '');
  const { token, ws_port } = await vncProxyService.start(vncTarget);
  setVncToken(token);
  VncWsPort(ws_port);
};

// VNC 组件 - 注意 URL 包含 token 参数
{vncToken && vncWsPort && (
  <VncScreen
    url={vncProxyService.getProxyUrl(vncWsPort, vncToken)}
    scaleViewport
    rfbOptions={{
      credentials: { password: vncPassword }
    }}
  />
)}
```

## 连接流程

```
连接流程:

1. 用户启动 VNC 到 192.0.2.22:5901
   │
   ▼
2. POST /start { target: "192.0.2.22:5901" }
   │
   ▼
3. 后端生成 token，添加到 MemoryTokenPlugin
   │
   ▼
4. 返回 { token: "abc123", ws_port: 6080, expires_in: 3600 }
   │
   ▼
5. 前端连接 ws://hostname:6080/?token=abc123
   │
   ▼
6. websockify 根据 token 查找目标，转发到 192.0.2.22:5901
```

## 

| 特性 | 旧架构 (多端口) | 新架构 (单端口 + Token) |
|------|----------------|------------------------|
| 端口使用 | 每个 VNC 目标一个随机端口 | 固定端口 6080 |
| Docker 部署 | 需要映射端口范围 | 只需映射一个端口 |
| Nginx 代理 | 复杂，需要动态配置 | 简单，固定配置 |
| 连接 URL | `ws://host:49393` | `ws://host:6080/?token=xxx` |
| 服务器实例 | 每个目标一个 LibProxyServer | 单一 TokenProxyServer |

## Docker 部署

```yaml
# docker-compose.yml
services:
  backend:
    ports:
      - "8080:8080"   # Flask API
      - "6080:6080"   # VNC 代理 (单端口)
```

## Nginx 配置

```nginx
# VNC WebSocket 代理
locatinc/ {
    proxy_pass http://backend:6080/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;
}
```

## API 参考

| 方法 | 路径 | 说明 | 返回 |
|------|------|------|------|
| POST | `/api/market/apps/next-rpa/vnc/start` | 创建新会话 | `{token, ws_port, expires_in}` |
| POST | `/api/market/apps/next-rpa/vnc/stop?token=xxx` | 停止指定会话 | `{success}` |
| GET | `/api/market/apps/next-rpa/vnc/status` | 获取活跃会话数量 | `{active_sessions}` |

## 依赖

```bash
pip install websockify
```

## 测试

```bash
# 1. 创建会话
curl -X POST http://localhost:8080/api/market/apps/next-rpa/vnc/start \
  -H "Content-Type: application/json" \
  -d '{"target": "192.0.2.22:5901"}'
# 返回: {"token": "abc123...", "ws_port": 6080, "expires_in": 3600}

# 2. 前端连接
# ws://localhost:6080/?token=abc123...

# 3. 停止会话
curl -X POST "http://localhost:8080/api/market/apps/next-rpa/vnc/stop?token=abc123..."
```

## 文档版本

- **版本**: v3.0
- **日期**: 2025-12-29
- **变更**: 从多端口架构改为单端口 + Token 动态路由架构
