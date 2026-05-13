增加一个并行任务，可以是纯任务，不是实验的
ODM
SUBagent — [计划文档](docs/feature-subagent/PLAN.md) — ✅ Phase 1 MVP 已实现
  - ✅ 后端：SubAgent 执行引擎（executor/context_builder/security）
  - ✅ 后端：MCP 工具（invoke_agent/invoke_agents/list_available_agents）
  - ✅ 后端：MCPServerManager 注册 + mcp_config.json + prompt 注入
  - ✅ 前端：SubAgentResultCard 专用卡片 + ConversationExtraction 集成
  - ✅ 前端：AutonomousTaskModal SubAgent 开关
  - [ ] Phase 2: 嵌套支持（SubAgent 带工具调用）、ODM 约束、Token 统计
  - [ ] Phase 3: 调用关系可视化、结果缓存、配置模板

## BUG

- [ ] 普通自主任务没能停止
- [ ] 自主任务的触发源
- [ ] Error processing response: Request failed with status code 400，报错后没有直接返回报错，而且无法中止

- [ ] 自动分配模式，根据用户的内容自动选择最佳角色进行回复

## 核心功能模块

### 1. 编排模式（Workflow Graph）⭐ 核心战略功能

**详细方案**: [docs/feature-workflow-graph/PLAN.md](docs/feature-workflow-graph/PLAN.md)

在行动空间详情页新增"编排"Tab，支持 ReactFlow 可视化定义智能体协作流程。

**核心特性**:
- 可视化节点编排（智能体/条件/并行/循环）
- 跨行动空间编排（联合空间变量传播）
- 与实体应用市场集成（NetLogo/VSCode/GIS/RPA）
- 编排模板市场

**实现状态**: 🔄 规划中

---

### 2. PLANNER 功能

智能体计划管理功能，允许智能体创建、更新和查询结构化执行计划。

**实现状态**:
- ✅ 后端模型和API（ConversationPlan, ConversationPlanItem）
- ✅ MCP工具（create_plan, update_plan_item, get_plan）
- ✅ 前端UI组件（PlannerPanel）
- ✅ SSE实时更新
- [ ] 子规划模式，可以查看当前会话的历史计划，从而进行嵌套，不同的role可以同时进行不同子任务



---

### 3. LightRAG 知识库集成

**详细方案**: [docs/feature-knowledge-base/lightrag-PLAN.md](docs/feature-knowledge-base/lightrag-PLAN.md)

集成 LightRAG 轻量级 RAG 框架，提供知识图谱增强的长期记忆能力。

**实现状态**:
- ✅ 基础实现：`backend/app/services/graph_enhancement/lightrag_service.py`
- ✅ API路由：`backend/app/api/routes/graph_enhancement.py`
- ⚠️ 功能不完整

**待办**:
- [ ] 完善文档导入（批量上传、增量更新）
- [ ] 分区隔离（conversation/agent/global）
- [ ] 前端UI完善
- [ ] MCP工具集成

---

### 4. ABM 集成（Mesa 和 NetLogo）

实现智能体系统与基于代理的模拟（ABM）的双向通信。

**现状**:
- ✅ NetLogo集成：`third_party/Galapagos`
- ❌ Mesa集成：待开发

**待办**:
- [ ] Mesa适配器
- [ ] MCP Server（mesa_server.py, netlogo_server.py）
- [ ] 统一ABM桥接服务
- [ ] 前端可视化集成

---

### 5. Agent API 暴露

为外部系统提供标准化的 Agent API 接口。

**待办**:
- [x] `api/routes/agent_api.py`
- [x] API Key管理
- [x] 认证和速率限制中间件
- [x] Python客户端SDK
- [x] OpenAPI文档

**实现状态**: ✅ 已完成

---

### 7. 真正的并行智能体执行

**问题现状**：当前的 `parallel` 执行模式虽然使用了 `asyncio.gather`，但存在以下限制：
- 所有智能体共享同一个 SSE 流，输出会交错混乱
- 没有独立的上下文隔离
- 前端无法区分不同智能体的并行输出

