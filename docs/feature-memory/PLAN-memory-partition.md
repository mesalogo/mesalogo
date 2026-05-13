# 图谱增强记忆分区方案

## 概述

基于 Graphiti 框架的记忆分区策略设计，为 ABM-LLM 系统提供灵活、高效的知识图谱数据组织方案。

## 官方资源

- **官方网站**: https://www.getzep.com/
- **官方文档**: https://help.getzep.com/graphiti/
- **GitHub 仓库**: https://github.com/getzep/graphiti
- **分区文档**: https://help.getzep.com/graphiti/core-concepts/graph-namespacing

## 1. Graphiti 分区机制

### 1.1 核心原理
- **group_id 分区**：使用字符串标识符进行数据隔离
- **完全隔离**：不同 group_id 之间数据完全独立
- **查询时指定**：可在搜索时指定特定的 group_ids
- **命名规范**：支持字母数字、下划线和连字符

### 1.2 分区特性
```python
# 分区标识符验证规则
def validate_group_id(group_id: str) -> bool:
    # 允许空字符串（默认分区）
    if not group_id:
        return True
    # 只允许 ASCII 字母数字、下划线、连字符
    return re.match(r'^[a-zA-Z0-9_-]+$', group_id)
```

## 2. 分区策略设计

### 2.1 按行动空间分区 (by_action_space) ⭐ 推荐主策略
```
格式: "action_space_{action_space_id}"
示例: "action_space_123", "action_space_456"
```

**优势：**
- 符合业务模型（行动空间是顶层组织单位）
- 天然的多租户隔离
- 便于权限控制和数据管理
- 支持跨任务的知识共享
- 适合长期记忆积累

**适用场景：**
- 需要跨任务知识共享的场景
- 长期运行的行动空间
- 多用户协作环境

### 2.2 混合分区 (hybrid) ⭐ 推荐默认策略
```
格式: "action_space_{action_space_id}_task_{task_id}"
示例: "action_space_123_task_456"
```

**优势：**
- 结合行动空间和任务的双重隔离
- 支持层次化的数据组织
- 便于跨层级的数据查询和分析
- 平衡了隔离性和共享性

**适用场景：**
- 需要任务级隔离但保持空间级关联
- 复杂的多层级组织结构
- 需要精细化权限控制

### 2.3 按任务分区 (by_task)
```
格式: "task_{action_task_id}"
示例: "task_123", "task_456"
```

**优势：**
- 任务级别的精细隔离
- 便于任务完成后的数据清理
- 适合临时性、独立性强的任务

**适用场景：**
- 高度独立的任务
- 临时性项目
- 需要严格数据隔离的场景

### 2.4 按智能体分区 (by_agent)
```
格式: "agent_{agent_id}"
示例: "agent_123", "agent_456"
```

**优势：**
- 智能体个性化记忆
- 支持智能体间的知识隔离
- 便于智能体行为分析

**适用场景：**
- 需要个性化记忆的智能体
- 智能体间需要隔离的场景
- 个体行为分析需求

### 2.5 按会话分区 (by_conversation)
```
格式: "conversation_{conversation_id}"
示例: "conversation_123", "conversation_456"
```

**优势：**
- 会话级别的精细隔离
- 便于会话上下文管理
- 支持会话历史追踪

**适用场景：**
- 需要严格会话隔离
- 短期交互场景
- 隐私要求较高的对话

## 3. 实现方案

### 3.1 分区策略映射
```python
def get_group_id(strategy: str, context: dict) -> str:
    """根据分区策略生成 group_id"""
    strategies = {
        "by_action_space": lambda: f"action_space_{context['action_space_id']}",
        "by_task": lambda: f"task_{context['action_task_id']}",
        "by_agent": lambda: f"agent_{context['agent_id']}",
        "by_conversation": lambda: f"conversation_{context['conversation_id']}",
        "hybrid": lambda: f"action_space_{context['action_space_id']}_task_{context['action_task_id']}"
    }
    
    return strategies.get(strategy, lambda: "default")()
```

