# Graphiti 记忆系统集成计划

## 重要说明：系统定位

### Graphiti vs LightRAG 的区别

**Graphiti（本文档）- 记忆系统（Memory）**
- **用途**：智能体的短期/长期记忆
- **数据来源**：对话过程自动同步
- **数据类型**：对话历史、用户偏好、事实关系
- **生命周期**：会话级/任务级，动态更新
- **调用方式**：Memory能力自动注入，智能体透明使用
- **使用场景**：上下文记忆、用户偏好学习、历史交互追溯
- **存储方式**：Neo4j图数据库
- **分区策略**：按任务/角色/智能体/空间分区（使用group_id）

**LightRAG - 知识库系统（Knowledge Base）**
- **用途**：结构化知识存储和检索
- **数据来源**：用户主动上传的文档、资料
- **数据类型**：PDF、Word、Markdown等文档，专业知识库
- **生命周期**：持久化存储，长期有效
- **调用方式**：智能体通过知识库工具主动查询
- **使用场景**：RAG增强、专业知识问答、文档检索
- **存储方式**：向量数据库 + 知识图谱混合存储
- **分区策略**：按知识库workspace隔离

### 核心区别总结

| 维度 | Graphiti (记忆) | LightRAG (知识库) |
|------|----------------|------------------|
| **定位** | 内部记忆系统 | 外部知识源 |
| **数据来源** | 对话自动同步 | 文档上传 |
| **更新方式** | 被动记录 | 主动导入 |
| **查询方式** | 隐式能力注入 | 显式工具调用 |
| **数据持久性** | 可配置清理 | 永久存储 |
| **典型问题** | "你记得我上次说的吗？" | "文档里怎么说的？" |

**重要**：这两个系统是**独立且互补**的，不应混淆：
- Graphiti 提供**内部记忆**（"我记得什么"）
- LightRAG 提供**外部知识**（"我知道什么"）

---

## 概述

将 Graphiti 记忆系统按任务分区集成到现有系统中，为所有角色提供 memory 能力，实现智能的对话记忆存储和检索。

**注意**：本文档仅涉及 Graphiti 记忆系统。LightRAG 知识库系统请参考 [lightrag-PLAN.md](../feature-knowledge-base/lightrag-PLAN.md)。

## 核心目标（按优先级排序）

### 🔥 高优先级（核心功能，必须优先实现）

1. **Memory能力抽象**：通过添加memory能力来集成图谱增强工具，而非直接生成工具定义
   - 依赖：无
   - 后续依赖：开关控制、MCP集成

2. **开关控制**：图谱增强开关启用时，所有角色自动具备memory能力；关闭时移除memory能力
   - 依赖：Memory能力抽象
   - 后续依赖：配置响应

3. **记忆分区管理**：提供记忆分区的配置界面，从图谱增强设置迁移到独立的记忆管理页面
   - 依赖：无（需要先有界面才能配置分区策略）
   - 后续依赖：分区标识符生成、可视化展示

4. **分区标识符生成**：根据分区策略生成正确的分区标识符（Graphiti使用group_id参数）
   - 依赖：记忆分区管理（需要从界面获取分区策略配置）
   - 后续依赖：自动注入、消息同步

5. **MCP集成**：配置 Graphiti MCP 服务器工具（graphiti-server）
   - 依赖：Memory能力抽象
   - 后续依赖：自动注入

6. **自动注入**：在工具调用时自动注入正确的分区标识符，无需智能体手动指定
   - 依赖：分区标识符生成、MCP集成
   - 后续依赖：无

7. **消息同步**：在智能体回复完成（agentDone）后，将完整的对话轮次通过server URL的/messages接口自动POST到记忆中
   - 依赖：分区标识符生成
   - 后续依赖：无

### ⚡ 中优先级（用户体验功能）

8. **可视化展示**：提供分区记忆的图谱可视化界面，支持按分区浏览和管理记忆内容
   - 依赖：记忆分区管理、消息同步（有数据后才能可视化）
   - 后续依赖：无

### 默认分区策略
如果用户未配置分区策略，系统使用以下默认行为：
- **默认策略**：按行动空间分区（`by_space`）
- **默认标识符**：`actionspace-{action_space_id}`
- **配置存储**：在数据库中存储分区策略配置，初始值为默认策略

### �🔧 低优先级（系统完善和扩展）

9. **配置响应**：配置变更时自动更新能力状态和工具定义，确保系统状态一致性
   - 依赖：开关控制、MCP集成
   - 后续依赖：无

10. **框架扩展**：实现LightRAG和GraphRAG的MCP服务器，统一所有框架的调用方式
    - 依赖：MCP集成（Graphiti实现完成后）
    - 后续依赖：无

