<div align="center">

# MesaLogo

**当 ABM 遇见 LLM。**
**我们相信下一次跃迁不是更聪明的模型,而是更适合它们栖居的世界。**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Status: Active](https://img.shields.io/badge/status-active%20development-orange.svg)]()

[English](./README.md) · [文档](./docs/) · [架构](./docs/key-arch/) · [路线图](./TODO.md) · [设计文档(`docs/feature-*`)](./docs/)

</div>

---

## 🧭 MesaLogo 是什么

一支开源小团队对**多智能体系统**的长期下注,生长在两个传统的交界处:

- **ABM(基于智能体的建模)** — 来自 NetLogo / Mesa 的结构化严谨:规则、环境、监督者、行动空间。
- **LLM(大语言模型)** — 来自 GPT 这类模型的语义灵活:对话、推理、涌现行为。

项目名向两位前辈致敬:**Mesa**(Python ABM 框架)和 **NetLogo**(25 年历史的智能体仿真语言)。

> 如果 Dify / Langflow 关心的是*单 Agent 工作流*,AutoGen / CrewAI / LangGraph 关心的是*Agent 小组*,
> MesaLogo 关心的是*多 Agent 的**世界*** —— 一个有规则、有监督者、有 MCP 副作用、并且记得发生过什么的地方。

---

## 🧠 为什么我们这样做 —— 三个对 LLM 的下注

我们不把 LLM 当成被串进工作流的工具。我们把它们看作**可以栖居在结构化世界里的居民**,这些世界可以被监督、被编排、被研究。三个下注由此而来:

| | 我们的下注 | 它在代码里长什么样 |
|---|---|---|
| 🌐 | **Action Space,不只是 Agent。** Agent 需要一个可栖居的结构化世界,而不是扁平的工具列表。 | `ActionSpace` 是一等实体:角色、规则、变量、监督者、MCP 插件都活在它里面。([`docs/feature-action-space/`](./docs/feature-action-space/)) |
| 🛡️ | **LLM 需要的是"驾驭"(harness),不是"束缚"(leash)。** 结构内的自由,胜过结构外的限制。 | Supervisor + 规则沙箱监督每一轮;SubAgent 离开自己的空间必须 `cross_space=True` 显式声明。([`docs/feature-supervisor-workflow/`](./docs/feature-supervisor-workflow/)) |
| 🧬 | **真正的行为只在认知遇到仿真时涌现。** 单靠聊天到不了那里。 | NetLogo 桥接 + 并行实验室 + Mesa Python / Isaac Sim 路线图。([`docs/feature-parallellab/`](./docs/feature-parallellab/)) |

我们不教条 —— 但仓库里每一个 feature 都能追溯回这三条里的一条。

---

## 🔭 我们在等什么

多智能体系统最激动人心的工作还没发生,而其中很大一部分会出现在 **LLM**、**社会科学**、**仿真** 三者交汇的缝隙里。我们在为三个正在临近的转折做准备:

- **更便宜、更快的模型** → 上千个 LLM 驱动的 Agent 一起跑,不再是 demo,而是真正的实验。我们的 5000 并发架构、并行实验室、Action Space 抽象,都是在赌这一天。
- **可用于生产的认知 + 仿真** → 模型足够可靠,能稳定扮演社会行动者;物理仿真和 LLM 推理在同一个回路里跑;MCP 插件安全地触达真实系统。
- **记忆成为架构,而不是附加件** → 时态知识图、矛盾检测、多尺度遗忘。MemoryPalace v0.51 是我们第一次认真的尝试。

> 如果上面有任何一条让你共鸣,尤其是你在做**计算社会科学、ABM、组织研究、政策仿真、Agent 系统研究**,欢迎开 issue 或在 Discussions 留言。

---

## 🗝️ 关键特性

精选 —— 完整设计文档在 [`docs/feature-*`](./docs/) 下。状态:**`[x]`** 已稳定 · **`[~]`** MVP/Beta · **`[ ]`** 设计/规划中。

### 当前版本亮点

- **以研究问题为中心的 ParallelLab 工作台。** 在同一个实验空间中定义研究问题、
  检查实验准备度、监控运行、对比分析,并把结论追溯到具体运行证据。
- **可审阅的 AI 实验协议。** 实验协议生成拥有独立开关、提示词模板和模型选择;
  扫描变量尚未配置完成时也能先生成协议,并在写入实验前人工审阅和编辑。
- **真实反映运行结果。** Worker 回调使用全新数据库会话,调度器失败会传播为运行结果,
  失败运行不参与最佳结果选择,没有任何成功运行的实验会正确结束为失败。
- **面向运维人员的 Service Center(服务中心)。** 管理员可以统一查看逻辑服务清单、
  健康状态、就绪状态、依赖关系和镜像可用性。白名单内的启停/重启能力默认关闭,
  只有显式启用高权限 Docker 控制覆盖层后才可使用。

### 🧱 平台底盘

| 状态 | 特性 | 一句话说明 | 设计文档 |
|---|---|---|---|
| [x] | 行动空间(Action Space)—— 一等"世界"抽象 | 角色、规则、变量、监督者、MCP 工具全部活在一个空间*内部*,而非扁平列表。 | [`feature-action-space/`](./docs/feature-action-space/) |
| [x] | 角色 ↔ 智能体:模板 / 实例分离 | 一个"批评者"模板可以同时在 N 个空间里跑成 N 个独立 Agent,各有自己的状态、记忆、工具权限。 | [`feature-role-management/`](./docs/feature-role-management/) |
| [x] | 变量系统 —— 模板 / 实例 / 跨空间传播 | 不只是 prompt 变量,而是行动空间之间的状态通道。 | [`feature-variables/`](./docs/feature-variables/) |
| [x] | 多租户 + RBAC + 项目空间 | 所有资源带 `created_by` / `is_shared`,企业级开箱即用。 | [`feature-multi-tenancy/`](./docs/feature-multi-tenancy/) |
| [x] | UUID 原生资源标识 | 所有核心资源用 UUID,跨实例迁移友好。 | [`feature-uuid/`](./docs/feature-uuid/) |

### ✍️ 创作体验

| 状态 | 特性 | 一句话说明 | 设计文档 |
|---|---|---|---|
| [ ] | 魔法笔记 (Magic Journal) —— "自由叙述 → AI 帮你搭世界" | 四栏工作台(笔记列表 / 笔记本 / AI 评论流 / 动作面板)。你像写日记一样把想做的事敲进去,AI 段落级地把自然语言解析成具体的 `ActionSpace` / `Role` / `Rule` / `Variable` / `Plan` 脚手架;低风险动作自动落库,高风险动作排队等你一键确认。SSE 流式渲染,`@` 链接到已有实体。 | — |

### 🎭 多智能体交互

| 状态 | 特性 | 一句话说明 | 设计文档 |
|---|---|---|---|
| [ ] | 基于人类社会组织架构构建高级交互模式 | 面向更具协商性 / 制度感的多 Agent 动态,设计中。 | — |
| [x] | Supervisor + 双引擎规则沙箱 | 自然语言规则 + 程序逻辑规则,监督者实时干预。 | [`feature-supervisor-workflow/`](./docs/feature-supervisor-workflow/) · `supervisor_*.py` · `rule_sandbox.py` |
| [x] | Observer 多档干预策略 | `round_based` 触发 × `passive`/active 干预模式,决定监督者*何时*、*以多强力度*介入。 | `ObserverManagement.tsx` |
| [x] | Smart Dispatch —— 自动路由到最合适的智能体 | 用户消息进来时根据内容自动选最佳 Agent 响应,不需要 `@`。热路径带 LRU 缓存,针对 26 万行的会话-智能体关系表做了优化。 | `smart_dispatch_service.py` · `core/model_cache.py` |
| [~] | 跨空间编排 (`cross_space`) | SubAgent 跨空间必须显式声明,监督者拦截非法跨越。 | [`feature-subagent/`](./docs/feature-subagent/) · [`feature-workflow-graph/`](./docs/feature-workflow-graph/) |
| [x] | 资源关系图可视化 | 在 UI 上看 `ActionSpace ↔ Role ↔ Agent ↔ Rule ↔ Variable` 的实时网。 | [`feature-ui-resource-graph/`](./docs/feature-ui-resource-graph/) |
| [ ] | Heartbeat —— ABM tick 驱动的"活着的"Agent | 每个 Agent 有自己的心跳节拍,即使没人对话也会 `observe → reflect/plan → act`;ActionSpace 关闭 ⇒ 该空间心跳停。灵感来自 Mesa `step()` / NetLogo `tick` / 斯坦福 Generative Agents。 | [`feature-heartbeat/`](./docs/feature-heartbeat/) |
| [ ] | 后台大脑 —— 自适应节拍、持续学习、平台大脑 | 在 Heartbeat 之上扩展三个维度:节拍由系统压力 × 每个 Agent 的优先级共同决定(后台思考永不饿死前台请求);持续学习闭环让反思必须通过评估门才能变成技能 / 规则 / 偏好,并支持影子先行、回滚与遗忘;平台自身也有一个 system 级大脑,只读遥测、只产出可人工审阅的改进建议,绝不自行改配置。 | [`PLAN-background-brain.md`](./docs/feature-heartbeat/PLAN-background-brain.md) |
| [ ] | 真正并行的多智能体执行 | 每个 Agent 独立 SSE 流 + 独立队列,告别共享流交错。 | `TODO.md#7` |

### 🪆 SubAgent / 智能体即工具

| 状态 | 特性 | 一句话说明 | 设计文档 |
|---|---|---|---|
| [~] | SubAgent 嵌套调用(通过 MCP) | `invoke_agent` / `invoke_agents` / `list_available_agents` 暴露为 MCP 工具;Phase 1 MVP 已落地。 | [`feature-subagent/`](./docs/feature-subagent/) |
| [x] | SubAgent 沙箱 | executor / context_builder / security 三层独立。 | [`feature-subagent/`](./docs/feature-subagent/) |
| [~] | ODM —— 智能体结构化协议约束 | 给 SubAgent 加 IDL 风格的输入 / 输出契约。 | [`feature-odm/`](./docs/feature-odm/) |

### 🔌 MCP 生态(不只是 MCP 客户端)

| 状态 | 特性 | 一句话说明 | 设计文档 |
|---|---|---|---|
| [x] | MCP Server Manager | 全生命周期:注册 / 启动 / 停止 / 健康检查 / 隔离。不是"我们能调 MCP 工具",而是"我们*运营* MCP 服务"。 | `mcp_server_manager.py`(73 KB) |
| [x] | MCP 服务隔离 | 不同空间的 MCP 实例互不串扰。 | [`feature-mcp-server-isolation/`](./docs/feature-mcp-server-isolation/) |
| [~] | MCP → API 网关 (`mcp2apimcp`) | 把任何 MCP 服务暴露成标准 HTTP API,反向接入老系统。 | [`feature-mcp2apimcp/`](./docs/feature-mcp2apimcp/) |

### 🎯 编排与自主任务

| 状态 | 特性 | 一句话说明 | 设计文档 |
|---|---|---|---|
| [ ] | Workflow Graph —— 可视化 DAG 编辑器 | 基于 ReactFlow;节点类型:agent / condition / parallel / loop。 | [`feature-workflow-graph/`](./docs/feature-workflow-graph/) |
| [x] | Planner —— 结构化计划 | `create_plan` / `update_plan_item` / `get_plan` 作为 MCP 工具 + 前端 `PlannerPanel` + 实时 SSE 更新。 | [`feature-planner/`](./docs/feature-planner/) |
| [x] | 自主任务 —— 三种触发模式 | 时间触发、变量触发、自主调度。 | [`feature-autonomous/`](./docs/feature-autonomous/) |
| [~] | 并行实验室(Parallel Experiment Lab) | 面向 LLM Agent 群体参数扫描的研究工作台,包含可审阅的 AI 行为协议、运行监控、分析、证据视图和明确的失败运行统计。 | [`当前方案`](./docs/feature-parallellab/PLAN-parallellab.md) · [`v2 研究设计(草案)`](./docs/feature-parallellab/PLAN-cognitive-simulation-v2.md) |
| [~] | Job Queue / Task Manager | Redis + 线程池 + 注册式 handler 模式。 | [`feature-job-queue/`](./docs/feature-job-queue/) |

### 🧬 记忆与知识

| 状态 | 特性 | 一句话说明 | 设计文档 |
|---|---|---|---|
| [ ] | MemoryPalace v0.51 —— 时态知识图记忆 | `(subject, predicate, object, valid_from, valid_to)` 三元组;内置 `kg_verify` + 离线 `fact_check()`;5 层 `Realm → Wing → Hall → Room → Drawer`。脱离外部 Graphiti 依赖,全本地、全 async。 | [`feature-mempalace-v0.51/`](./docs/feature-mempalace-v0.51/) |
| [~] | 记忆分区(global / agent / conversation) | 严格隔离 + 跨分区策略。 | [`PLAN-memory-partition.md`](./docs/feature-memory/PLAN-memory-partition.md) |
| [~] | Graphiti 风格社区检测 | 自动从记忆图谱里挖社区。 | [`PLAN-COMMUNITIES-GRAPH.md`](./docs/feature-memory/PLAN-COMMUNITIES-GRAPH.md) |
| [~] | LightRAG + Milvus + BM25 混合检索 | 知识图谱 × 向量 × 全文,三路并发。 | [`lightrag-PLAN.md`](./docs/feature-knowledge-base/lightrag-PLAN.md) · [`feature-vector-db/`](./docs/feature-vector-db/) |
| [x] | 文档解析管线 | PDF / Word / Excel 入库前预处理。 | [`feature-document-parser/`](./docs/feature-document-parser/) |
| [x] | 生产级上下文工程 | summary 服务下一轮前剥离 `tool_call` 参数,长会话自动摘要。绝大多数框架都炸过这个坑,我们已付过学费。 | [`feature-auto-summarize/`](./docs/feature-auto-summarize/) |

### 🏪 实体应用与外部生态

| 状态 | 特性 | 一句话说明 | 设计文档 |
|---|---|---|---|
| [~] | 实体应用市场(Applization) | NetLogo / GIS / RPA / RPG / VSCode 等作为一等应用挂载到行动空间。 | [`feature-applization/`](./docs/feature-applization/) · [`feature-market/`](./docs/feature-market/) |
| [x] | NetLogo 桥接 | ABM 物理 × LLM 认知双向通信,经由 `third_party/Galapagos`。 | — |
| [ ] | Mesa Python 集成 | 与 NetLogo 并存。 | `TODO.md` Phase 4 |
| [x] | OpenAI 兼容 API + Python SDK | 行动空间 / agent / 知识库都可被外部调用;API Key 管理 + 速率限制 + OpenAPI 文档。 | [`feature-openai-export/`](./docs/feature-openai-export/) |
| [x] | 外部角色导入 —— Coze & FastGPT | 一行配置从第三方平台拉智能体。 | [`PLAN-role-coze.md`](./docs/feature-role-management/PLAN-role-coze.md) · [`PLAN-role-fastgpt.md`](./docs/feature-role-management/PLAN-role-fastgpt.md) |
| [x] | 多模态图像输入 | 在任务对话中粘贴或上传图片,支持附件预览、移除和规范化的消息载荷处理。 | [`feature-image-input/`](./docs/feature-image-input/) |

### 🛠️ 工程与文化

| 状态 | 特性 | 一句话说明 | 设计文档 |
|---|---|---|---|
| [x] | 全 async 后端 | FastAPI + SQLAlchemy 2.0 + httpx;请求路径上无阻塞 I/O(AGENTS.md 红线)。 | [`AGENTS.md`](./AGENTS.md) |
| [x] | SSE 流式 + 中止 + 保活 | 长会话保活;流中途可取消。 | [`feature-stream-cancel/`](./docs/feature-stream-cancel/) · [`feature-keep-alive-conversation/`](./docs/feature-keep-alive-conversation/) |
| [x] | 三袋制 `ModelConfig` | `custom_headers` / `custom_body` / `additional_params` 严格分离,经 `app/services/llm_http` 合并。 | [`model-config-custom-params.md`](./docs/agents/model-config-custom-params.md) |
| [~] | Service Center(服务中心)—— 运行清单与健康状态 | 仅管理员可见的逻辑服务清单和依赖感知健康/就绪检查;白名单生命周期控制需要显式启用 Docker Socket 覆盖层。 | [`feature-service-center/`](./docs/feature-service-center/) · [`部署指南`](./abm-docker/README.md) |
| [x] | 严格的 i18n 治理 | 按功能划分 namespace;CI 校验中英 key 一致(`node frontend/scripts/check-i18n-keys.js`);前端源码零硬编码中文。 | [`feature-multi-lang/`](./docs/feature-multi-lang/) · [`docs/agents/i18n.md`](./docs/agents/i18n.md) |
| [x] | AGENTS.md driven 工程文化 | 给 AI 编码助手的"入职手册";每条红线都能追溯到一次真实事故;发布契约写明。开源圈很少见 —— 它本身就是一项特性。 | [`docs/agents/failures/`](./docs/agents/failures/) · [`release-flow.md`](./docs/agents/release-flow.md) |

---

## 🧩 核心概念

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│     Tenant ──► ActionSpace ──► ActionTask ──► Conversation       │
│                    │                                             │
│                    ├─► Roles ──► Agents (LLM 驱动)               │
│                    ├─► Rules (NL + 逻辑混合)                     │
│                    ├─► Variables (模板 / 实例)                   │
│                    ├─► Supervisor (自动监控与干预)               │
│                    └─► MCP Plugins (真实世界操作)                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

- **Action Space** — Agent 所处的结构化世界(一次专家会议、一场辩论、一段 RPG 任务)。
- **Role** — 可复用的 Agent 模板("批评者"、"医生"、"客户")。
- **Agent** — Role 在 Action Space 中的实例,有自己的状态、记忆、工具权限。
- **Supervisor** — 元 Agent,监督整个仿真,违反规则时介入。
- **MCP Plugin** — Model Context Protocol 工具服务,让 Agent 能执行真实操作(调 API、控制设备、跑代码)。

> 详细数据模型见 [`docs/key-arch/KEY-RESOURCES-RELATIONS.md`](./docs/key-arch/KEY-RESOURCES-RELATIONS.md)。

---

## 📊 MesaLogo 怎么对比

### 对比传统 ABM(NetLogo · Mesa · AnyLogic)

| 能力 | MesaLogo | 传统 ABM |
|---|---|---|
| 规则定义 | 双引擎:自然语言 + 程序逻辑 | 仅程序逻辑 |
| 用户门槛 | 技术 + 非技术用户都能用 | 仅程序员 |
| 监督者 | 内置,自动监控并干预 | 手动 / 缺失 |
| 交互重点 | 对话与沟通 | 空间 / 状态变化 |
| 控制能力 | MCP 插件(对话 + 真实操作) | 仅状态变化 |
| 应用场景 | 人类对话、决策、协作 | 物理系统、简单行为 |

### 对比 LLM Agent 框架(Dify · Langflow · AutoGen · CrewAI · LangGraph · OpenAI Swarm · Claude Agent SDK)

| 能力 | MesaLogo | 大多数 LLM Agent 框架 |
|---|---|---|
| **Action Space** 作为一等抽象 | ✅ 角色、规则、变量、监督者都活在空间*内部* | ❌ 扁平的 Agent / 工具列表 |
| **Supervisor + 规则沙箱**作为安全边界 | ✅ 内置在运行时 | ⚠️ 通常由开发者自行实现 |
| **跨空间编排** + 变量传播 | ✅ 显式 `cross_space` 声明 | ❌ 没有这个概念 |
| **ABM 桥接**(现 NetLogo,即将 Mesa / Isaac Sim) | ✅ 认知 × 物理在同一平台 | ❌ |
| **MCP server manager**(不只是 MCP client) | ✅ 注册、隔离、MCP→API 网关 | ⚠️ 多数仅 client 侧,或没有 |
| **并行实验室**(对 Agent 做参数扫描) | ✅ | ❌ |
| **多租户 + RBAC + OpenAI 兼容 API** 开箱即用 | ✅ | ⚠️ 各家不一 |
| 最擅长 | 专家小组、辩论、仿真、可控的多 Agent 世界 | RAG、FAQ、流程自动化、单 Agent 链 |

---

## ✨ 能做什么

### 内置交互模式
- **顺序模式** — 智能体按顺序发言,经典专家小组
- **小组模式** — 开放式专家讨论,监督者主持
- **辩论模式** — 正反双方,结构化轮次
- **协作模式** — 智能体共同解决问题

### 适用场景
| 场景 | 为什么用 MesaLogo |
|---|---|
| 战略决策室(董事会、推演) | 多 Agent 各演其角,通过对话产出决策 |
| 多专家会诊 | 每个专科 Agent 在自己领域内推理 |
| 课堂辩论 / 案例分析 | 内置辩论模式 + 监督者 |
| 政策影响仿真 | 不同立场的利益相关者 Agent |
| 客服培训 | 规则约束 + 真实工具访问 |
| 智能家居 / IoT 控制 | Agent 讨论 → MCP 插件执行 |
| 合成数据生成 | Agent 对话产生标注语料 |

---

## 🛠️ 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                          前端                                   │
│            React 19 + Antd 6 + @xyflow/react                    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ SSE / REST
┌──────────────────────────────▼──────────────────────────────────┐
│                        FastAPI 后端                             │
│   ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐     │
│   │ Agents /   │  │ Supervisors │  │ MCP Plugin Manager   │     │
│   │ Roles      │  │ Rule sandbox│  │ (内置 + 自定义)      │     │
│   └────────────┘  └─────────────┘  └──────────────────────┘     │
│   ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐     │
│   │ SubAgents  │  │ Scheduler   │  │ Memory / Knowledge   │     │
│   │ (嵌套)     │  │ + 任务队列  │  │ (LightRAG + Milvus)  │     │
│   └────────────┘  └─────────────┘  └──────────────────────┘     │
└────┬──────────┬──────────┬───────────────┬─────────────────────┘
     │          │          │               │
┌────▼─────┐ ┌──▼──────┐ ┌─▼──────┐  ┌─────▼──────────┐
│ MariaDB  │ │ Redis   │ │ Milvus │  │ LLM 后端       │
│ (状态)   │ │ (缓存)  │ │(向量)  │  │ OpenAI / Claude│
│          │ │         │ │        │  │ Gemini / 本地  │
└──────────┘ └─────────┘ └────────┘  └────────────────┘
```

**设计原则**(详见 [`AGENTS.md`](./AGENTS.md)):
- 全 async,请求路径上无阻塞 IO。
- 流式用 SSE(不用 WebSocket)。
- Supervisor / 规则沙箱是安全边界。
- MCP 是工具扩展机制。

---

## 🚦 完整快速开始

### 环境要求
- Python 3.13+(项目用 3.13.5)
- Node 20+ 和 pnpm
- Docker(全栈需要:MariaDB / Redis / Milvus)

### Docker 启动(推荐)

```bash
git clone https://github.com/mesalogo/mesalogo.git
cd mesalogo

# 1. 从模板复制配置文件并填入你自己的值。
#    完整指南:docs/SECRETS.md
cp abm-docker/.env.example          abm-docker/.env
cp abm-docker/lightrag.env.example  abm-docker/lightrag.env
cp abm-docker/config.conf.example   abm-docker/config.conf
cp abm-docker/mcp_config.json.example abm-docker/mcp_config.json
$EDITOR abm-docker/.env             # 至少:MARIADB_ROOT_PASSWORD + LLM API key

# 2. 启动栈。
cd abm-docker
make up
```

启动后端 + 前端 + MariaDB + Redis + Milvus + Neo4j(可选)。打开 <http://localhost:16000>(后端 API 在 `16001`;所有宿主端口统一在 `16000` 段)。

> 📖 **完整配置指南见 [`docs/SECRETS.md`](./docs/SECRETS.md)。**

### 开发模式

**后端:**

```bash
cd backend-fastapi
pip install -e .
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

**前端:**

```bash
cd frontend
pnpm install
pnpm dev
```

> 后端开发约定:[`backend-fastapi/AGENTS.md`](./backend-fastapi/AGENTS.md)。

### 生产部署

```bash
./backend-fastapi/start_prod.sh   # gunicorn + uvicorn workers
```

---

## 🤝 贡献

欢迎贡献!提 PR 之前请:

1. 读 [`AGENTS.md`](./AGENTS.md) —— 仓库通用约定。
2. 改后端的话,读 [`backend-fastapi/AGENTS.md`](./backend-fastapi/AGENTS.md)。
3. 浏览 `docs/agents/failures/` 下的翻车复盘,避免重蹈覆辙。
4. 非平凡改动先开 issue 讨论。

**不自动 squash,不自动 push。** 维护者会逐个 review。

### 急需帮助的方向
- 🧠 MemoryPalace v0.51 实现(P1 骨架可以马上开)
- 🔌 新 MCP 插件(尤其是领域工具:GIS、金融、生物)
- 🌐 国际化(英语 / 日语)
- 📚 文档翻译
- 🐛 可复现的 bug 报告
- 🧪 行动空间 / 监督者边界场景的测试用例

---

## 📜 许可

MIT —— 见 [`LICENSE`](./LICENSE)。

可以自由使用、修改、分发本软件,包括商业用途。请在重新分发的实质性部分中保留版权声明。

---

## 🙏 致谢

MesaLogo 站在巨人的肩膀上:

- **[Mesa](https://github.com/projectmesa/mesa)** —— Python ABM 框架,启发了我们的智能体模型。
- **[NetLogo](https://ccl.northwestern.edu/netlogo/)** —— 25 年的智能体仿真智慧。
- **[mempalace](https://github.com/mempalace/mempalace)** —— 新记忆系统的设计灵感。
- **[FastAPI](https://github.com/tiangolo/fastapi)**、**[React](https://github.com/facebook/react)**、**[Ant Design](https://github.com/ant-design/ant-design)** —— Web 栈基石。
- **[Milvus](https://github.com/milvus-io/milvus)**、**[LightRAG](https://github.com/HKUDS/LightRAG)** —— 向量 + RAG 基础设施。
- **[Model Context Protocol](https://github.com/modelcontextprotocol)** —— 插件标准。
- 所有容忍粗糙边缘的早期贡献者和用户。

---

<div align="center">

**用心做,在开源中。**
**如果 MesaLogo 对你有帮助,或者你也认同上面的下注,请点 ⭐ Star。**

[文档](./docs/) · [路线图](./TODO.md) · [English README](./README.md)

</div>
