# MCP服务器工具调用重构计划

## 1. 现状问题分析

### 1.1 核心问题

当前实现中，**每次工具调用都会重新启动MCP服务器进程**，这是极其低效的：

```python
# 当前实现 (mcp_server_manager.py - call_tool_async)
async with stdio_client(server_params) as (read_stream, write_stream):
    async with ClientSession(read_stream, write_stream) as session:
        await session.initialize()  # 每次都初始化
        result = await session.call_tool(tool_name, arguments=params)
# 连接结束，进程退出
```

**问题**：
- `start_server()` 启动的进程存储在 `running_servers` 字典中
- 但 `call_tool_async()` 完全不使用这些进程，而是每次创建新连接
- 对于 `npx` 启动的服务器（如 filesystem），每次调用都要：
  1. 下载/验证 npm 包
  2. 启动 Node.js 进程
  3. 初始化 MCP 会话
  4. 执行工具调用
  5. 进程退出

### 1.2 日志证据

```
[INFO] 2025-12-11 15:49:15,410 - app.services.mcp_server_manager - 命令: npx -y @modelcontextprotocol/server-filesystem ./agent-workspace/ ../third_party/Galapagos/netlogo-files
```

每次工具调用都会看到这条日志，说明每次都在重新执行启动命令。

### 1.3 支持的通信协议

| 协议类型 | 描述 | 当前问题 |
|---------|------|---------|
| **stdio** | 标准输入输出（本地进程） | 每次调用重启进程 |
| **sse** | Server-Sent Events | 每次调用重建连接 |
| **streamable_http** | StreamableHTTP | 每次调用重建连接 |
| **http** | 简单HTTP/OpenAPI | 无状态，问题较小 |

---

## 2. 目标架构（简化版）

### 2.1 设计原则

1. **启用即连接** - 服务器启用时建立会话，停用时关闭会话
2. **连接复用** - 同一服务器的多次调用复用同一会话
3. **最小改动** - 复用现有 `running_servers` 结构，不新增文件

### 2.2 核心思路

**只对 stdio 协议复用会话**，其他协议保持原有逻辑：

| 协议 | 启动成本 | 多Agent隔离 | 策略 |
|------|---------|------------|------|
| **stdio** | 高（启动进程） | 不需要 | **复用会话** |
| **SSE** | 低（HTTP连接） | 需要 | 每次新建 |
| **StreamableHTTP** | 低（HTTP连接） | 需要 | 每次新建 |
| **HTTP** | 无 | 无状态 | 保持原样 |

```python
# 现有结构（保持不变）
self.running_servers[server_id] = process  # 或 "http_connection"

# 新增结构（仅存储 stdio 类型的会话）
self._stdio_sessions[server_id] = {
    "session": session,
    "_transport_ctx": ctx,
    "_session_ctx": ctx,
}
```

**优点**：
- 改动最小，只改 stdio 相关逻辑
- SSE/StreamableHTTP 多 Agent 调用时隔离性更好
- `running_servers` 完全不变

### 2.3 生命周期

```
                    stdio                    SSE/StreamableHTTP
                      │                              │
start_server()        │                              │
     │                ▼                              │
     │    ┌─────────────────┐                        │
     │    │ 启动进程         │                        │
     │    │ 建立会话         │                        │
     │    │ 存入_stdio_      │                        │
     │    │ sessions        │                        │
     │    └─────────────────┘                        │
     │                │                              │
call_tool()          │                              │
     │                ▼                              ▼
     │    ┌─────────────────┐            ┌─────────────────┐
     │    │ 复用已有会话     │            │ 每次新建连接     │
     │    │ (首次也快!)     │            │ (保持原逻辑)     │
     │    └─────────────────┘            └─────────────────┘
     │                │                              │
stop_server()        │                              │
     │                ▼                              │
     │    ┌─────────────────┐                        │
     │    │ 关闭会话         │                        │
     │    │ 停止进程         │                        │
     │    └─────────────────┘                        │
```

