# 外部知识库MCP服务封装方案

## 概述

基于现有的外部知识库查询接口（Dify和RAGFlow），封装两个标准的内部MCP服务，供智能体使用。这将使智能体能够通过标准化的MCP工具直接查询外部知识库，而无需通过HTTP API调用。

## 现状分析

### 已有基础设施

1. **外部知识库适配器系统**
   - `DifyAdapter`: 支持Dify.AI知识库查询
   - `RagFlowAdapter`: 支持RAGFlow知识库查询
   - `ExternalKnowledgeService`: 统一的知识库查询服务
   - 完整的数据库模型支持（提供商、知识库、角色绑定）

2. **MCP服务器管理系统**
   - `MCPServerManager`: 完整的MCP服务器生命周期管理
   - 支持内部和外部MCP服务器
   - 配置文件管理和动态加载
   - 工具模式缓存机制

3. **现有MCP服务示例**
   - `variables_server.py`: 环境变量和智能体变量管理
   - 使用FastMCP框架实现标准MCP协议

## 方案设计

### 1. 架构设计

```
智能体 → MCP客户端 → 统一知识库MCP服务器 → ExternalKnowledgeService → 适配器 → 外部知识库API
```

**设计理念**: 基于智能体-角色绑定机制，智能体只需要知道自己的agent_id，系统自动根据agent_id推断对应的role_id，然后查询该角色绑定的所有知识库。

### 2. MCP服务设计

基于Agent-Role关系模型，我们可以大大简化工具设计。智能体只知道自己的agent_id，系统负责推断对应的role_id并查询绑定的知识库。

#### 2.1 统一知识库MCP服务 (`knowledge_base_server.py`)

**服务标识**: `knowledge-base`

**唯一工具**:
- `query_knowledge`: 智能体提供自己的agent_id，系统自动查询对应角色绑定的所有知识库

### 3. 技术实现

#### 3.1 服务器实现结构

```python
# 基于FastMCP框架
from mcp.server.fastmcp import FastMCP
from app.services.external_knowledge import ExternalKnowledgeService
from app.models import Agent

mcp = FastMCP("knowledge-base")

@mcp.tool()
async def query_knowledge(agent_id: int, query: str, max_results: int = 20, query_params: dict = None) -> dict:
    """智能体查询知识库"""
    # 根据agent_id获取对应的role_id
    agent = Agent.query.get(agent_id)
    if not agent:
        return {"success": False, "error": f"智能体ID {agent_id} 不存在"}

    # 调用现有的服务方法
    return ExternalKnowledgeService.query_knowledge_for_role(agent.role_id, query, query_params)
```

#### 3.2 集成现有服务

- 复用`ExternalKnowledgeService`的查询逻辑
- 利用`AdapterFactory`创建适配器实例
- 使用现有的数据库模型进行知识库管理

#### 3.3 配置管理

在`mcp_config.json`中添加统一的知识库服务配置：

```json
{
  "mcpServers": {
    "knowledge-base": {
      "command": "python",
      "args": ["-m", "app.mcp_servers.knowledge_base_server"],
      "description": "统一知识库查询服务（支持Dify、RAGFlow等）",
      "internal": true,
      "enabled": true,
      "comm_type": "stdio"
    }
  }
}
```

## 实现计划

### 阶段1: 核心MCP服务器实现

1. **创建统一知识库MCP服务器** (`app/mcp_servers/knowledge_base_server.py`)
   - 实现`query_knowledge`核心工具
   - 添加agent_id到role_id的转换逻辑
   - 集成现有的`ExternalKnowledgeService.query_knowledge_for_role`方法
   - 添加错误处理和日志记录

### 阶段2: 集成和优化

1. **MCP服务器注册**
   - 更新`mcp_config.json`配置
   - 在`MCPServerManager`中注册新服务
   - 添加自动启动配置

2. **性能优化**
   - 实现查询结果缓存
   - 优化错误处理机制
   - 添加查询性能监控

## 工具接口设计

### 唯一工具

#### `query_knowledge`
```python
async def query_knowledge(
    agent_id: int,
    query: str,
    max_results: int = 20,
    query_params: dict = None
) -> dict:
    """
    智能体查询知识库（系统自动根据agent_id推断role_id并查询绑定的知识库）

    Args:
        agent_id: 智能体ID
        query: 查询文本
        max_results: 最大返回结果数
        query_params: 可选的查询参数，用于覆盖知识库默认配置

    Returns:
        dict: 聚合查询结果，包含：
        - success: bool, 查询是否成功
        - results: List[dict], 查询结果列表
        - total_count: int, 返回结果数量
        - total_available: int, 可用结果总数
        - query_time: float, 查询耗时
        - queried_knowledge_bases: int, 查询的知识库数量
        - metadata: dict, 查询元数据（智能体信息、角色信息、知识库来源等）
    """
```

## 优势分析

### 1. 标准化接口
- 统一的MCP协议，智能体无需了解具体的知识库API
- 标准化的工具参数和返回格式
- 自动的工具发现和文档生成

### 2. 性能优化
- 内部服务避免HTTP调用开销
- 可实现查询结果缓存
- 支持并发查询多个知识库

### 3. 安全性
- 内部服务，无需暴露外部API端点
- 基于角色的访问控制
- 统一的认证和授权机制

### 4. 可扩展性
- 易于添加新的知识库类型
- 支持自定义查询参数
- 可扩展的工具集合

## 风险评估

### 1. 技术风险
- **依赖现有适配器**: 需要确保适配器的稳定性
- **MCP协议兼容性**: 需要测试与不同MCP客户端的兼容性

### 2. 性能风险
- **查询延迟**: 内部调用链可能增加延迟
- **资源消耗**: 多个MCP服务器可能增加内存使用

### 3. 维护风险
- **代码重复**: 需要避免与现有API路由的代码重复
- **配置复杂性**: 增加了系统配置的复杂度

## 使用示例

### 智能体查询知识库
```python
# 智能体只需要知道自己的agent_id，系统自动推断角色并查询绑定的知识库
result = await query_knowledge(
    agent_id=456,  # 智能体只需要提供自己的ID
    query="如何使用Python进行数据分析？",
    max_results=10
)

# 结果会自动聚合来自Dify、RAGFlow等所有绑定知识库的信息
print(f"找到 {result['total_count']} 个相关结果")
print(f"查询了 {result['queried_knowledge_bases']} 个知识库")
print(f"智能体: {result['metadata']['agent_name']}, 角色: {result['metadata']['role_name']}")
```



## 后续扩展

1. **查询优化**
   - 智能查询路由（根据查询内容选择最合适的知识库）
   - 结果去重和融合算法优化
   - 查询缓存机制

2. **监控和分析**
   - 查询性能监控
   - 知识库使用统计
   - 查询质量评估

3. **高级功能**
   - 支持流式查询结果
   - 多轮对话上下文保持
   - 知识库内容更新通知

## 总结

通过极简的工具设计，基于智能体-角色绑定机制提供统一的知识库查询服务，智能体使用极其简单：
- **一个工具解决所有问题**：`query_knowledge` 是智能体唯一需要的知识库查询工具
- **零配置使用**：智能体只需要知道自己的agent_id即可查询所有绑定的知识库
- **自动推断**：系统自动根据agent_id推断对应的role_id
- **自动聚合**：系统自动处理多知识库查询和结果聚合
- **完全透明**：智能体无需了解角色ID、知识库类型、配置、API等任何细节

这种设计将复杂性完全隐藏在系统内部，智能体只需要"知道自己是谁"就能获取所有相关知识，为智能体提供了最自然、最简洁的知识库访问接口。
