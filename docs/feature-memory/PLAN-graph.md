# 分区记忆图谱功能开发计划

## 项目概述

基于现有的ABM-LLM-v2系统，开发分区记忆的记忆图谱功能，实现不同任务的不同会话作为数据输入到Graphiti知识图谱中，提供智能的记忆管理和检索能力。

## 当前环境状态

### 已完成的基础设施
- ✅ Docker服务已启动：Neo4j (7474:7687) 和 FalkorDB (6379:6380)
- ✅ 已安装 graphiti-core[falkordb] 依赖
- ✅ 嵌入模型服务已准备就绪
- ✅ 现有图谱增强框架基础代码已存在

### 现有系统架构
- **数据模型**：ActionTask -> Conversation -> Message 的层次结构
- **图谱增强服务**：已有GraphEnhancementService基础框架
- **配置管理**：已有GraphEnhancement模型和前端配置界面
- **嵌入服务**：已有EmbeddingService和sentence-transformers集成

## 开发计划

### 阶段一：数据库配置和基础设施完善 (1-2天)

#### 1.1 扩展GraphEnhancement模型配置
- [x] 在现有GraphEnhancement模型中添加Graphiti专用配置字段
- [x] 扩展framework_config JSON字段，支持以下配置：
  ```json
  {
    "graphiti_config": {
      "database": {
        "type": "neo4j",  // 或 "falkordb"
        "connection": {
          "uri": "bolt://localhost:7687",
          "username": "neo4j",
          "password": "password",
          "database": "neo4j"
        }
      },
      "performance": {
        "semaphore_limit": 10,
        "use_parallel_runtime": false,
        "telemetry_enabled": false,
        "batch_size": 100,
        "timeout": 30
      },
      "memory_partition": {
        "strategy": "by_task",  // by_task, by_conversation, hybrid
        "max_nodes_per_partition": 10000,
        "enable_time_decay": true,
        "importance_threshold": 0.3
      }
    }
  }
  ```

#### 1.2 完善前端配置界面
- [x] 扩展frontend/src/pages/settings/GraphEnhancementSettingsPage.js
- [x] 添加Graphiti专用配置面板：
  - 图数据库连接配置（类型选择、连接参数）
  - 性能参数配置（并发限制、批处理大小等）
  - 记忆分区策略配置
  - 连接测试按钮和状态显示

#### 1.3 验证图数据库连接和服务初始化
- [x] 在GraphEnhancementService中添加Graphiti连接测试方法
- [x] 实现配置验证和错误处理机制
- [ ] 添加异步初始化支持和状态监控
- [ ] 创建配置热更新机制（无需重启服务）

#### 1.4 MCP集成（Model Context Protocol）
- [x] 前端MCP集成示例界面
  - [x] 在图谱增强配置页面添加"MCP服务器示例"按钮
  - [x] 创建MCP配置示例Modal，包含：
    - Claude Desktop配置示例（stdio传输）
    - Cursor IDE配置示例（SSE传输）
    - 基于当前数据库配置的环境变量生成
    - 启动命令和集成说明
- [ ] 部署Graphiti MCP服务器
  - [ ] 克隆Graphiti仓库并配置MCP服务器环境
  - [ ] 配置环境变量（OPENAI_API_KEY、Neo4j连接等）
  - [ ] 启动MCP服务器（支持stdio和SSE两种传输方式）
- [ ] 任务记忆隔离机制
  - [ ] 使用group_id参数实现任务级记忆隔离
  - [ ] 为不同ActionTask分配独立的group_id命名空间
  - [ ] 实现动态MCP服务器管理（按需启动/停止）
- [ ] 集成到现有系统
  - [ ] 在GraphEnhancementService中添加MCP客户端支持
  - [ ] 实现MCP工具调用的封装和代理
  - [ ] 添加MCP服务状态监控和健康检查
- [ ] 配置AI助手集成
  - [ ] 配置Claude Desktop的MCP连接
  - [ ] 配置Cursor IDE的MCP连接
  - [ ] 测试AI助手的知识图谱记忆功能