**目标**：实现真正的多智能体同步执行，每个智能体独立运行、独立输出。

**实现方案**：

```python
# 方案1：多流并行（推荐）
async def _execute_true_parallel(task: 'Task') -> None:
    """
    真正的并行执行：每个Agent有独立的输出流
    """
    agents = await _get_task_agents(task)
    
    # 为每个Agent创建独立的输出队列
    agent_queues = {
        agent['id']: asyncio.Queue() 
        for agent in agents
    }
    
    # 并行执行所有Agent
    async def execute_agent_with_queue(agent, queue):
        task_copy = copy.copy(task)
        task_copy.result_queue = queue
        await _process_agent_response(task_copy, agent)
    
    await asyncio.gather(*[
        execute_agent_with_queue(agent, agent_queues[agent['id']])
        for agent in agents
    ])
    
    # 合并结果
    return merge_agent_outputs(agent_queues)

# 方案2：多会话并行
# 每个Agent在独立的Conversation中执行，最后汇总
```

**前端支持**：
- 多列/多窗口显示并行智能体输出
- 实时进度指示器
- 结果汇总视图

**待办**：
- [ ] 实现独立输出队列的并行执行
- [ ] 前端多流显示组件
- [ ] 并行结果合并策略
- [ ] 并行执行的取消和超时处理

**实现状态**: ❌ 待开发

---

## 实现路线图

### Phase 1: 编排基础（当前）
- [x] 现有调度器框架
- [ ] ReactFlow 可视化编排
- [ ] ActionSpace 编排 Tab
- [ ] 基础节点类型（agent/condition/parallel/loop）

### Phase 2: 深度集成（Q1 2025）
- [ ] 跨行动空间编排
- [ ] 联合空间变量传播
- [ ] 实体应用市场集成（NetLogo/VSCode/GIS）
- [ ] 编排模板市场

### Phase 3: NVIDIA 生态集成（Q2 2025）
- [ ] NIM 微服务作为推理后端
- [ ] Nemotron 模型支持
- [ ] GPU 资源管理基础

### Phase 4: 物理仿真桥接（Q3 2025）
- [ ] Isaac Sim 基础集成
- [ ] 物理-认知状态同步
- [ ] 仓库/工厂场景 Demo
- [ ] Mesa Python ABM 集成

### Phase 5: 数字人可视化（Q4 2025）
- [ ] ACE Avatar 集成
- [ ] 多角色数字人会议
- [ ] 语音交互支持

### Phase 6: 企业级增强（2026）
- [ ] **5000 并发架构** — [详细方案](docs/feature-parallellab/PLAN-5000-concurrency.md)
  - [ ] Phase 1: 异步化改造（500 并发）— model_client/executor → asyncio
  - [ ] Phase 2: Redis 队列 + Worker 分离（2000 并发）
  - [ ] Phase 3: 分布式多机部署（5000+ 并发）
- [ ] 大规模仿真优化（1000+ 智能体）
- [ ] 合成数据生成管线
- [ ] 企业私有化部署方案
- [ ] 多租户支持

---

## OAUTH对接（Google/Meta/AWS/Apple）

## 在行动空间中临时增加智能体

## 前端优化
- [ ] DeepSeek 的 mermaid 渲染
- [ ] 集中前后端环境变量管理

## 后端优化
- [ ] Flask 使用 gunicorn/gevent 运行
- [ ] Token 用量统计
- [ ] API 暴露（OpenAI 兼容，行动空间/agent/知识库）

## 集成扩展
- [ ] 集成 supergateway（stdio → SSE）
- [ ] 外部 IM 对接（微信/钉钉）
- [ ] colnomic 嵌入模型（图片嵌入）

