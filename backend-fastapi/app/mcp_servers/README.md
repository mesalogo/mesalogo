# MCP 环境变量和智能体变量管理

本项目使用官方MCP SDK实现了标准MCP服务器，提供环境变量和智能体变量的管理功能。

## 功能概述

MCP 服务允许 AI 智能体读取、修改和管理各种变量，作为智能体与系统环境之间的桥梁，提供安全、可控的变量访问机制。

系统支持以下类型的变量：

1. **任务环境变量** - 特定于某个行动任务的变量
2. **智能体变量** - 特定于某个智能体的内部状态变量

## 工具列表

服务提供以下标准化的 MCP 工具：

### 变量管理工具（`/api/mcp/variables`）

| 工具名称 | 描述 |
| ------- | ---- |
| `get_task_var` | 获取任务环境变量的值 |
| `set_task_var` | 设置任务环境变量的值 |
| `list_task_vars` | 列出任务的所有环境变量 |
| `get_agent_var` | 获取智能体变量的值 |
| `set_agent_var` | 设置智能体变量的值 |
| `list_agent_vars` | 列出智能体的所有变量 |

## 技术实现

本项目使用以下技术实现MCP服务器：

- MCP官方Python SDK (`mcp[cli]`)
- FastMCP服务器类
- 支持四种通信协议：stdio、StreamableHTTP、SSE、HTTP
- 集成到Flask应用中

## 与 MCP 客户端集成

### Claude Desktop 配置

在 Claude Desktop 配置文件中添加以下配置，可同时使用环境变量和智能体变量工具：

```json
{
  "mcpServers": {
    "variables-server": {
      "command": "curl",
      "args": [
        "-s",
        "-X",
        "POST",
        "http://localhost:8080/api/mcp/variables"
      ]
    }
  }
}
```

配置文件通常位于：
- MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%AppData%\Claude\claude_desktop_config.json`

### Cursor 配置

在 Cursor 配置文件中添加：

```json
{
  "tools": {
    "variables-server": {
      "command": ["curl", "-s", "-X", "POST", "http://localhost:8080/api/mcp/variables"],
      "transport": "stdio"
    }
  }
}
```

## 工具使用示例

### 在 Claude 中使用工具

设置任务变量：
```
您可以使用 set_task_var 工具设置任务变量，比如设置当前任务的进度状态。
```

获取任务变量：
```
请使用 get_task_var 工具获取任务ID 123 的 current_step 变量值。
```

### 多种工具链式使用

```
1. 首先使用 list_task_vars 工具查看所有可用的任务变量
2. 使用 set_task_var 工具更新进度变量
3. 使用 get_task_var 工具验证更新是否成功
```

## API 参考

### 任务环境变量工具

#### get_task_var
- 参数:
  - `task_id`: 任务ID (整数)
  - `var_name`: 变量名称 (字符串)
- 返回: 变量值

#### set_task_var
- 参数:
  - `task_id`: 任务ID (整数)
  - `var_name`: 变量名称 (字符串)
  - `var_value`: 变量值 (任意类型)
- 返回: 设置后的变量值

#### list_task_vars
- 参数:
  - `task_id`: 任务ID (整数)
- 返回: 包含所有变量的字典

### 智能体变量工具

#### get_agent_var
- 参数:
  - `agent_id`: 智能体ID (整数)
  - `var_name`: 变量名称 (字符串)
- 返回: 变量值

#### set_agent_var
- 参数:
  - `agent_id`: 智能体ID (整数)
  - `var_name`: 变量名称 (字符串)
  - `var_value`: 变量值 (任意类型)
  - `is_public`: 是否公开 (布尔值，可选，默认为True)
- 返回: 设置后的变量值

#### list_agent_vars
- 参数:
  - `agent_id`: 智能体ID (整数)
  - `include_private`: 是否包含私有变量 (布尔值，可选，默认为False)
- 返回: 包含所有变量的字典

## 故障排除

如果工具调用失败，请检查：

1. 后端服务是否正常运行（`python run_app.py`）
2. MCP客户端（Claude Desktop、Cursor等）配置是否正确
3. URL是否正确（默认为`http://localhost:8080/api/mcp/variables`）
4. 参数是否正确（比如task_id、agent_id等）