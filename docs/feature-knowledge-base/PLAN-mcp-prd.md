# 环境变量 MCP Server 实现计划

## 项目概述

构建一个基于 Model Context Protocol (MCP) 的服务器，使智能体能够在行动任务执行过程中读取、修改和管理环境变量。该服务器将作为智能体与系统环境之间的桥梁，提供安全、可控的变量访问机制，并完全符合Claude、Cursor和OpenAI的标准规范。

## MCP标准与兼容性

本项目将使用MCP官方Python SDK实现服务器，确保与主流AI应用的无缝集成：

- **标准兼容性**: 使用官方MCP SDK (`mcp[cli]`)遵循标准协议规范
- **客户端支持**: 支持Claude Desktop、Cursor、OpenAI等主流MCP客户端
- **服务发现**: 支持通过mcp.run等工具注册表进行服务发现
- **标准化接口**: 使用MCP SDK自动生成标准化的工具接口

## 架构设计

### 核心架构

```
┌─────────────────┐      ┌───────────────────┐      ┌─────────────────┐
│                 │      │                   │      │                 │
│   AI 智能体     │◄────►│  环境变量 MCP Server │◄────►│  变量存储系统    │
│                 │      │                   │      │                 │
└─────────────────┘      └───────────────────┘      └─────────────────┘
                                  ▲
                                  │
                                  ▼
                          ┌───────────────────┐
                          │                   │
                          │   权限控制系统     │
                          │                   │
                          └───────────────────┘
```

### MCP服务器管理架构

```
┌─────────────────┐      ┌───────────────────┐      ┌─────────────────┐
│                 │      │                   │      │                 │
│   AI 智能体     │◄────►│  MCP服务器管理器   │◄────►│  MCP服务器集群   │
│                 │      │                   │      │                 │
└─────────────────┘      └───────────────────┘      └─────────────────┘
                                  ▲
                                  │
                                  ▼
                          ┌───────────────────┐
                          │                   │
                          │  mcp_config.json  │
                          │                   │
                          └───────────────────┘
```

### 数据模型

环境变量将按照以下层次结构进行组织：

1. **任务环境变量** - 特定于某个行动任务的变量
2. **智能体变量** - 特定于某个智能体的内部状态变量

## MCP工具实现

使用MCP官方SDK (`mcp[cli]`)实现工具，通过类型注解和文档字符串自动生成规范化的工具定义：

```python
from mcp.server.fastmcp import FastMCP

# 初始化MCP服务器
mcp = FastMCP("variables-server")

@mcp.tool()
async def get_task_var(task_id: str, var_name: str) -> str:
    """获取任务环境变量的值
    
    Args:
        task_id: 任务ID
        var_name: 要获取的变量名称
    """
    # 实现逻辑
    return value
```

## MCP服务器管理功能实现

### 核心功能

1. **配置文件管理**
   - 使用`mcp_config.json`存储MCP服务器配置
   - 支持内部服务器（如变量服务器）和外部服务器（如Playwright, SearXNG）
   - 支持动态加载、编辑和保存配置

2. **服务器生命周期管理**
   - 启动/停止MCP服务器
   - 监控服务器状态
   - 自动在应用退出时关闭所有服务器

3. **API接口**
   - RESTful API用于管理MCP服务器
   - 支持列出、添加、编辑、删除服务器
   - 控制服务器的启动和停止

4. **前端界面**
   - 可视化管理MCP服务器
   - 配置生成与复制（用于客户端配置）
   - 服务器状态监控

### 技术实现

```python
class MCPServerManager:
    """MCP服务器管理器，负责MCP服务器的配置加载和生命周期管理"""
    
    def __init__(self):
        """初始化MCP服务器管理器"""
        self.servers_config = {}  # 服务器配置
        self.running_servers = {}  # 运行中的服务器进程
        
    def load_config(self) -> Dict:
        """从配置文件加载MCP服务器配置"""
        
    def start_server(self, server_id: str) -> Dict:
        """启动指定的MCP服务器"""
        
    def stop_server(self, server_id: str) -> Dict:
        """停止指定的MCP服务器"""
        
    def list_servers(self) -> List[Dict]:
        """列出所有MCP服务器"""
```

## 工具集与功能

### 1. 环境变量操作工具

**任务环境变量操作**
- `get_task_var` - 获取任务环境变量
- `set_task_var` - 设置任务环境变量
- `list_task_vars` - 列出任务的所有环境变量

**智能体变量操作**
- `get_agent_var` - 获取智能体变量
- `set_agent_var` - 设置智能体变量
- `list_agent_vars` - 列出智能体的所有变量

### 2. 会话与上下文管理

- **会话初始化**: 使用MCP SDK自动处理会话和连接
- **上下文保持**: MCP SDK自动处理上下文和会话状态
- **会话终止**: SDK自动处理会话结束和资源释放

### 3. 错误处理与故障恢复

使用MCP SDK内置的错误处理机制：
- **异常捕获**: 工具执行时的异常将自动转换为标准MCP错误响应
- **友好的错误消息**: SDK自动提供清晰的错误原因
- **重试机制**: SDK支持自动处理临时性故障

## 安全与权限控制

- **基于角色的访问控制**: 限制不同角色对工具的访问权限
- **操作审计**: 记录所有工具调用和变量操作
- **数据验证**: SDK自动验证输入参数，防止注入攻击
- **命名空间隔离**: 确保不同任务和智能体之间的变量不会冲突

## 实现与部署

### 服务器实现

- **集成方式**: 服务器实现将直接集成到现有Flask应用中
- **通信协议**: 使用HTTP + SSE通信协议，通过Flask路由提供服务
- **标准库**: 使用官方MCP Python SDK (`mcp[cli]`)实现

### 配置与安装

Claude Desktop配置示例:
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

Cursor配置示例:
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

## 实施阶段

### 阶段一：基础MCP服务实现
1. 建立使用MCP SDK的服务器框架
2. 集成到现有Flask应用
3. 实现基本工具集
4. 添加标准化错误处理

### 阶段二：MCP服务器管理功能实现
1. 创建MCP服务器管理器(`mcp_server_manager.py`)
2. 设计`mcp_config.json`结构
3. 实现配置加载和保存功能
4. 添加服务器生命周期管理（启动/停止）
5. 开发管理API接口

### 阶段三：前端集成与优化
1. 创建MCP服务器管理页面
2. 实现可视化配置和管理界面
3. 优化服务器状态监控
4. 完善文档和示例

## 技术选择

- **MCP SDK**: 官方Python MCP SDK (`mcp[cli]`)
- **Web框架**: 集成到现有的Flask应用
- **通信方式**: HTTP + SSE
- **存储系统**: 集成现有的SQLAlchemy数据库
- **前端技术**: React + Ant Design

## 参考资源

- MCP官方文档: https://modelcontextprotocol.io/
- MCP标准规范: https://modelcontextprotocol.io/specifications/ 
- MCP SDK ：https://github.com/modelcontextprotocol/python-sdk