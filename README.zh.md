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

## 🚀 60 秒上手

```bash
git clone https://github.com/yourname/MesaLogo.git
cd MesaLogo/abm-docker
cp .env.example .env             # 至少设置 MARIADB_ROOT_PASSWORD + LLM API key
make up                          # 启动后端 + 前端 + MariaDB + Redis + Milvus
open http://localhost:3000
```

> 完整的密钥 / 配置指南:[`docs/SECRETS.md`](./docs/SECRETS.md)。

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

> *一个不太常说出口的感受:LLM 出现之后,我们才回头看清,从前手里能用的工具有多有限。所以现在做这件事,我们很认真。*
> *—— from the team*

我们认为多智能体系统**最激动人心的工作还没发生** —— 而其中很大一部分,会出现在 **LLM**、**社会科学**、**仿真** 三者交汇的缝隙里。

我们正在悄悄为这些时刻做准备:

- **当模型变得更便宜、更快** → 上千个 LLM 驱动的 Agent 一起跑,不再是 demo,而是*真正的实验*。我们的 5000 并发架构、并行实验室、Action Space 抽象,都是在赌这一天比大多数人想的要近。
- **当一切就绪,可以走出实验室** → 模型足够可靠,能稳定扮演社会行动者;物理仿真和 LLM 推理能在同一个回路里跑;MCP 插件能安全地触达真实系统。这些条件不会同时到来 —— 但当它们到来时,计算社会科学、组织研究、政策仿真、工业级 Agent 实验会需要一个底座。
- **当记忆成为架构,而不是附加件** → 时态知识图、矛盾检测、多尺度遗忘。MemoryPalace v0.51 是我们第一次认真的尝试,我们不觉得它会是最后一次。

我们不能保证这些突破会在某个明确的时间点到来。但我们宁愿现在就把平台搭好 —— 这样当那一天到来时,接下来要回答的是*基础设施问题*,而不是*第一性原理问题*。

> 如果上面有任何一条让你共鸣 —— 尤其是你在做**计算社会科学、ABM、组织研究、政策仿真、Agent 系统研究** —— 欢迎告诉我们。开 issue,或者在 Discussions 留个言。

---

## 🕰️ 早早下注,持续演进

我们是一支小团队,过去几年悄悄在多智能体 / LLM 设计的几个方向上下了注。

我们**不主张"首创"**。我们有的是一摞 [`docs/feature-*/`](./docs/) 下的设计文档 —— 它们记录了我们用自己的方式探索这些方向的轨迹,远早于第一次公开发布。如果这些方向后来出现在更大实验室的发布或产品里,我们觉得那是一个好信号:我们在倾听同一个时代的声音。

| 我们探索的方向 | 反映的业界思路时间窗口 | 我们的设计文档 |
|---|---|---|
| Supervisor + 规则沙箱作为多 Agent 运行的**安全边界** | "Harness Engineering"(Hashimoto, 2026) | [`feature-supervisor-workflow/`](./docs/feature-supervisor-workflow/) · `backend-fastapi/app/services/supervisor_*.py` · `rule_sandbox.py` |
| **SubAgent 嵌套** + 跨行动空间显式声明 | Claude SubAgents(2025) | [`feature-subagent/`](./docs/feature-subagent/) · [`feature-odm/`](./docs/feature-odm/) |
| **MCP 作为 server manager**(不只是 client)—— 注册、隔离、MCP→API 网关 | MCP 标准(2024-11+),广义 server 工具链(2025) | [`feature-mcp2apimcp/`](./docs/feature-mcp2apimcp/) · [`feature-mcp-server-isolation/`](./docs/feature-mcp-server-isolation/) · [`feature-mcpcontrol/`](./docs/feature-mcpcontrol/) |
| **时态知识图记忆** + 矛盾检测(`valid_from` / `valid_to`、`fact_check`) | Mem0 / Zep 时态记忆(2025) | [`feature-mempalace-v0.51/`](./docs/feature-mempalace-v0.51/) · [`feature-memory/`](./docs/feature-memory/) |
| **多 Agent 可视化 DAG 编排** + 跨空间变量传播 | LangGraph Studio、OpenAI Swarm(2024-Q4+) | [`feature-workflow-graph/`](./docs/feature-workflow-graph/) |
| **并行实验室** —— 对 Agent 群体做参数扫描 | ABM 老思想,被重新应用到 LLM Agent | [`feature-parallellab/`](./docs/feature-parallellab/) |