### 3.2 层次化查询支持
```python
async def search_with_hierarchy(query: str, context: dict, strategy: str):
    """支持层次化的搜索"""
    group_ids = []
    
    if strategy == "hybrid":
        # 先搜索当前任务，再搜索行动空间级别
        group_ids.append(f"action_space_{context['action_space_id']}_task_{context['action_task_id']}")
        group_ids.append(f"action_space_{context['action_space_id']}")
    elif strategy == "by_action_space":
        group_ids.append(f"action_space_{context['action_space_id']}")
    elif strategy == "by_task":
        group_ids.append(f"task_{context['action_task_id']}")
    
    return await client.search(query, group_ids=group_ids)
```

### 3.3 跨分区查询
```python
async def cross_partition_search(query: str, user_context: dict):
    """支持跨分区的智能搜索"""
    # 根据用户权限和上下文确定搜索范围
    accessible_group_ids = get_accessible_groups(user_context)
    return await client.search(query, group_ids=accessible_group_ids)
```

## 4. 数据生命周期管理

### 4.1 任务完成后的数据处理
```python
async def handle_task_completion(task_id: str, strategy: str):
    """任务完成后的数据处理"""
    if strategy == "by_task":
        # 可以选择删除或归档任务级数据
        await archive_task_data(f"task_{task_id}")
    elif strategy == "hybrid":
        # 保留行动空间级数据，清理任务级数据
        await cleanup_task_specific_data(task_id)
```

### 4.2 数据归档策略
```python
async def archive_old_data(cutoff_date: datetime, strategy: str):
    """归档过期数据"""
    if strategy in ["by_task", "by_conversation"]:
        # 短期分区可以定期清理
        await cleanup_expired_partitions(cutoff_date)
    elif strategy in ["by_action_space", "hybrid"]:
        # 长期分区需要更谨慎的归档策略
        await archive_old_episodes(cutoff_date)
```

## 5. 性能优化

### 5.1 分区大小管理
- **监控分区大小**：避免单个分区过大影响性能
- **自动分片**：当分区超过阈值时考虑进一步细分
- **定期清理**：清理过期或无用的数据

### 5.2 查询优化
- **缓存热点数据**：缓存频繁访问的分区数据
- **批量操作**：批量处理同一分区的操作
- **索引优化**：确保 Neo4j 的索引配置合理

### 5.3 批量处理
```python
class GraphitiBatchProcessor:
    def __init__(self, batch_size: int = 100):
        self.batch_size = batch_size
        self.episode_buffer = []
    
    async def add_episode_to_batch(self, **episode_data):
        """添加到批处理缓冲区"""
        self.episode_buffer.append(episode_data)
        if len(self.episode_buffer) >= self.batch_size:
            await self.flush_batch()
    
    async def flush_batch(self):
        """批量处理缓冲区中的数据"""
        # 并发处理，但限制并发数
        semaphore = asyncio.Semaphore(10)
        tasks = [self.process_episode(episode) for episode in self.episode_buffer]
        await asyncio.gather(*tasks)
        self.episode_buffer.clear()
```

## 6. 配置管理

### 6.1 前端配置界面
- **默认策略**：hybrid（混合分区）
- **可选策略**：支持所有5种分区策略
- **动态切换**：支持运行时切换分区策略
- **配置验证**：确保配置参数的有效性

### 6.2 后端配置存储
```json
{
  "framework_config": {
    "memory_partition_strategy": "hybrid",
    "max_nodes_per_partition": 10000,
    "importance_threshold": 0.3,
    "enable_time_decay": true
  }
}
```

## 7. 最佳实践建议

### 7.1 策略选择指南
- **新系统**：推荐使用 hybrid 策略作为默认
- **多租户场景**：使用 by_action_space 策略
- **临时任务**：使用 by_task 策略
- **个性化需求**：使用 by_agent 策略
- **隐私要求高**：使用 by_conversation 策略

### 7.2 命名规范（官方建议）
根据 Graphiti 官方文档，group_id 命名应遵循以下规范：
- **字符限制**：只允许 ASCII 字母数字、下划线(_)和连字符(-)
- **一致性**：使用一致的命名前缀，如 `tenant_`, `user_`, `project_`
- **可读性**：保持命名的可读性和可维护性
- **层次化**：支持层次化命名，如 `tenant_123_project_456`

```python
# 官方验证规则
def validate_group_id(group_id: str) -> bool:
    if not group_id:  # 允许空字符串（默认分区）
        return True
    # 只允许 ASCII 字母数字、下划线、连字符
    return re.match(r'^[a-zA-Z0-9_-]+$', group_id)
```