- [ ] MCP工具功能验证
  - [ ] 测试add_episode工具（存储会话记忆）
  - [ ] 测试search_facts工具（检索相关事实）
  - [ ] 测试search_nodes工具（搜索实体信息）
  - [ ] 测试get_episodes工具（获取历史对话）
  - [ ] 测试delete_episode和clear_graph工具

### 阶段二：分区记忆数据模型设计 (2-3天)

#### 2.1 扩展数据模型
- [ ] 在models.py中添加记忆分区相关模型：
  - `MemoryPartition`: 记忆分区模型（按ActionTask分区）
  - `ConversationMemory`: 会话记忆模型
  - `MemoryNode`: 记忆节点模型
  - `MemoryRelation`: 记忆关系模型
- [ ] 扩展现有GraphEnhancement模型，添加记忆配置状态字段：
  ```python
  # 在GraphEnhancement模型中添加
  memory_status = Column(JSON, default=dict)  # 记忆系统状态
  partition_config = Column(JSON, default=dict)  # 分区配置缓存
  ```

#### 2.2 设计分区策略（基于数据库配置）
- [ ] **任务级分区**：每个ActionTask作为一个独立的记忆分区
- [ ] **会话级子分区**：每个Conversation在任务分区内形成子分区
- [ ] **时间维度**：支持基于时间的记忆检索和更新
- [ ] **主题维度**：支持基于主题的记忆聚类
- [ ] **配置驱动**：分区策略完全由数据库配置决定，支持运行时调整

#### 2.3 记忆数据结构设计
```python
# 记忆分区结构（存储在数据库配置中）
{
    "partition_id": "task_123",
    "partition_type": "action_task",
    "config_source": "database",  # 标识配置来源
    "metadata": {
        "task_title": "项目讨论",
        "created_at": "2025-01-15T10:00:00Z",
        "participants": ["agent_1", "agent_2"],
        "partition_settings": {
            "max_nodes": 10000,
            "enable_time_decay": true,
            "importance_threshold": 0.3
        }
    },
    "conversations": [
        {
            "conversation_id": "conv_456",
            "title": "需求分析讨论",
            "memory_nodes": [...],
            "memory_relations": [...]
        }
    ]
}
```

### 阶段三：Graphiti集成服务开发 (3-4天)

#### 3.1 创建GraphitiMemoryService（配置驱动）
- [ ] 创建backend/app/services/graphiti_memory_service.py
- [ ] 实现基于数据库配置的Graphiti操作封装：
  - 动态配置加载和连接管理
  - 配置变更时的热重载机制
  - 节点和关系的CRUD操作
  - 分区管理功能
- [ ] 集成到现有GraphEnhancementService框架中

#### 3.2 实现记忆数据转换器
- [ ] 创建MemoryDataTransformer类
- [ ] 实现Message到Graphiti节点的转换逻辑
- [ ] 实现会话上下文到关系的转换逻辑
- [ ] 支持多模态数据（文本、图片、文件）的处理
- [ ] 基于数据库配置的转换参数调整

#### 3.3 实现分区记忆管理器
- [ ] 创建PartitionedMemoryManager类
- [ ] 实现分区创建、更新、删除功能
- [ ] 实现跨分区的记忆检索功能
- [ ] 实现记忆的时间衰减和重要性评分
- [ ] 支持配置驱动的分区策略切换

### 阶段四：记忆数据采集和存储 (2-3天)

#### 4.1 集成到现有会话流程
- [ ] 修改ConversationService，添加记忆采集钩子
- [ ] 在消息处理流程中集成记忆存储
- [ ] 实现实时记忆更新机制

#### 4.2 实现批量记忆导入
- [ ] 创建历史数据迁移脚本
- [ ] 实现现有会话数据到Graphiti的批量导入
- [ ] 支持增量更新和去重处理

#### 4.3 记忆质量控制
- [ ] 实现记忆重要性评分算法
- [ ] 添加记忆去噪和清理机制
- [ ] 实现记忆压缩和归档功能

### 阶段五：记忆检索和查询服务 (3-4天)