这不是"我们是第一个"的声明。这是一张我们押过的注的地图 —— docs 是凭据。

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

### 已落地的能力
- ✅ 多 Agent 编排:并行 + 条件分支
- ✅ MCP 插件生态(内置 + 可扩展;隔离;MCP→API 网关)
- ✅ 监督者 / 规则沙箱(安全可控的实验)
- ✅ 知识库:向量 + BM25 混合检索(LightRAG、Milvus)
- ✅ 并行实验室:参数扫描
- ✅ NetLogo 桥接:ABM × LLM 认知
- ✅ OpenAI 兼容 API:无头集成
- ✅ 多租户 + RBAC
- ✅ SSE 流式输出
- ✅ Redis 缓存,支持高吞吐场景

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
git clone https://github.com/yourname/MesaLogo.git
cd MesaLogo

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

启动后端 + 前端 + MariaDB + Redis + Milvus + Neo4j(可选)。打开 <http://localhost:3000>。

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

## 🗺️ 路线图与状态

我们在开源中迭代。完整实时路线图见 [`TODO.md`](./TODO.md)。亮点:

### 🔮 MemoryPalace v0.51 —— 自研时态记忆系统  *(Spec 阶段)*

参考开源项目 [`mempalace`](https://github.com/mempalace/mempalace)(LongMemEval R@5 = 96.6%)的工程实践,在多 Agent ABM 平台语境下重新设计的多层 Agent 记忆系统。

- **Drawer 层** —— 原文叙事(消息、工具结果、反思),支持衰减与合并。
- **Knowledge Graph 层** —— 时态三元组 `(subject, predicate, object, valid_from, valid_to)`,回答"现在为真的事实"。
- 脱离外部 Graphiti 依赖(HTTP + Neo4j)→ 全本地,全 async,贴合 5000 并发目标。
- 能识别"用户先说妻子叫张三,后来又说前妻"这种事实变更,通过 `kg_verify` 自动校验,提供离线 `fact_check()`。
- 5 层结构:`Realm → Wing → Hall → Room → Closet/Drawer`。
- 4 个独立 PR:`P1 骨架 → P2 closet+hybrid → P3 KG+反思 → P4 适配器+前端`。

📂 [`docs/feature-mempalace-v0.51/`](./docs/feature-mempalace-v0.51/)

### 其他正在做的方向
- 🚧 **Workflow Graph 可视化编排** —— 多 Agent DAG 编辑器([`docs/feature-workflow-graph/`](./docs/feature-workflow-graph/))
- 🚧 **5000 并发架构** —— async + Redis 队列 + 多机部署([`docs/feature-parallellab/PLAN-5000-concurrency.md`](./docs/feature-parallellab/PLAN-5000-concurrency.md))
- 🚧 **NVIDIA NIM / Isaac Sim 集成** —— 物理 ↔ 认知耦合
- 🚧 **Mesa Python 集成** —— 与现有 NetLogo 桥接并存

### 稳定性快照
核心 Agent 循环、多 Agent 行动空间、MCP 插件系统已**稳定**;知识库(LightRAG / Milvus)处于 **Beta**;Workflow Graph、MemoryPalace、5000 并发目标处于**设计中或分阶段推进**;API 保证为 **Pre-1.0**,可能有破坏性变更。这是活跃研发阶段的项目,生产部署需要一定运维经验。

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