## 实体应用
- [ ] RPG Game 实体应用
- [ ] RPA（海关场景）[计划文档](docs/feature-nextrpa/PLAN.md)
- [ ] GIS 地图 MCP 工具集成
  - 集成 gis-mcp 服务器（已安装）
  - **方案B（消息解析，简单）**：
    - AI Agent 调用 gis-mcp 返回 GeoJSON/WKT
    - 前端解析对话消息中的地理数据格式
    - 自动传递给 GISApp 渲染
    - 优点：实现简单，无需新增 MCP 工具
  - **方案C（专用工具，完整）**：
    - 创建专用的地图操作 MCP 工具：
      - `add_map_layer` - 添加图层到 GISApp（支持 GeoJSON/WKT）
      - `clear_map_layers` - 清除地图图层
      - `set_map_view` - 设置地图视角（中心点、缩放级别）
      - `add_map_marker` - 添加标记点
      - `draw_map_geometry` - 绘制几何图形（多边形、线、圆）
    - GISApp 前端监听变量变化，实时渲染
    - 优点：AI 可直接操作地图，体验最佳
  - 工作流：AI Agent → gis-mcp 计算 → (方案B: 消息解析 / 方案C: 地图工具) → GISApp 渲染

---

## 已完成功能

- [x] 自主任务改为编排框架
- [x] 总结上下文消息优化（去掉工具调用参数）
- [x] print → logger 迁移
- [x] Claude `<tool_call>` 调用完善

---

## 相关文档索引

| 功能 | 文档路径 |
|------|---------|
| 编排模式 | [docs/feature-workflow-graph/PLAN.md](docs/feature-workflow-graph/PLAN.md) |
| 并行实验室 | [docs/feature-parallellab/PLAN-parallellab.md](docs/feature-parallellab/PLAN-parallellab.md) |
| LightRAG | [docs/feature-knowledge-base/lightrag-PLAN.md](docs/feature-knowledge-base/lightrag-PLAN.md) |
| 知识库本地索引 | [docs/feature-knowledge-base/PLAN-localindex.md](docs/feature-knowledge-base/PLAN-localindex.md) |
| 实体应用市场 | [docs/feature-market/PLAN-market.md](docs/feature-market/PLAN-market.md) |
| 关键资源关系 | [docs/key-arch/KEY-RESOURCES-RELATIONS.md](docs/key-arch/KEY-RESOURCES-RELATIONS.md) |
| 产品特性 | [docs/key-arch/FEATURES.md](docs/key-arch/FEATURES.md) |
| ODM 框架 | [docs/feature-odm/plan.md](docs/feature-odm/plan.md) |
| SubAgent | [docs/feature-subagent/PLAN.md](docs/feature-subagent/PLAN.md) |
| 5000并发架构 | [docs/feature-parallellab/PLAN-5000-concurrency.md](docs/feature-parallellab/PLAN-5000-concurrency.md) |

---

## 竞争力定位

```
┌─────────────────────────────────────────────────────────────────┐
│                    ABM-LLM 核心竞争力                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 认知仿真层（填补 NVIDIA 空白）                               │
│     - 多智能体协作决策                                          │
│     - 社会/经济/组织建模                                        │
│     - LLM 驱动的认知行为                                        │
│                                                                 │
│  2. 跨空间编排（独创）                                          │
│     - 多行动空间联动                                            │
│     - 变量传播和影响链                                          │
│     - 复杂系统仿真                                              │
│                                                                 │
│  3. 实体应用生态                                                │
│     - NetLogo/Mesa ABM 集成                                     │
│     - 开发工具集成                                              │
│     - 编排模板市场                                              │
│                                                                 │
│  4. NVIDIA 生态兼容                                             │
│     - NIM 推理后端                                              │
│     - Isaac Sim 物理仿真桥接                                    │
│     - ACE 数字人可视化                                          │
│                                                                 │
│  5. 企业级特性                                                  │
│     - 监督者机制（可控 AI）                                     │
│     - 并行实验室（参数优化）                                    │
│     - 合成数据生成                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