**关键点**：
- stdio 会话在 `start_server()` 时建立，不是首次 `call_tool()` 时
- 未启动的服务器调用时直接报错，不尝试建立连接
- 这样 stdio 的**首次调用也很快**（会话已存在）

---

## 3. 核心设计（最简版）

### 3.1 新增 `_stdio_sessions` 字典

```python
class MCPServerManager:
    def __init__(self):
        self.servers_config = {}
        self.running_servers = {}     # 保持不变
        self._stdio_sessions = {}     # 新增：仅存储 stdio 类型的会话
```

### 3.2 修改 start_server() - 启动时建立 stdio 会话

```python
# 在 start_server() 成功启动进程后，对 stdio 类型建立会话：

async def _create_stdio_session(self, server_id: str, server_config: dict):
    """建立 stdio MCP会话"""
    command = server_config.get('command')
    args = server_config.get('args', [])
    env = {**os.environ, **server_config.get('env', {})}
    server_params = StdioServerParameters(command=command, args=args, env=env)
    
    transport_ctx = stdio_client(server_params)
    read, write = await transport_ctx.__aenter__()
    
    session_ctx = ClientSession(read, write)
    session = await session_ctx.__aenter__()
    await session.initialize()
    
    self._stdio_sessions[server_id] = {
        "session": session,
        "_transport_ctx": transport_ctx,
        "_session_ctx": session_ctx,
    }
    logger.info(f"stdio 会话已建立: {server_id}")
```

### 3.3 修改 stop_server() - 停止时关闭 stdio 会话

```python
# 在 stop_server() 停止进程前，先关闭 stdio 会话：

async def _close_stdio_session(self, server_id: str):
    """关闭 stdio MCP会话"""
    session_info = self._stdio_sessions.pop(server_id, None)
    if not session_info:
        return
    
    try:
        if session_info.get("_session_ctx"):
            await session_info["_session_ctx"].__aexit__(None, None, None)
        if session_info.get("_transport_ctx"):
            await session_info["_transport_ctx"].__aexit__(None, None, None)
    except Exception as e:
        logger.warning(f"关闭会话时出错: {server_id}, {e}")
    
    logger.info(f"stdio 会话已关闭: {server_id}")
```

### 3.4 修改 call_tool_async()

```python
async def call_tool_async(self, server_id: str, tool_name: str, params: Dict) -> Dict:
    """异步调用MCP工具"""
    try:
        server_config = self.servers_config.get('mcpServers', {}).get(server_id)
        if not server_config:
            raise ValueError(f"服务器 {server_id} 不存在")
        
        # 内部服务器（保持不变）
        if server_config.get('internal', False):
            return await self._call_internal_tool(server_id, tool_name, params)
        
        comm_type = server_config.get('comm_type', 'stdio')
        
        # HTTP类型（保持不变）
        if comm_type == 'http':
            return await self._call_http_tool(server_id, server_config, tool_name, params)
        
        # stdio：复用已有会话
        if comm_type == 'stdio':
            session_info = self._stdio_sessions.get(server_id)
            if not session_info:
                raise ConnectionError(f"服务器 {server_id} 未启动")
            session = session_info["session"]
            result = await session.call_tool(tool_name, arguments=params)
            return self._convert_to_serializable(result)
        
        # SSE / StreamableHTTP：保持原有逻辑（每次新建连接）
        # 这里保持原有代码不变，确保多Agent调用时的隔离性
        if comm_type == 'sse':
            return await self._call_sse_tool(server_id, server_config.get('url'), tool_name, params)
        elif comm_type == 'streamable_http':
            return await self._call_streamable_http_tool(server_id, server_config.get('url'), tool_name, params)
            
    except Exception as e:
        logger.error(f"调用工具 {tool_name} 失败: {e}")
        return {"error": str(e), "is_error": True}
```

**注意**：`_call_sse_tool` 和 `_call_streamable_http_tool` 保持原有实现（每次新建连接），无需修改。

---

## 4. 协议处理策略