## 技术架构

### 分区策略
分区策略通过记忆系统配置中的分区设置控制，与前端设置页面保持一致：
```python
# 根据配置的分区策略生成分区标识符（group_id）
PARTITION_STRATEGIES = {
    "by_space": "actionspace-{action_space_id}",
    "global": "default",
    "by_task": "actiontask-{action_task_id}",
    "by_role": "role-{role_id}",
    "by_agent": "agent-{agent_id}"
}
```

### 能力集成架构
```
图谱增强开关启用 → 添加memory能力 → 关联对应MCP服务器工具
```

### MCP服务器配置
- **Graphiti MCP Server**：`graphiti-server` (localhost:8000) ✅ 已实现
  - 分区机制：基于 `group_id` 参数
  - 工具集：`search_nodes`, `search_facts`, `add_memory` 等
  
**注意**：LightRAG 是独立的知识库系统，不在本记忆系统集成范围内。

## 实施计划

### 阶段一：核心功能实现 (优先级：高)

#### 1.1 分区标识符生成
- **文件**：`backend/app/services/memory_partition_service.py`
- **功能**：根据记忆系统配置生成 group_id
- **实现**：
  ```python
  def get_partition_identifier(strategy: str, context: dict) -> str:
      """根据分区策略生成 Graphiti 的 group_id"""
      template = PARTITION_STRATEGIES.get(strategy, PARTITION_STRATEGIES["by_space"])
      
      # 使用context中的值替换模板变量
      return template.format(**context)
  ```

#### 1.2 Memory能力动态管理
- **文件**：`backend/app/services/memory_service.py`
- **功能**：根据记忆系统开关动态管理memory能力
- **实现**：`manage_memory_capability(enabled: bool)`
- **逻辑**：
  1. 检查 Graphiti 记忆系统开关状态
  2. 如果启用：为所有角色添加memory能力，配置 graphiti-server MCP服务器
  3. 如果关闭：移除所有角色的memory能力，清理相关配置
  4. 更新前端界面提示状态

#### 1.3 Memory能力描述配置
- **文件**：`backend/seed_data_capabilities.json`
- **功能**：在memory能力的描述中包含详细的Graphiti MCP工具使用说明
- **内容**：包含完整的工具使用指南，涵盖：
  - 任务开始前的搜索策略（search_nodes, search_facts）
  - 信息保存的最佳实践（add_memory）
  - 工作过程中的一致性要求
  - 知识图谱的高效使用方法
- **优势**：能力系统会自动将此详细描述添加到系统提示词中，确保智能体正确使用memory工具

#### 1.4 工具调用参数注入
- **文件**：`backend/app/services/conversation/tool_handler.py`
- **功能**：在 `handle_tool_call()` 中自动注入 group_id
- **逻辑**：
  1. 识别来自 `graphiti-server` MCP服务器的记忆工具
  2. 获取记忆系统配置中的分区策略
  3. 根据分区策略和会话上下文生成 group_id
  4. 自动添加 group_id 参数到工具调用中

#### 1.5 消息自动同步到记忆
- **文件**：`backend/app/services/conversation/message_processor.py`
- **功能**：在智能体回复完成后自动将完整对话轮次同步到 Graphiti 记忆系统
- **触发时机**：智能体回复完成（agentDone状态）后
- **同步策略**：
  - **等待完整轮次**：不在每条消息发送时同步，而是等待agent完成回复
  - **批量同步**：将用户消息和智能体回复作为一个完整的对话轮次进行同步
  - **异步处理**：使用异步方式避免影响用户体验
- **实现逻辑**：
  1. 监听智能体回复完成事件（agentDone）
  2. 检查 Graphiti 记忆系统是否启用
  3. 获取配置的 Graphiti server URL 和分区策略
  4. 根据分区策略生成 group_id
  5. 收集对话轮次中的用户消息和智能体回复
  6. 为每条消息生成UUID和时间戳
  7. 构建完整对话轮次的标准化消息格式：
     ```json
     {
       "group_id": "actiontask-123",
       "messages": [
         {
           "content": "用户消息内容",
           "uuid": "user_message_uuid",
           "name": "用户名",
           "role_type": "user",
           "role": "user",
           "timestamp": "2025-08-01T13:19:21.774Z",
           "source_description": "用户输入"
         },
         {
           "content": "智能体回复内容",
           "uuid": "agent_message_uuid",
           "name": "智能体名称",
           "role_type": "assistant",
           "role": "assistant",
           "timestamp": "2025-08-01T13:19:25.774Z",
           "source_description": "智能体回复"
         }
       ]
     }
     ```
  8. 异步POST到 `{graphiti_server_url}/messages` 接口

