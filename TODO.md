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
- [ ] RPA（政务场景）[计划文档](docs/feature-nextrpa/PLAN.md)
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

## 历史债 / Refactor backlog (model-config 系列)

> 由 2026-05-19 "拆 custom_headers / custom_body" PR 收尾时盘点出。背景见
> `docs/agents/failures/2026-05-19-additional-params-as-junk-drawer.md`。
> 顺序很重要：PR2 → PR3 → PR4 → PR5（不能并行做）。每项都必须自带测试。

### PR2 — `embedding_service.py` 包归位（路径错位）

- **现象**：通用 embedding 服务住在 `app/services/vector_db_tidb/`，被 7 处反向 import（含 `vector_db_milvus.py`）。它和 TiDB 没有耦合。
- **解法**：移到 `app/services/embedding/embedding_service.py`，与 `vector_db_*` 并列；删除空的 `app/utils/embedding.py`（0 行占位文件，无可合并实现）。
- **不留 compat shim**（AGENTS.md §3.2）：一次性改完 7 处 import。
- **测试**：
  - `tests/contract/imports/test_embedding_import_path.py`：断言 `from app.services.embedding import embedding_service` 工作，且 backend Python 源码不再有旧的 `app.services.vector_db_tidb.embedding_service` 残留（ripgrep 断言）。
  - 既有 knowledge_base 路径的 integration 测试跑通。

### PR3 — embedding HTTP 调用 async 化（违反 backend AGENTS §3.1）

- **现象**：`_generate_embeddings_openai_api` / `_generate_embeddings_ollama_api` 用同步 `requests.post`，阻塞 event loop。
- **解法**：换 `httpx.AsyncClient`，调用方加 `await`；调用面：`knowledge_vectorizer*.py`、`document_processor.py`、`vector_db_milvus.py`。
- **测试**：
  - `tests/unit/services/embedding/test_async.py`：assert 不再 import `requests`，函数是 `async def`。
  - `tests/integration/services/embedding/test_concurrent_calls.py`：`asyncio.gather` 一批请求耗时近似单次（验证 event loop 没被阻塞）。

### PR4 — `additional_params` 灭活（最重的一项）⭐

> **核心理念**：HTTP 出站只有 header / body / URL query 三个槽。`additional_params` 当前承载的 4 种用法都不是"第三种合法槽"，是错位：
> 1. `dimensions` (embedding HTTP body) → 应该走 `custom_body`
> 2. `use_fp16` / `batch_size` (reranker 本地构造器参数) → 不属于 ModelConfig
> 3. `embedding_dim` (LightRAG 子进程 env var) → 不属于 ModelConfig
>
> 它存在的代价：用户看到模型设置里有"附加参数"框，以为可以塞 `temperature`，但永远不会生效，无任何报错——这是产品体验的暗坑。

- **解法**：
  1. **数据迁移（Alembic）**：把所有 `model_configs.additional_params.dimensions` 搬到 `custom_body.dimensions`。
  2. `use_fp16` / `batch_size` → 迁到 `SystemSetting`（已有 KV 表）或新建 `RerankerSettings` 表，按 reranker 而不是按 model 存。
  3. `embedding_dim` → 同 1（合并到 `custom_body.dimensions`，LightRAG 配置读这个）。
  4. **删除 `ModelConfig.additional_params` 列**（Alembic upgrade + downgrade 都要写）。
  5. 前端删掉"本地参数（高级）"折叠区。
  6. 后端 grep 删除所有 `.additional_params` 引用（reranker_service / lightrag_config / agent_service / embedding_service 等）。
- **测试**：
  - migration 双向：`tests/integration/db/test_migrations.py` 跑 upgrade → 验证数据搬运 → downgrade → 验证回退。
  - contract：`tests/contract/openapi/test_model_config_no_additional_params.py` 断言响应字段集合不含 `additional_params`。
  - 回归：reranker / lightrag / embedding 三条调用路径仍工作。
- **依赖**：PR2、PR3 先合，避免和路径 / async 化的修改踩车。

### PR5 — `ModelClient.send_request` 签名一等公民化

- **现象**：`send_request(api_url, api_key, messages, model, ...)` 接拍扁后的原始字段，每次 ModelConfig 新增字段都要在 13 个调用点重复传一次（本次新增 `custom_headers/custom_body/modalities` 就在 7 处手动写了三次）。
- **解法**：主签名改成 `send_request(model_config: ModelConfig, messages, ...)`；一次性改完所有调用点；删旧签名（不留兼容 shim，按 AGENTS.md §3.2）。
- **测试**：
  - unit：`tests/unit/services/conversation/test_send_request_threads_modelconfig.py`，用 mock httpx 验证 `model_config` 上的每个相关字段（headers/body/timeout/modalities/...）都正确进入出站请求。
  - 既有 integration / e2e 跑通。

