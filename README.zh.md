<div align="center">

# MesaLogo

**一个把基于智能体建模的结构约束与 LLM 推理结合起来的多智能体平台。**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Status: Active](https://img.shields.io/badge/status-active%20development-orange.svg)]()

[English](./README.md) · [文档](./docs/) · [架构](./docs/key-arch/) · [路线图](./TODO.md) · [设计文档(`docs/feature-*`)](./docs/)

</div>

---

## MesaLogo 是什么

一个用于构建和运行多智能体系统的开源平台,借鉴了两个传统:

- **ABM(基于智能体的建模)** — 来自 NetLogo / Mesa 的结构化约定:规则、环境、监督者、有边界的行动空间。
- **LLM(大语言模型)** — 以对话和推理作为驱动智能体行为的机制。

项目名取自 **Mesa**(Python ABM 框架)和 **NetLogo**(智能体仿真语言,1999 年首发)。

核心抽象是**行动空间(Action Space)**:一个包含角色、规则、变量、监督者和 MCP 工具服务的有界环境。智能体运行在空间内部,而不是面对一个扁平的工具列表。与工作流类工具(Dify、Langflow)或智能体编队库(AutoGen、CrewAI、LangGraph)相比,差别主要在这条边界,以及负责执行它的监督者。

### 项目状态

活跃开发中。核心链路 —— 行动空间、角色/智能体分离、MCP 服务生命周期、Planner、自主任务、NetLogo 桥接 —— 可用于研究、演示和试点部署。仍有若干列出的能力处于 MVP 或未实现状态,测试覆盖也不均衡。

在把它用于任何关键场景之前,请先读 [`docs/agents/feature-readiness.md`](./docs/agents/feature-readiness.md)。那是一份基于证据的快照,包含尚未就绪的部分。

设计方向:单次运行支持更大规模的智能体群体、仿真与 LLM 推理更紧密耦合、把记忆做成时态知识图而不是检索附加件。具体计划见 [`docs/feature-*`](./docs/) 和 [`TODO.md`](./TODO.md)。

如果你在做计算社会科学、ABM、组织研究、政策仿真或智能体系统研究,欢迎开 issue 或参与 Discussions。

---

## 功能清单

完整设计文档在 [`docs/feature-*`](./docs/) 下。状态:**`[x]`** 已稳定 · **`[~]`** MVP/Beta · **`[ ]`** 设计/规划中。

"已稳定"表示该链路可用且经过实际验证,不代表已针对无人值守的生产环境做过加固。逐项说明见 [`feature-readiness.md`](./docs/agents/feature-readiness.md)。

### 近期新增

- **以研究问题为中心的 ParallelLab 工作台。** 在同一个实验空间中定义研究问题、
  检查实验准备度、监控运行、对比分析,并把结论追溯到具体运行证据。
- **可审阅的 AI 实验协议。** 实验协议生成拥有独立开关、提示词模板和模型选择;
  扫描变量尚未配置完成时也能先生成协议,并在写入实验前人工审阅和编辑。
- **运行结果结算正确。** Worker 回调使用全新数据库会话,调度器失败会传播为运行结果,
  失败运行不参与最佳结果选择,没有任何成功运行的实验会正确结束为失败。
- **面向运维人员的 Service Center(服务中心)。** 管理员可以统一查看逻辑服务清单、
  健康状态、就绪状态、依赖关系和镜像可用性。白名单内的启停/重启能力默认关闭,
  只有显式启用高权限 Docker 控制覆盖层后才可使用。

### 平台底盘

| 状态 | 特性 | 一句话说明 | 设计文档 |
|---|---|---|---|
| [x] | 行动空间(Action Space)—— 一等"世界"抽象 | 角色、规则、变量、监督者、MCP 工具全部活在一个空间*内部*,而非扁平列表。 | [`feature-action-space/`](./docs/feature-action-space/) |
| [x] | 角色 ↔ 智能体:模板 / 实例分离 | 一个"批评者"模板可以同时在 N 个空间里跑成 N 个独立 Agent,各有自己的状态、记忆、工具权限。 | [`feature-role-management/`](./docs/feature-role-management/) |
| [x] | 变量系统 —— 模板 / 实例 / 跨空间传播 | 不只是 prompt 变量,而是行动空间之间的状态通道。 | [`feature-variables/`](./docs/feature-variables/) |
| [x] | 多租户 + RBAC + 项目空间 | 所有资源带 `created_by` / `is_shared`。 | [`feature-multi-tenancy/`](./docs/feature-multi-tenancy/) |
| [x] | UUID 原生资源标识 | 所有核心资源用 UUID,跨实例迁移友好。 | [`feature-uuid/`](./docs/feature-uuid/) |

### 创作体验

| 状态 | 特性 | 一句话说明 | 设计文档 |
|---|---|---|---|
| [ ] | 魔法笔记 (Magic Journal) —— "自由叙述 → AI 帮你搭世界" | 四栏工作台(笔记列表 / 笔记本 / AI 评论流 / 动作面板)。你像写日记一样把想做的事敲进去,AI 段落级地把自然语言解析成具体的 `ActionSpace` / `Role` / `Rule` / `Variable` / `Plan` 脚手架;低风险动作自动落库,高风险动作排队等你一键确认。SSE 流式渲染,`@` 链接到已有实体。 | — |

### 多智能体交互

| 状态 | 特性 | 一句话说明 | 设计文档 |
|---|---|---|---|
| [ ] | 基于人类社会组织架构构建高级交互模式 | 面向更具协商性 / 制度感的多 Agent 动态,设计中。 | — |
| [x] | Supervisor + 双引擎规则沙箱 | 自然语言规则 + 程序逻辑规则,监督者实时干预。 | [`feature-supervisor-workflow/`](./docs/feature-supervisor-workflow/) · `supervisor_*.py` · `rule_sandbox.py` |
| [x] | Observer 多档干预策略 | `round_based` 触发 × `passive`/active 干预模式,决定监督者*何时*、*以多强力度*介入。 | `ObserverManagement.tsx` |
| [x] | Smart Dispatch —— 自动路由智能体 | 用户消息进来时根据内容自动选择合适的 Agent 响应,不需要 `@`。查询路径带 LRU 缓存。 | `smart_dispatch_service.py` · `core/model_cache.py` |
| [~] | 跨空间编排 (`cross_space`) | SubAgent 跨空间必须显式声明,监督者拦截非法跨越。 | [`feature-subagent/`](./docs/feature-subagent/) · [`feature-workflow-graph/`](./docs/feature-workflow-graph/) |
| [x] | 资源关系图可视化 | 在 UI 上看 `ActionSpace ↔ Role ↔ Agent ↔ Rule ↔ Variable` 的实时网。 | [`feature-ui-resource-graph/`](./docs/feature-ui-resource-graph/) |
| [ ] | Heartbeat —— ABM tick 驱动的"活着的"Agent | 每个 Agent 有自己的心跳节拍,即使没人对话也会 `observe → reflect/plan → act`;ActionSpace 关闭 ⇒ 该空间心跳停。灵感来自 Mesa `step()` / NetLogo `tick` / 斯坦福 Generative Agents。 | [`feature-heartbeat/`](./docs/feature-heartbeat/) |
| [ ] | 后台大脑 —— 自适应节拍、持续学习、平台大脑 | 在 Heartbeat 之上扩展三个维度:节拍由系统压力 × 每个 Agent 的优先级共同决定(后台思考永不饿死前台请求);持续学习闭环让反思必须通过评估门才能变成技能 / 规则 / 偏好,并支持影子先行、回滚与遗忘;平台自身也有一个 system 级大脑,只读遥测、只产出可人工审阅的改进建议,绝不自行改配置。 | [`PLAN-background-brain.md`](./docs/feature-heartbeat/PLAN-background-brain.md) |
| [ ] | 真正并行的多智能体执行 | 每个 Agent 独立 SSE 流 + 独立队列,告别共享流交错。 | `TODO.md#7` |

### SubAgent / 智能体即工具

| 状态 | 特性 | 一句话说明 | 设计文档 |
|---|---|---|---|
| [~] | SubAgent 嵌套调用(通过 MCP) | `invoke_agent` / `invoke_agents` / `list_available_agents` 暴露为 MCP 工具;Phase 1 MVP 已落地。 | [`feature-subagent/`](./docs/feature-subagent/) |
| [x] | SubAgent 沙箱 | executor / context_builder / security 三层独立。 | [`feature-subagent/`](./docs/feature-subagent/) |
| [~] | ODM —— 智能体结构化协议约束 | 给 SubAgent 加 IDL 风格的输入 / 输出契约。 | [`feature-odm/`](./docs/feature-odm/) |

### MCP 生态

| 状态 | 特性 | 一句话说明 | 设计文档 |
|---|---|---|---|
| [x] | MCP Server Manager | 服务端全生命周期管理:注册 / 启动 / 停止 / 健康检查 / 隔离。平台运行 MCP 服务,而不只是作为客户端调用。 | `mcp_server_manager.py`(73 KB) |
| [x] | MCP 服务隔离 | 不同空间的 MCP 实例互不串扰。 | [`feature-mcp-server-isolation/`](./docs/feature-mcp-server-isolation/) |
| [~] | MCP → API 网关 (`mcp2apimcp`) | 把任何 MCP 服务暴露成标准 HTTP API,反向接入老系统。 | [`feature-mcp2apimcp/`](./docs/feature-mcp2apimcp/) |

### 编排与自主任务

| 状态 | 特性 | 一句话说明 | 设计文档 |
|---|---|---|---|
| [ ] | Workflow Graph —— 可视化 DAG 编辑器 | 基于 ReactFlow;节点类型:agent / condition / parallel / loop。 | [`feature-workflow-graph/`](./docs/feature-workflow-graph/) |
| [x] | Planner —— 结构化计划 | `create_plan` / `update_plan_item` / `get_plan` 作为 MCP 工具 + 前端 `PlannerPanel` + 实时 SSE 更新。 | [`feature-planner/`](./docs/feature-planner/) |
| [x] | 自主任务 —— 三种触发模式 | 时间触发、变量触发、自主调度。 | [`feature-autonomous/`](./docs/feature-autonomous/) |
| [~] | 并行实验室(Parallel Experiment Lab) | 面向 LLM Agent 群体参数扫描的研究工作台,包含可审阅的 AI 行为协议、运行监控、分析、证据视图和明确的失败运行统计。 | [`当前方案`](./docs/feature-parallellab/PLAN-parallellab.md) · [`v2 研究设计(草案)`](./docs/feature-parallellab/PLAN-cognitive-simulation-v2.md) |
| [~] | Job Queue / Task Manager | Redis + 线程池 + 注册式 handler 模式。 | [`feature-job-queue/`](./docs/feature-job-queue/) |

### 记忆与知识

| 状态 | 特性 | 一句话说明 | 设计文档 |
|---|---|---|---|
| [ ] | MemoryPalace v0.51 —— 时态知识图记忆 | `(subject, predicate, object, valid_from, valid_to)` 三元组;内置 `kg_verify` + 离线 `fact_check()`;5 层 `Realm → Wing → Hall → Room → Drawer`。脱离外部 Graphiti 依赖,全本地、全 async。 | [`feature-mempalace-v0.51/`](./docs/feature-mempalace-v0.51/) |
| [~] | 记忆分区(global / agent / conversation) | 严格隔离 + 跨分区策略。 | [`PLAN-memory-partition.md`](./docs/feature-memory/PLAN-memory-partition.md) |
| [~] | Graphiti 风格社区检测 | 自动从记忆图谱里挖社区。 | [`PLAN-COMMUNITIES-GRAPH.md`](./docs/feature-memory/PLAN-COMMUNITIES-GRAPH.md) |
| [~] | LightRAG + Milvus + BM25 混合检索 | 知识图谱 × 向量 × 全文,三路并发。 | [`lightrag-PLAN.md`](./docs/feature-knowledge-base/lightrag-PLAN.md) · [`feature-vector-db/`](./docs/feature-vector-db/) |
| [x] | 文档解析管线 | PDF / Word / Excel 入库前预处理。 | [`feature-document-parser/`](./docs/feature-document-parser/) |
| [x] | 上下文窗口管理 | summary 服务在下一轮前剥离 `tool_call` 参数,长会话自动摘要,从而控制上下文增长。 | [`feature-auto-summarize/`](./docs/feature-auto-summarize/) |

### 实体应用与外部生态

| 状态 | 特性 | 一句话说明 | 设计文档 |
|---|---|---|---|
| [~] | 实体应用市场(Applization) | NetLogo / GIS / RPA / RPG / VSCode 等作为一等应用挂载到行动空间。 | [`feature-applization/`](./docs/feature-applization/) · [`feature-market/`](./docs/feature-market/) |
| [x] | NetLogo 桥接 | ABM 物理 × LLM 认知双向通信,经由 `third_party/Galapagos`。 | — |
| [ ] | Mesa Python 集成 | 与 NetLogo 并存。 | `TODO.md` Phase 4 |
| [x] | OpenAI 兼容 API + Python SDK | 行动空间 / agent / 知识库都可被外部调用;API Key 管理 + 速率限制 + OpenAPI 文档。 | [`feature-openai-export/`](./docs/feature-openai-export/) |
| [x] | 外部角色导入 —— Coze & FastGPT | 一行配置从第三方平台拉智能体。 | [`PLAN-role-coze.md`](./docs/feature-role-management/PLAN-role-coze.md) · [`PLAN-role-fastgpt.md`](./docs/feature-role-management/PLAN-role-fastgpt.md) |
| [x] | 多模态图像输入 | 在任务对话中粘贴或上传图片,支持附件预览、移除和规范化的消息载荷处理。 | [`feature-image-input/`](./docs/feature-image-input/) |

### 工程实践

| 状态 | 特性 | 一句话说明 | 设计文档 |
|---|---|---|---|
| [~] | 异步后端 | FastAPI + SQLAlchemy 2.0 + httpx。"请求路径无阻塞 I/O" 是对新代码强制执行的约定,而非已完成状态:源码扫描显示 `backend-fastapi/app` 下仍有约 56 处 `requests.*` / `time.sleep()` 调用待审计。 | [`AGENTS.md`](./AGENTS.md) · [`feature-readiness.md`](./docs/agents/feature-readiness.md) |
| [x] | SSE 流式 + 中止 + 保活 | 长会话保活;流中途可取消。 | [`feature-stream-cancel/`](./docs/feature-stream-cancel/) · [`feature-keep-alive-conversation/`](./docs/feature-keep-alive-conversation/) |
| [x] | 三袋制 `ModelConfig` | `custom_headers` / `custom_body` / `additional_params` 严格分离,经 `app/services/llm_http` 合并。 | [`model-config-custom-params.md`](./docs/agents/model-config-custom-params.md) |
| [~] | Service Center(服务中心)—— 运行清单与健康状态 | 仅管理员可见的逻辑服务清单和依赖感知健康/就绪检查;白名单生命周期控制需要显式启用 Docker Socket 覆盖层。 | [`feature-service-center/`](./docs/feature-service-center/) · [`部署指南`](./abm-docker/README.md) |
| [x] | i18n 强制校验 | 按功能划分 namespace;`pnpm run i18n:check-keys` 校验中英 key 一致;AST 扫描器(`pnpm run i18n:check-cjk`)保证前端源码零硬编码中文。两项在提交前本地运行。 | [`feature-multi-lang/`](./docs/feature-multi-lang/) · [`docs/agents/i18n.md`](./docs/agents/i18n.md) |
| [x] | 成文的工程约定与事故记录 | `AGENTS.md` 是面向人类与 AI 贡献者的仓库级规则,每条红线都能追溯到 `docs/agents/failures/` 里的一次真实事故;公开发布流程也已成文,不依赖口口相传。 | [`docs/agents/failures/`](./docs/agents/failures/) · [`release-flow.md`](./docs/agents/release-flow.md) |

---

## 核心概念

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

## MesaLogo 的定位

下面的对比描述的是设计侧重,不是基准测试结果。所列项目在各自领域都很成熟,其中不少差异属于有意的取舍,而非能力缺失。

### 相对传统 ABM(NetLogo · Mesa · AnyLogic)

| 维度 | MesaLogo | 传统 ABM |
|---|---|---|
| 规则定义 | 自然语言规则与程序规则并存 | 程序代码 |
| 智能体行为 | 由 LLM 推理驱动 | 由显式状态机驱动 |
| 交互重点 | 智能体之间的对话 | 空间与数值状态变化 |
| 副作用 | MCP 工具服务可触达外部系统 | 仿真内部状态 |
| 成熟度 | 早期,持续演进 | 数十年验证,有成熟学术积累 |
| 确定性 | 低,LLM 输出每次运行都不同 | 高,给定随机种子可复现 |

如果你需要的是可复现、可同行评议、行为规则明确的大规模群体仿真,请用成熟的 ABM 工具。MesaLogo 面向的是"有意思的行为发生在语言层面"的场景。

### 相对 LLM Agent 框架(Dify · Langflow · AutoGen · CrewAI · LangGraph · OpenAI Swarm · Claude Agent SDK)

| 维度 | MesaLogo 的做法 |
|---|---|
| 结构 | 以行动空间为作用域单位:角色、规则、变量、监督者都归属于某个空间 |
| 安全边界 | 监督者与规则沙箱运行在平台内部,而不是交给应用层自行实现 |
| 跨边界调用 | SubAgent 必须声明 `cross_space=True`,未声明的跨越会被拦截 |
| 仿真耦合 | 当前提供 NetLogo 桥接,Mesa 集成在计划中 |
| MCP | 服务端生命周期管理与隔离,另有 MCP→API 网关 |
| 实验 | 面向智能体群体的参数扫描,带运行级证据 |
| 部署面 | 内置多租户、RBAC 和 OpenAI 兼容 API |

那些框架通常更轻量、文档更完善、社区规模也大得多。其中若干是库,而 MesaLogo 是平台,这是不同的取舍而非优劣之分。如果有界世界模型和监督者强制约束契合你的问题,可以考虑 MesaLogo;如果你想要一个更小、由自己组装的依赖,那些框架更合适。

---

## 能做什么

### 内置交互模式
- **顺序模式** — 智能体按顺序发言,经典专家小组
- **小组模式** — 开放式专家讨论,监督者主持
- **辩论模式** — 正反双方,结构化轮次
- **协作模式** — 智能体共同解决问题

### 适用场景

以下是这些抽象在设计时所面向的场景,不是已发表结果的案例研究。

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

## 架构

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

**设计规则**(详见 [`AGENTS.md`](./AGENTS.md)):
- 默认异步,新代码不得在请求路径引入阻塞 IO。
- 流式用 SSE,不用 WebSocket。
- Supervisor / 规则沙箱是安全边界。
- MCP 是工具扩展机制。

---

## 快速开始

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

## 贡献

欢迎贡献!提 PR 之前请:

1. 读 [`AGENTS.md`](./AGENTS.md) —— 仓库通用约定。
2. 改后端的话,读 [`backend-fastapi/AGENTS.md`](./backend-fastapi/AGENTS.md)。
3. 浏览 `docs/agents/failures/` 下的翻车复盘,避免重蹈覆辙。
4. 非平凡改动先开 issue 讨论。

**不自动 squash,不自动 push。** 维护者会逐个 review。

### 最需要帮助的方向
- MemoryPalace v0.51 实现(P1 骨架可以马上开)
- 新 MCP 插件,尤其是领域工具:GIS、金融、生物
- 国际化(英语 / 日语)
- 文档翻译
- 可复现的 bug 报告
- 集成测试与 E2E 测试,这是当前测试金字塔最薄的一层

---

## 许可

MIT —— 见 [`LICENSE`](./LICENSE)。

可以自由使用、修改、分发本软件,包括商业用途。请在重新分发的实质性部分中保留版权声明。

---

## 致谢

本项目构建于以下工作之上:

- **[Mesa](https://github.com/projectmesa/mesa)** —— Python ABM 框架,启发了本项目的智能体模型。
- **[NetLogo](https://ccl.northwestern.edu/netlogo/)** —— 智能体仿真的既有约定,也是经由 `third_party/Galapagos` 桥接的目标。
- **[mempalace](https://github.com/mempalace/mempalace)** —— 记忆系统的设计参考。
- **[FastAPI](https://github.com/tiangolo/fastapi)**、**[React](https://github.com/facebook/react)**、**[Ant Design](https://github.com/ant-design/ant-design)** —— Web 技术栈。
- **[Milvus](https://github.com/milvus-io/milvus)**、**[LightRAG](https://github.com/HKUDS/LightRAG)** —— 向量与 RAG 基础设施。
- **[Model Context Protocol](https://github.com/modelcontextprotocol)** —— 插件标准。
- 早期贡献者和用户,他们在项目粗糙的阶段一起把问题磨平。

---

<div align="center">

[文档](./docs/) · [路线图](./TODO.md) · [English README](./README.md)

</div>