### 阶段二：能力管理系统 (优先级：高)

#### 2.1 Memory能力定义
- **文件**：`backend/seed_data_capabilities.json`
- **功能**：在能力种子数据中添加memory能力
- **配置**：
  ```json
  {
    "name": "memory",
    "description": "## Instructions for Using Graphiti's MCP Tools for Agent Memory\n\n### Before Starting Any Task\n\n- **Always search first:** Use the `search_nodes` tool to look for relevant preferences and procedures before beginning work.\n- **Search for facts too:** Use the `search_facts` tool to discover relationships and factual information that may be relevant to your task.\n- **Filter by entity type:** Specify `Preference`, `Procedure`, or `Requirement` in your node search to get targeted results.\n- **Review all matches:** Carefully examine any preferences, procedures, or facts that match your current task.\n\n### Always Save New or Updated Information\n\n- **Capture requirements and preferences immediately:** When a user expresses a requirement or preference, use `add_memory` to store it right away.\n  - _Best practice:_ Split very long requirements into shorter, logical chunks.\n- **Be explicit if something is an update to existing knowledge.** Only add what's changed or new to the graph.\n- **Document procedures clearly:** When you discover how a user wants things done, record it as a procedure.\n- **Record factual relationships:** When you learn about connections between entities, store these as facts.\n- **Be specific with categories:** Label preferences and procedures with clear categories for better retrieval later.\n\n### During Your Work\n\n- **Respect discovered preferences:** Align your work with any preferences you've found.\n- **Follow procedures exactly:** If you find a procedure for your current task, follow it step by step.\n- **Apply relevant facts:** Use factual information to inform your decisions and recommendations.\n- **Stay consistent:** Maintain consistency with previously identified preferences, procedures, and facts.\n\n### Best Practices\n\n- **Search before suggesting:** Always check if there's established knowledge before making recommendations.\n- **Combine node and fact searches:** For complex tasks, search both nodes and facts to build a complete picture.\n- **Use `center_node_uuid`:** When exploring related information, center your search around a specific node.\n- **Prioritize specific matches:** More specific information takes precedence over general information.\n- **Be proactive:** If you notice patterns in user behavior, consider storing them as preferences or procedures.\n\n**Remember:** The knowledge graph is your memory. Use it consistently to provide personalized assistance that respects the user's established preferences, procedures, and factual context.",
    "type": "mcp_integration",
    "mcp_servers": ["graphiti-server"]
  }
  ```
- **同步更新**：确保数据库迁移脚本也包含此能力定义

#### 2.2 MCP服务器配置管理
- **文件**：`backend/app/services/memory_service.py`
- **功能**：配置 Graphiti MCP 服务器
- **配置**：
  ```python
  MEMORY_MCP_SERVER = 'graphiti-server'  # 已实现
  ```
- **说明**：Graphiti 是唯一的记忆系统，LightRAG 是独立的知识库系统

### 阶段三：记忆分区管理和可视化 (优先级：中)

#### 3.1 记忆分区配置页面
- **路由**：`/memory/partitions` 记忆分区管理页面
- **功能**：Graphiti 记忆系统的分区配置和可视化

#### 3.2 记忆分区API接口
- **文件**：`backend/app/api/routes/memory_management.py`
- **功能**：提供记忆分区的配置和数据管理
- **接口**：
  ```python
  # 分区设置Tab相关接口
  @memory_bp.route('/memory/partition-config', methods=['GET', 'POST'])
  def manage_partition_config():
      """获取和设置记忆分区配置"""

  @memory_bp.route('/memory/partition-strategies', methods=['GET'])
  def get_partition_strategies():
      """获取可用的分区策略列表"""

  # 按分区浏览Tab相关接口
  @memory_bp.route('/memory/partitions', methods=['GET'])
  def list_memory_partitions():
      """获取所有可用的记忆分区列表"""

  @memory_bp.route('/memory/partition/<partition_id>/graph', methods=['GET'])
  def get_partition_memory_graph(partition_id):
      """获取指定分区的记忆图谱数据"""
      # 返回节点和边的数据，适合前端图谱渲染

  @memory_bp.route('/memory/partition/<partition_id>/search', methods=['POST'])
  def search_partition_memory(partition_id):
      """在指定分区中搜索记忆内容"""
  ```

