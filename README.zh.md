<div align="center">

# MesaLogo

**ABM 与 LLM 的相遇 — 面向认知、组织、社会系统的多智能体仿真平台。**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Status: Active](https://img.shields.io/badge/status-active%20development-orange.svg)]()

[English](./README.md) · [文档](./docs/) · [架构](./docs/key-arch/) · [路线图](./TODO.md)

</div>

---

## MesaLogo 是什么

**MesaLogo** 是一个多智能体仿真平台,把两个世界的优势合在一起:

- **ABM(基于智能体的建模)** — 来自 NetLogo / Mesa 的结构化严谨:规则、环境、监督者、行动空间。
- **LLM(大语言模型)** — 来自 GPT 这类模型的语义灵活:对话、推理、涌现行为。

项目名向两位前辈致敬:**Mesa**(Python ABM 框架)和 **NetLogo**(25 年历史的智能体仿真语言)。

> 如果 [Dify](https://github.com/langgenius/dify) / [Langflow](https://github.com/langflow-ai/langflow) 关心的是*单 Agent 工作流*,
> MesaLogo 关心的是*多 Agent 的世界*。

---

## 为什么用 MesaLogo

### 对比传统 ABM(NetLogo / Mesa / AnyLogic)

| 能力 | MesaLogo | 传统 ABM |
|---|---|---|
| **规则定义** | 双引擎:自然语言 + 程序逻辑 | 仅程序逻辑 |
| **用户门槛** | 技术 + 非技术用户都能用 | 仅程序员 |
| **监督者** | 内置,自动监控并干预 | 需手动 / 缺失 |
| **交互重点** | 对话与沟通 | 空间 / 状态变化 |
| **控制能力** | MCP 插件(对话 + 真实操作) | 仅状态变化 |
| **应用场景** | 人类对话、决策、协作 | 物理系统、简单行为 |

### 对比 LLM Agent 框架(Dify / Langflow / AutoGen)

| 能力 | MesaLogo | 工作流类框架 |
|---|---|---|
| **多 Agent 协作** | 一等公民:角色、行动空间、模式 | 单 Agent 或简单多轮 |
| **规则系统** | 双引擎(语义 + 逻辑) | 流程图编排 |
| **环境变量** | 模板与实例分离 | 受限,常为全局 |
| **交互仿真** | 真实人类协作模式 | 查询响应循环 |
| **行动空间概念** | ABM 基础上的结构化环境 | 没有 |
| **监督者机制** | 内置监控-干预闭环 | 通常缺失 |
| **最擅长** | 专家小组、辩论、团队协作 | RAG、FAQ、流程自动化 |

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

## 能做什么

### 内置交互模式

- **顺序模式** — 智能体按顺序发言,经典专家小组
- **小组模式** — 开放式专家讨论,监督者主持
- **辩论模式** — 正反双方,结构化轮次
- **协作模式** — 智能体共同解决问题

### 已落地的特性

- ✅ **多 Agent 编排**:并行 + 条件分支
- ✅ **MCP 插件生态**(Model Context Protocol;内置 + 可扩展)
- ✅ **监督者 / 规则沙箱**(安全可控的实验)
- ✅ **知识库**:向量 + BM25 混合检索(LightRAG、Milvus)
- ✅ **并行实验室**:参数扫描
- ✅ **NetLogo 桥接**:ABM 物理 + LLM 认知
- ✅ **OpenAI 兼容 API**:无头集成
- ✅ **多租户 + RBAC**
- ✅ **SSE 流式输出**
- ✅ **Redis 缓存**:支持高吞吐场景

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

## ✨ 亮点 / 即将到来

### 🔮 MemoryPalace v0.51 — 自研时态记忆系统

> **状态:Spec 阶段** · [设计文档](./docs/feature-mempalace-v0.51/)

参考开源项目 [`mempalace`](https://github.com/mempalace/mempalace)(LongMemEval R@5 = 96.6%)的工程实践,在多 Agent ABM 平台语境下重新设计的多层 Agent 记忆系统。

**两层结构,缺一不可:**

- **Drawer 层** — 原文叙事(消息、工具结果、反思),支持衰减与合并
- **Knowledge Graph 层** — 时态三元组 `(subject, predicate, object, valid_from, valid_to)`,回答"现在为真的事实"

**为什么重要:**

- 脱离外部 Graphiti 依赖(HTTP + Neo4j)→ 全本地,全 async,贴合 5000 并发目标
- 能识别"用户先说妻子叫张三,后来又说前妻"这种事实变更,通过 `kg_verify` 自动校验
- `fact_check()` 工具:离线矛盾检测
- 5 层结构:`Realm → Wing → Hall → Room → Closet/Drawer`

**路线图:** 4 个独立 PR(`P1 骨架 → P2 closet+hybrid → P3 KG+反思 → P4 适配器+前端`)。

### 其他正在做的

- 🚧 **Workflow Graph 可视化编排** — 多 Agent DAG 编辑器([`docs/feature-workflow-graph/`](./docs/feature-workflow-graph/))
- 🚧 **5000 并发架构** — async + Redis 队列 + 多机部署([`docs/feature-parallellab/PLAN-5000-concurrency.md`](./docs/feature-parallellab/PLAN-5000-concurrency.md))
- 🚧 **NVIDIA NIM / Isaac Sim 集成** — 物理-认知耦合
- 🚧 **Mesa Python 集成** — 与现有 NetLogo 桥接并存

完整路线图见 [`TODO.md`](./TODO.md)。

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

**核心设计原则**(详见 [`AGENTS.md`](./AGENTS.md)):

- 全 async,请求路径上无阻塞 IO
- 流式用 SSE(不用 WebSocket)
- Supervisor / 规则沙箱是安全边界
- MCP 是工具扩展机制

---

## 快速开始

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
$EDITOR abm-docker/.env             # 至少:设置 MARIADB_ROOT_PASSWORD + LLM API key

# 2. 启动栈。
cd abm-docker
make up
```

这会启动 backend + frontend + MariaDB + Redis + Milvus + Neo4j(可选)。
打开 <http://localhost:3000>。

> 📖 **完整配置指南见 [`docs/SECRETS.md`](./docs/SECRETS.md)**
> (哪些文件需要哪些 key、如何生成强密钥、OAuth 配置等)。

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

> 开发约定见 [`backend-fastapi/AGENTS.md`](./backend-fastapi/AGENTS.md)。

### 生产部署

```bash
./backend-fastapi/start_prod.sh   # gunicorn + uvicorn workers
```

---

## 目录结构

```
MesaLogo/
├── abm-docker/          # 全栈 docker-compose
├── backend-fastapi/     # FastAPI + SQLAlchemy 2.0 + async ⭐
├── frontend/            # React 19 + Antd 6 + @xyflow/react
├── desktop-app/         # Electron 桌面壳(可选)
├── docs/                # 设计文档、计划、架构
│   ├── key-arch/        # 核心架构文档
│   ├── feature-*/       # 各功能计划
│   └── feature-mempalace-v0.51/  # 🔮 新记忆系统设计
├── tests/               # 端到端 + 集成测试
├── tools/               # CLI 工具、生成器
├── third_party/         # 子模块(NetLogo 等)
├── AGENTS.md            # 给 AI 编码助手的工作约定
├── TODO.md              # 实时路线图
└── README.md            # 主 README(英文)
```

---

## 状态与稳定性

| 模块 | 状态 |
|---|---|
| 核心 Agent 循环 / SSE | **稳定** |
| 多 Agent 行动空间 | **稳定** |
| MCP 插件系统 | **稳定** |
| 知识库(LightRAG / Milvus) | **Beta** |
| Workflow Graph(可视化 DAG) | **设计中** |
| MemoryPalace v0.51(新记忆系统) | **Spec 阶段** |
| 5000 并发目标 | **第 1 / 3 阶段** |
| API 稳定性保证 | **Pre-1.0**(可能有破坏性变更) |

这是**活跃研发阶段**的项目。生产部署需要一定的运维经验。

---

## 贡献

欢迎贡献!提 PR 之前请:

1. 读 [`AGENTS.md`](./AGENTS.md) — 仓库通用约定
2. 改后端的话,读 [`backend-fastapi/AGENTS.md`](./backend-fastapi/AGENTS.md)
3. 浏览 `docs/agents/failures/` 下的翻车复盘,避免重蹈覆辙
4. 非平凡改动先开 issue 讨论

**不自动 squash,不自动 push。** 维护者会逐个 review。

### 急需帮助的方向

- 🧠 MemoryPalace v0.51 实现(P1 骨架可以马上开)
- 🔌 新 MCP 插件(尤其是领域工具:GIS、金融、生物)
- 🌐 国际化(英语 / 日语)
- 📚 文档翻译
- 🐛 可复现的 bug 报告
- 🧪 行动空间 / 监督者边界场景的测试用例

---

## 许可

MIT — 见 [`LICENSE`](./LICENSE)。

可以自由使用、修改、分发本软件,包括商业用途。请在重新分发的实质性部分中保留版权声明。

---

## 致谢

MesaLogo 站在巨人的肩膀上:

- **[Mesa](https://github.com/projectmesa/mesa)** — Python ABM 框架,启发了我们的智能体模型
- **[NetLogo](https://ccl.northwestern.edu/netlogo/)** — 25 年的智能体仿真智慧
- **[mempalace](https://github.com/mempalace/mempalace)** — 新记忆系统的设计灵感
- **[FastAPI](https://github.com/tiangolo/fastapi)**、**[React](https://github.com/facebook/react)**、**[Ant Design](https://github.com/ant-design/ant-design)** — Web 栈基石
- **[Milvus](https://github.com/milvus-io/milvus)**、**[LightRAG](https://github.com/HKUDS/LightRAG)** — 向量 + RAG 基础设施
- **[Model Context Protocol](https://github.com/modelcontextprotocol)** — 插件标准
- 所有容忍粗糙边缘的早期贡献者和用户

---

<div align="center">

**用心做,在开源中。**
**如果 MesaLogo 对你有帮助,请点 ⭐ Star。**

[文档](./docs/) · [路线图](./TODO.md) · [English README](./README.md)

</div>