### 7.3 监控和维护
- 定期监控分区大小和性能
- 建立数据归档和清理机制
- 实施访问权限控制
- 记录分区策略变更历史

## 8. 官方最佳实践示例

### 8.1 多租户应用示例（官方推荐）
```python
async def add_customer_data(tenant_id, customer_data):
    """添加客户数据到租户特定的命名空间"""
    # 使用 tenant_id 作为命名空间
    namespace = f"tenant_{tenant_id}"

    # 为此客户数据创建一个 episode
    await graphiti.add_episode(
        name=f"customer_data_{customer_data['id']}",
        episode_body=customer_data,
        source=EpisodeType.json,
        source_description="Customer profile update",
        reference_time=datetime.now(),
        group_id=namespace  # 按租户进行命名空间划分
    )

async def search_tenant_data(tenant_id, query):
    """在租户的命名空间内搜索"""
    namespace = f"tenant_{tenant_id}"

    # 只在此租户的命名空间内搜索
    return await graphiti.search(
        query=query,
        group_id=namespace
    )
```

### 8.2 官方查询模式
```python
# 基础搜索（推荐用于大多数场景）
search_results = await graphiti.search(
    query="Wool Runners",
    group_id="product_catalog"  # 只在此命名空间内搜索
)

# 高级节点搜索
from graphiti_core.search.search_config_recipes import NODE_HYBRID_SEARCH_RRF

node_search_config = NODE_HYBRID_SEARCH_RRF.model_copy(deep=True)
node_search_config.limit = 5

node_search_results = await graphiti._search(
    query="SuperLight Wool Runners",
    group_id="product_catalog",
    config=node_search_config
)
```

## 9. 未来扩展

### 9.1 高级分区策略
- **时间分区**：基于时间维度的自动分区
- **主题分区**：基于内容主题的智能分区
- **负载分区**：基于查询负载的动态分区

### 9.2 跨分区功能
- **分区合并**：支持分区间的数据合并
- **分区迁移**：支持数据在分区间的迁移
- **联邦查询**：支持跨多个分区的联合查询

## 10. Graphiti 技术优势

### 10.1 与 GraphRAG 的对比
根据官方文档，Graphiti 相比 Microsoft GraphRAG 具有以下优势：

| 方面 | GraphRAG | Graphiti |
|------|----------|----------|
| **主要用途** | 静态文档摘要 | 动态数据管理 |
| **数据处理** | 批处理导向 | 连续增量更新 |
| **知识结构** | 实体集群和社区摘要 | 情节数据、语义实体、社区 |
| **检索方法** | 顺序LLM摘要 | 混合语义、关键词和图搜索 |
| **时间处理** | 基础时间戳跟踪 | 显式双时态跟踪 |
| **查询延迟** | 秒到十几秒 | 通常亚秒级延迟 |
| **自定义实体类型** | 否 | 是，可定制 |

### 10.2 核心技术特性
- **时间感知**：跟踪事实和关系随时间的变化
- **情节处理**：将数据作为离散情节摄取，保持数据来源
- **混合搜索**：结合语义和BM25全文搜索
- **可扩展性**：为处理大型数据集而设计
- **多源支持**：可摄取非结构化文本和结构化JSON数据

## 11. 总结

本方案基于 Graphiti 的 group_id 机制，设计了5种分区策略，推荐使用 hybrid 作为默认策略，by_action_space 作为主要策略。通过合理的分区设计，可以实现：

- **数据隔离**：确保不同租户/任务间的数据安全
- **性能优化**：通过分区减少查询范围，提升性能
- **灵活管理**：支持多种场景下的数据组织需求
- **扩展性**：为未来的功能扩展预留空间
- **官方支持**：基于 Zep 官方文档和最佳实践

该方案充分利用了 Graphiti 的分区能力，结合官方推荐的最佳实践，为 ABM-LLM 系统提供了强大而灵活的记忆管理基础。

## 参考资源

- [Graphiti 官方文档](https://help.getzep.com/graphiti/)
- [图谱命名空间指南](https://help.getzep.com/graphiti/core-concepts/graph-namespacing)
- [Zep 官方网站](https://www.getzep.com/)
- [Graphiti GitHub 仓库](https://github.com/getzep/graphiti)
- [Zep 博客 - Graphiti 介绍](https://blog.getzep.com/graphiti-knowledge-graphs-for-agents/)