#### 3.3 图谱数据格式标准化
- **功能**：定义前端图谱渲染所需的数据格式
- **格式**：
  ```json
  {
    "nodes": [
      {
        "id": "node_uuid",
        "label": "节点名称",
        "type": "Preference|Procedure|Requirement|Entity",
        "properties": {...}
      }
    ],
    "edges": [
      {
        "source": "source_node_id",
        "target": "target_node_id",
        "relationship": "关系类型",
        "properties": {...}
      }
    ]
  }
  ```

### 阶段四：配置管理优化 (优先级：中)

#### 4.1 配置变更监听
- **文件**：`backend/app/services/memory_service.py`
- **功能**：监听 Graphiti 记忆系统配置变更
- **实现**：
  ```python
  class MemoryConfigWatcher:
      @staticmethod
      def on_config_change(old_config, new_config):
          # 更新角色能力关联
          # 更新 Graphiti MCP 服务器配置
          # 清理相关缓存
  ```

#### 4.2 角色能力动态管理
- **文件**：`backend/app/services/role_capability_service.py`
- **功能**：动态添加/移除角色的memory能力
- **触发时机**：
  - Graphiti 记忆系统开关变更（启用时添加，关闭时移除）
  - 分区策略变更（更新group_id生成逻辑）
  - 新角色创建时根据开关状态决定是否启用memory能力

### 阶段五：错误处理和回退 (优先级：中)

#### 5.1 服务不可用处理
- **场景**：Graphiti 服务器离线或配置错误
- **策略**：优雅降级，不影响基础对话功能
- **实现**：
  - 在工具调用失败时返回友好错误信息
  - 记录错误日志便于排查

#### 5.2 数据备份和恢复
- **场景**：Neo4j 数据库维护或迁移
- **策略**：提供数据导出/导入工具（可选）

## 关键文件修改清单

### 核心服务文件
1. `backend/app/services/graph_enhancement_service.py`
   - 添加 `get_group_id_by_strategy()` 根据配置生成group_id
   - 添加 `manage_memory_capability()` 动态管理memory能力
   - 添加 MCP服务器映射配置
   - 添加配置变更监听和能力状态同步

2. `backend/app/services/conversation/message_processor.py`
   - 现有的能力系统已自动处理memory能力描述
   - 添加智能体回复完成后的消息同步功能
   - 监听agentDone事件，批量同步完整对话轮次

3. `backend/app/services/conversation/tool_handler.py`
   - 修改 `handle_tool_call()` 根据分区策略自动注入 group_id
   - 识别图谱增强相关的MCP服务器工具

### API接口文件
4. `backend/app/api/routes/memory_management.py`
   - 新建记忆分区管理API接口
   - 提供分区配置、分区列表和图谱数据接口

### 能力管理文件
5. `backend/seed_data_capabilities.json`
   - 添加memory能力的种子数据定义
   - 包含完整的能力描述和MCP服务器映射

6. `backend/app/services/role_capability_service.py`
   - 新建角色能力动态管理服务
   - 处理memory能力的添加和移除

### 配置管理文件
7. `backend/app/api/routes/graph_enhancement.py`
   - 在配置保存时触发能力更新
   - 管理MCP服务器配置切换
   - 处理开关状态变更时的能力同步

### 前端界面文件
8. `frontend/src/pages/settings/GraphEnhancementSettingsPage.js`
   - 移除记忆分区配置部分（迁移到记忆管理页面）
   - 保留图谱增强开关和框架选择
   - 显示memory能力状态提示
   - 关闭开关时显示能力移除警告

9. `frontend/src/pages/memory/MemoryPartitionPage.js` ⭐ 新建
   - 使用Tabs组件包含两个主要功能
   - **Tab 1: 分区设置**
     - 记忆分区配置管理界面
     - 分区策略选择（按行动空间、混合分区、按任务、按角色、按智能体）
     - 默认分区策略为按行动空间分区
     - 支持不同框架的分区机制（Graphiti的group_id，LightRAG的workspace）
     - 分区策略保存和应用功能
   - **Tab 2: 按分区浏览**
     - 分区列表展示和选择
     - 按分区展示记忆内容的图谱可视化
     - 支持分区切换和实时更新
     - 提供记忆节点的交互式浏览
     - 显示实体关系和事实连接
     - 集成图谱渲染库（如D3.js、Cytoscape.js等）
     - 记忆内容的搜索和过滤功能

## 测试计划

### 单元测试
- 不同分区策略的group_id生成测试
- Memory能力开关控制测试（添加/移除）
- Memory能力种子数据加载测试
- Memory能力描述自动添加测试
- MCP服务器映射测试
- 参数注入逻辑测试
- 配置变更时的能力同步测试
- agentDone事件监听和消息同步策略测试