#### 5.1 实现多维度记忆检索
- [ ] **语义检索**：基于嵌入向量的相似性搜索
- [ ] **时间检索**：基于时间范围的记忆查询
- [ ] **关系检索**：基于实体关系的图遍历查询
- [ ] **混合检索**：结合多种检索策略的综合查询

#### 5.2 创建记忆查询API
- [ ] 设计RESTful API接口
- [ ] 实现查询参数验证和优化
- [ ] 添加查询结果排序和分页
- [ ] 实现查询缓存机制

#### 5.3 智能记忆推荐
- [ ] 实现基于上下文的记忆推荐
- [ ] 添加记忆关联度计算
- [ ] 实现个性化记忆排序

### 阶段六：前端界面开发 (3-4天)

#### 6.1 扩展图谱增强配置界面
- [ ] 在现有GraphEnhancementSettingsPage.js中添加记忆配置选项卡
- [ ] 实现Graphiti专用配置面板：
  - 数据库连接配置（Neo4j/FalkorDB选择和参数）
  - 记忆分区策略配置（任务级/会话级/混合模式）
  - 性能参数调优界面
  - 实时连接状态监控和测试功能

#### 6.2 记忆管理界面
- [ ] 创建记忆分区管理页面
- [ ] 实现记忆可视化展示（图谱视图）
- [ ] 添加记忆搜索和过滤功能
- [ ] 集成配置管理，支持界面直接修改记忆参数

#### 6.3 会话记忆集成
- [ ] 在会话界面中集成记忆提示
- [ ] 实现相关记忆的侧边栏展示
- [ ] 添加记忆引用和链接功能
- [ ] 基于当前配置的动态记忆推荐

#### 6.4 记忆分析仪表板
- [ ] 创建记忆统计和分析页面
- [ ] 实现记忆增长趋势图表
- [ ] 添加记忆质量评估指标
- [ ] 配置效果的可视化分析

### 阶段七：性能优化和测试 (2-3天)

#### 7.1 性能优化
- [ ] 实现记忆查询的索引优化
- [ ] 添加异步处理和队列机制
- [ ] 实现记忆数据的分片和负载均衡

#### 7.2 全面测试
- [ ] 单元测试：各个服务组件的功能测试
- [ ] 集成测试：端到端的记忆流程测试
- [ ] 性能测试：大数据量下的系统性能测试
- [ ] 用户测试：界面易用性和功能完整性测试

#### 7.3 文档和部署
- [ ] 编写API文档和使用说明
- [ ] 创建部署和配置指南
- [ ] 准备演示数据和示例

## 技术架构设计

### 核心组件架构（配置驱动）
```
┌─────────────────────────────────────────────────────────────┐
│                    前端界面层                                │
├─────────────────────────────────────────────────────────────┤
│  图谱增强配置界面  │  记忆管理界面  │  会话记忆集成         │
│  (扩展现有页面)    │  记忆分析仪表板  │  配置实时生效       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    API服务层                                │
├─────────────────────────────────────────────────────────────┤
│  配置管理API   │  记忆查询API   │  记忆管理API             │
│  (扩展现有)    │  记忆分析API   │  配置验证API             │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   业务逻辑层                                │
├─────────────────────────────────────────────────────────────┤
│ GraphEnhancementService │ GraphitiMemoryService │ 检索服务  │
│ (扩展现有)              │ PartitionedMemoryManager │ 配置服务 │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   数据存储层                                │
├─────────────────────────────────────────────────────────────┤
│    Neo4j/FalkorDB     │    PostgreSQL    │   向量数据库     │
│    (图谱存储)         │ (配置+元数据存储) │   (嵌入向量)     │
│                       │ GraphEnhancement  │                 │
└─────────────────────────────────────────────────────────────┘
```

### 配置驱动的数据流设计
1. **配置管理**：界面配置 → 数据库存储 → 服务热加载
2. **数据采集**：会话消息 → 配置驱动转换器 → 分区记忆管理器
3. **数据存储**：Graphiti图谱 + PostgreSQL配置/元数据 + 向量数据库
4. **数据检索**：配置驱动查询 → 结果融合 → 智能排序
5. **数据展示**：API接口 → 前端组件 → 用户界面