| 协议 | 处理方式 | 原因 |
|------|---------|------|
| **stdio** | 复用会话 | 启动成本高（进程启动） |
| **SSE** | 每次新建 | 连接成本低，多Agent需隔离 |
| **StreamableHTTP** | 每次新建 | 连接成本低，多Agent需隔离 |
| **HTTP** | 无状态 | REST API，本身无状态 |

**代码改动范围**：
- stdio：新增会话管理逻辑
- SSE / StreamableHTTP / HTTP：**保持原有代码不变**

---

## 5. 实施计划（最简版）

### Phase 1：新增 stdio 会话管理（0.5天）
1. 新增 `_stdio_sessions` 字典
2. 实现 `_create_stdio_session()` 函数
3. 实现 `_close_stdio_session()` 函数

### Phase 2：集成到现有流程（0.5天）
1. `start_server()` 启动 stdio 进程后调用 `_create_stdio_session()`
2. `stop_server()` 停止 stdio 进程前调用 `_close_stdio_session()`
3. `call_tool_async()` 中 stdio 类型直接使用已有会话

### Phase 3：测试验证（1天）
1. 功能测试：启动 → 多次调用 → 停止
2. 性能对比：连续10次 stdio 工具调用耗时
3. 回归测试：SSE/StreamableHTTP 保持原有行为

**总计：2天**

---

## 6. 文件变更

```
backend/app/services/
└── mcp_server_manager.py   # 仅修改此文件
```

**修改点**（约50行代码）：
| 位置 | 改动 |
|------|------|
| `__init__()` | 新增 `self._stdio_sessions = {}` |
| `start_server()` | stdio 类型启动进程后，调用 `_create_stdio_session()` 建立会话 |
| `stop_server()` | stdio 类型停止进程前，调用 `_close_stdio_session()` 关闭会话 |
| `call_tool_async()` | stdio 类型从 `_stdio_sessions` 获取已有会话 |
| 新增 | `_create_stdio_session()` 函数 |
| 新增 | `_close_stdio_session()` 函数 |

**无需修改**：
- SSE / StreamableHTTP 相关代码（保持原有逻辑）
- `tool_handler.py`（接口不变）
- 前端（API 不变）

---

## 7. 风险与解决方案

### 7.1 进程僵死

**风险**：stdio进程可能僵死不响应

**解决**：
- 工具调用设置超时
- 超时后强制重启进程
- 记录错误计数，超过阈值报警

### 7.2 内存泄漏

**风险**：长期运行的进程可能内存泄漏

**解决**：
- 定期重启空闲连接
- 监控进程内存使用
- 设置进程最大存活时间

### 7.3 并发冲突

**风险**：多个Agent同时调用同一服务器

**解决**：
- 每个连接有独立的锁
- 调用串行化
- 可选：连接池扩展为多连接

---

## 8. 性能预期

**stdio 协议**（主要优化目标）：
| 指标 | 当前 | 优化后 |
|------|------|--------|
| 首次调用延迟 | 2-5s (启动进程) | 2-5s (不变) |
| 后续调用延迟 | 2-5s (重启进程) | **50-200ms** |
| 资源占用 | 每次调用启动进程 | 保持单个长连接 |

**SSE / StreamableHTTP**：
- 保持原有性能（每次新建连接约200-500ms）
- 多 Agent 调用时隔离性更好

---

## 9. 测试用例

### 9.1 基本功能
- [ ] stdio服务器连接复用
- [ ] SSE服务器连接复用
- [ ] StreamableHTTP服务器连接复用
- [ ] HTTP服务器无状态调用

### 9.2 异常处理
- [ ] 进程异常退出后自动重连
- [ ] 网络断开后自动重连
- [ ] 调用超时处理
- [ ] 错误计数和重置

### 9.3 性能测试
- [ ] 连续10次调用同一工具
- [ ] 并发调用不同服务器
- [ ] 长时间运行稳定性

---

## 10. 向后兼容

- `call_tool()` 和 `call_tool_async()` 接口保持不变
- `get_tools()` 接口保持不变
- 配置文件格式保持不变
- 前端无需任何修改