### 集成测试
- Graphiti MCP服务器工具调用测试
- LightRAG/GraphRAG直接调用回退测试
- 不同分区策略下的数据隔离测试
- 开关状态变更后的能力同步测试
- Memory能力在角色中的正确集成测试
- 分区策略变更时的group_id更新测试
- 混合模式下的工具调用测试
- 完整对话轮次的消息同步测试
- agentDone触发的批量同步测试
- 分区记忆可视化API接口测试
- 前端图谱渲染和交互测试

### 用户验收测试
- 图谱增强开关功能测试（启用/关闭时的能力变化）
- Graphiti框架的完整MCP集成测试
- LightRAG/GraphRAG框架的直接调用测试
- Memory工具在对话中的使用测试
- 界面提示和警告信息显示测试
- **记忆分区页面功能测试**：
  - 分区设置Tab：策略选择、配置保存、默认值设置
  - 按分区浏览Tab：分区列表、图谱可视化、搜索过滤
  - Tab切换和状态保持测试
- 记忆节点和关系的交互式浏览测试
- 不同框架分区机制的兼容性测试

## 风险评估

### 高风险
- **数据隔离失效**：分区策略配置错误或group_id注入失败导致数据混乱
- **能力状态不一致**：开关变更时部分角色的memory能力状态未正确同步
- **MCP服务器故障**：第三方服务器不可用影响功能

### 中风险
- **配置同步**：多实例部署时分区策略和能力状态同步问题
- **服务器映射错误**：图谱类型与MCP服务器映射不正确
- **分区策略变更**：变更分区策略时现有数据的处理
- **性能影响**：大量memory操作影响响应速度

### 低风险
- **向后兼容**：新功能对现有功能的影响
- **工具冲突**：不同MCP服务器工具名称冲突

## 成功标准

1. **能力集成完整性**：所有图谱框架通过memory能力正确集成
2. **开关控制准确**：开关启用时所有角色获得memory能力，关闭时完全移除
3. **分区隔离有效**：根据配置的分区策略实现数据完全隔离
4. **配置响应及时**：配置变更后能力状态和MCP服务器映射实时更新
5. **MCP集成稳定**：第三方MCP服务器（如RAGFlow）集成稳定
6. **界面提示清晰**：开关状态、能力状态、分区策略在界面中清晰显示
7. **性能稳定**：memory功能不影响基础对话性能

## 实施优先级说明

### 当前状态
- ✅ **Graphiti MCP服务器**：已实现，可直接集成
- ⏳ **LightRAG MCP服务器**：待实现，暂时使用直接调用
- ⏳ **GraphRAG MCP服务器**：待实现，暂时使用直接调用

### 实施建议
1. **优先实现Graphiti集成**：基于现有MCP服务器快速验证整体方案
2. **支持混合模式**：同时支持MCP调用和直接调用，确保所有框架可用
3. **后续完善MCP服务器**：根据需要逐步实现LightRAG和GraphRAG的MCP服务器

## 后续扩展

1. **跨分区搜索**：支持在特定权限下跨分区搜索memory
2. **分区策略扩展**：支持更复杂的分区策略（如混合分区）
3. **记忆分析**：提供memory使用统计和分析功能
4. **批量操作**：支持批量添加和管理memory内容
5. **记忆导出**：支持将分区memory导出为结构化数据
6. **分区迁移**：支持在不同分区策略间迁移数据
7. **完整MCP统一**：实现所有框架的MCP服务器，统一调用方式

## 关键依赖关系和实施建议

### 调整后的开发路径
- **路径A**：Memory能力抽象 → 开关控制 → MCP集成
- **路径B**：记忆分区管理 → 分区标识符生成 → 自动注入 / 消息同步
- **路径C**：可视化展示（依赖路径B完成）

### 关键节点
- **记忆分区管理**：是分区功能的前提，必须优先实现
- **分区标识符生成**：依赖分区管理界面的配置
- **MCP集成**：是工具调用的核心
- **消息同步**：为可视化提供数据基础

### 实施建议

1. **第一阶段**：实现Memory能力抽象、开关控制、记忆分区管理界面
2. **第二阶段**：实现分区标识符生成、MCP集成、自动注入、消息同步
3. **第三阶段**：实现可视化展示、配置响应、框架扩展

### 为什么记忆分区管理必须优先？
- **配置来源**：分区标识符生成需要从界面获取用户配置的分区策略
- **默认值管理**：界面提供默认分区策略的设置和修改
- **用户体验**：用户需要先了解和配置分区策略，才能有效使用记忆功能
- **系统完整性**：没有分区配置，整个记忆系统无法正常工作