## 预期成果

### 功能特性
- ✅ 支持按任务和会话的分区记忆管理
- ✅ 多维度的记忆检索和查询能力
- ✅ 智能的记忆推荐和关联分析
- ✅ 直观的记忆可视化和管理界面
- ✅ 高性能的大规模记忆处理能力
- ✅ **界面化配置管理**：所有配置通过Web界面管理，无需修改代码
- ✅ **配置热更新**：配置变更实时生效，无需重启服务
- ✅ **多数据库支持**：支持Neo4j和FalkorDB的界面化切换

### 技术指标
- **记忆存储容量**：支持百万级记忆节点
- **查询响应时间**：平均 < 200ms
- **并发处理能力**：支持100+并发用户
- **数据准确性**：记忆检索准确率 > 90%

## 风险评估和应对策略

### 主要风险
1. **图数据库性能瓶颈**：大规模数据下的查询性能问题
2. **记忆质量控制**：噪声数据和低质量记忆的处理
3. **系统集成复杂性**：与现有系统的深度集成挑战

### 应对策略
1. **性能优化**：实现分片、缓存和索引优化
2. **质量控制**：建立记忆评分和过滤机制
3. **渐进集成**：采用分阶段集成和测试策略

## 总结

本计划将在现有ABM-LLM-v2系统基础上，构建一个功能完整、性能优异的分区记忆图谱系统。**核心特色是采用数据库配置驱动的架构**，所有Graphiti相关配置都通过Web界面管理，存储在数据库中，支持热更新和实时生效。

### 主要优势
- **无需环境变量**：所有配置通过界面管理，降低部署复杂度
- **配置可视化**：直观的配置界面，支持实时测试和验证
- **热更新机制**：配置变更无需重启，提升运维效率
- **扩展现有架构**：充分复用现有GraphEnhancement框架

预计总开发周期：**15-20个工作日**
核心开发人员：**2-3人**
测试和优化周期：**5-7个工作日**

## Instructions for Using Graphiti's MCP Tools for Agent Memory

### Before Starting Any Task

- **Always search first:** Use the `search_nodes` tool to look for relevant preferences and procedures before beginning work.
- **Search for facts too:** Use the `search_facts` tool to discover relationships and factual information that may be relevant to your task.
- **Filter by entity type:** Specify `Preference`, `Procedure`, or `Requirement` in your node search to get targeted results.
- **Review all matches:** Carefully examine any preferences, procedures, or facts that match your current task.

### Always Save New or Updated Information

- **Capture requirements and preferences immediately:** When a user expresses a requirement or preference, use `add_memory` to store it right away.
  - _Best practice:_ Split very long requirements into shorter, logical chunks.
- **Be explicit if something is an update to existing knowledge.** Only add what's changed or new to the graph.
- **Document procedures clearly:** When you discover how a user wants things done, record it as a procedure.
- **Record factual relationships:** When you learn about connections between entities, store these as facts.
- **Be specific with categories:** Label preferences and procedures with clear categories for better retrieval later.

### During Your Work

- **Respect discovered preferences:** Align your work with any preferences you've found.
- **Follow procedures exactly:** If you find a procedure for your current task, follow it step by step.
- **Apply relevant facts:** Use factual information to inform your decisions and recommendations.
- **Stay consistent:** Maintain consistency with previously identified preferences, procedures, and facts.

### Best Practices

- **Search before suggesting:** Always check if there's established knowledge before making recommendations.
- **Combine node and fact searches:** For complex tasks, search both nodes and facts to build a complete picture.
- **Use `center_node_uuid`:** When exploring related information, center your search around a specific node.
- **Prioritize specific matches:** More specific information takes precedence over general information.
- **Be proactive:** If you notice patterns in user behavior, consider storing them as preferences or procedures.

**Remember:** The knowledge graph is your memory. Use it consistently to provide personalized assistance that respects the user's established preferences, procedures, and factual context.