### PR6 — vector_db 文档旧入口清理（文档漂移）

- **现象**：部分旧文档仍示例 `from app.services.vector_db_tidb import vector_db / initialize_vector_db / vector_db_service`，但 `app/services/vector_db_tidb/__init__.py` 已明确禁止 package-root re-export。
- **解法**：把文档示例改成真实 submodule / service API；不要为了文档恢复旧入口。
- **测试**：
  - grep 断言 docs 中不再出现 `from app.services.vector_db_tidb import vector_db` / `initialize_vector_db` / `vector_db_service` 这类旧入口示例。

### PR7 — 删除空占位模块 `action_task/rule_engine.py`

- **现象**：`backend-fastapi/app/services/action_task/rule_engine.py` 是 0 行空文件，当前无 import 引用；与本次删除 `app/utils/embedding.py` 属于同类空占位历史债。
- **解法**：确认全仓无引用后删除；不新建替代 shim。
- **测试**：
  - grep 断言无 `rule_engine` import / path 引用。
  - `python3 -c "import main"` 或相关 route/module compile 检查。

### PR8 — scheduler 旧 API adapter 去 shim（高风险，需单独做）

- **现象**：`app/services/scheduler/__init__.py` 和 `task_adapter.py` 明确写着“兼容旧API”，多处仍从 package root import `start_task/stop_task/pause_task/resume_task/get_task_status`。
- **解法**：调用点改为直接使用 `TaskScheduler` / 明确 submodule API；删除旧 adapter re-export。必须逐条验证自主任务 stop / pause / resume / SSE done 语义。
- **测试**：
  - 覆盖 `conversations.py` start/stop/pause/resume 路径。
  - 回归历史 BUG：stop 必须清 Redis queue、`scheduler.triggers`、SSE stream，并向前端发 `done`。

### PR9 — vector_db 默认实现命名/抽象统一（需设计）

- **现象**：知识库路径大量从 `app.services.vector_db_milvus` import `get_vector_db_service`，语义上像“默认 vector DB service”，但模块名绑定 Milvus；TiDB / Milvus 抽象边界不统一。
- **解法**：先写设计，再决定是否引入中立 `app/services/vector_db/` 包或显式 provider registry；不保留旧 import shim，需全量改调用点。
- **测试**：
  - knowledge base vectorize / search / delete 路径。
  - Milvus adapter 和 TiDB route 的 import contract。

### Epic — Flask-SQLAlchemy 兼容层退场（长期项）

- **现象**：FastAPI 后端仍通过 `app/extensions.py` 提供 Flask-SQLAlchemy 兼容 `db`，大量代码依赖 `db.Model` / `Model.query` / `db.session`。
- **处理原则**：这是跨 models、services、routes 的大迁移，不作为普通小 PR 顺手做。需要先设计 SQLAlchemy 2.0 session / repository 边界，再分批迁移。

---

## 已完成功能

- [x] **自定义请求参数拆分**（2026-05-19 PR1）：`ModelConfig` 增加 `custom_headers` / `custom_body` 两列，分别合并到出站 HTTP 请求的 headers / body；新建 `app/services/llm_http` 提供 `merge_custom_headers` / `merge_custom_body`（含 Content-Type 保护 + 按 modalities 给出软警告）；7 处 chat 入口 + embedding 服务接通；前端表单按 modalities 动态切换 placeholder/tooltip；保留 `additional_params` 作为本地参数过渡（详见 §历史债 PR4 灭活计划）。文档：`docs/agents/model-config-custom-params.md`。
- [x] 自主任务改为编排框架
- [x] 总结上下文消息优化（去掉工具调用参数）
- [x] print → logger 迁移
- [x] Claude `<tool_call>` 调用完善
- [x] 前端 i18n 文件结构拆分（locales 拆成 23 个 namespace；zh/en key 一致性校验；新增 `docs/agents/i18n.md` 指南；删除 `GraphitiTab_old.tsx` 孤儿；样板页 Agents/History/Login/LightRAGDocumentManager/RagasEvaluation 改造为纯 `t()` 调用）

## 进行中

- [ ] **前端硬编码中文清理**：当前仍有 225 个 `.tsx` 文件含约 5274 行用户可见硬编码中文。债务地图见 `docs/agents/i18n-hardcoded-cjk-report.md`（由 `frontend/scripts/scan-hardcoded-cjk.js` 自动生成）。已完成（用户高频页）：`AutonomousTaskModal.tsx`、`ActionSpaceDetail.tsx`、`ExperimentListPage.tsx`、`ExperimentDesign.tsx`、`DocumentManager.tsx`。Top 30 剩余热点：`ObserverManagement.tsx` / `JointSpaceManagement.tsx` / `ToolManagement.tsx` / `ChunkSettings.tsx` / `GraphitiTab.tsx` / `MarketPage.tsx` / …。每次清理后重跑扫描刷新报告。

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
