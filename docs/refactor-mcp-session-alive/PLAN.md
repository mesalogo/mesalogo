# MCP Session 保持连接方案

## 问题描述

使用 Playwright MCP Server 时，每次调用工具（如 `browser_navigate`）后，浏览器会立即关闭。

**根本原因：** MCP 使用 SSE (Server-Sent Events) 协议，当客户端断开连接时，浏览器 session 也会随之关闭。

## 问题来源

GitHub Issue: https://github.com/langchain-ai/langchain-mcp-adapters/issues/178

> The current ToolNode or create_react_agent() sends a single request, say, 'browser_navigate' to MCP Server. This causes the browser windows to open and navigate to the website but the connection is closed on Langgraph side. This causes the browser window to close.

## 已实现的解决方案

### 方案：持久 Session Worker 模式（已实现）

参考 MCP Python SDK 官方最佳实践，为 `streamable_http` 和 `sse` 类型的服务器实现了持久会话管理，与已有的 `stdio` 实现保持一致。

#### 核心改动

在 `backend/app/services/mcp_server_manager.py` 中：

1. **新增 Session 存储**
   ```python
   self._streamable_http_sessions = {}  # streamable_http类型服务器的会话
   self._sse_sessions = {}  # sse类型服务器的会话
   ```

2. **新增 Session Worker**
   - `_streamable_http_session_worker()` - 长期运行的协程，管理 StreamableHTTP 会话
   - `_sse_session_worker()` - 长期运行的协程，管理 SSE 会话

3. **Session 生命周期管理**
   - `_start_streamable_http_session()` / `_start_sse_session()` - 启动持久会话
   - `_stop_streamable_http_session()` / `_stop_sse_session()` - 停止会话
   - `_call_streamable_http_tool_reuse()` / `_call_sse_tool_reuse()` - 复用会话调用工具

4. **修改 start_server()**
   - StreamableHTTP 类型：启动持久会话 worker，标记为 `streamable_http_session`
   - SSE 类型：启动持久会话 worker，标记为 `sse_session`

5. **修改 stop_server()**
   - 支持关闭 `streamable_http_session` 和 `sse_session` 类型

6. **修改 call_tool()**
   - StreamableHTTP 类型：通过 `_call_streamable_http_tool_reuse()` 复用会话
   - SSE 类型：通过 `_call_sse_tool_reuse()` 复用会话

#### 工作原理

```
服务器启动时:
  start_server() 
    -> _start_streamable_http_session() 
    -> 启动 _streamable_http_session_worker() 协程
    -> 建立持久连接，等待命令

工具调用时:
  call_tool()
    -> _call_streamable_http_tool_reuse()
    -> 向 worker 发送命令
    -> worker 在同一个 session 中执行 call_tool()
    -> 返回结果

服务器停止时:
  stop_server()
    -> _stop_streamable_http_session()
    -> 向 worker 发送 stop 命令
    -> worker 退出，连接关闭
```

#### 效果

- **浏览器保持打开**：多次工具调用在同一个 session 中执行，浏览器不会关闭
- **支持连续操作**：导航 → 截图 → 点击 → 输入 等操作可以连续执行
- **自动清理**：服务器停止时自动关闭会话和浏览器

## 相关文件

- Docker 容器配置: `third_party/docker-vnc-mcp/`
- MCP Server Manager: `backend/app/services/mcp_server_manager.py`
- Tool Call Executor: `backend/app/services/tool_call_executor.py`

## 参考资料

- Playwright MCP: https://github.com/microsoft/playwright-mcp
- MCP 协议规范: https://modelcontextprotocol.io/specification/
- MCP Python SDK: https://github.com/modelcontextprotocol/python-sdk
- GitHub Issue #796 (Session 超时问题): https://github.com/modelcontextprotocol/python-sdk/issues/796
- GitHub Issue #178: https://github.com/langchain-ai/langchain-mcp-adapters/issues/178
