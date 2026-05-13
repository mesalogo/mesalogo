<div align="center">

# MesaLogo

**Where ABM meets LLM — a multi-agent simulation platform for cognitive, organizational, and social systems.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Status: Active](https://img.shields.io/badge/status-active%20development-orange.svg)]()

[中文](./README.zh.md) · [Documentation](./docs/) · [Architecture](./docs/key-arch/) · [Roadmap](./TODO.md)

</div>

---

## What is MesaLogo

**MesaLogo** is a multi-agent simulation platform that fuses two worlds:

- **ABM (Agent-Based Modeling)** — the structural rigor of NetLogo / Mesa: rules, environments, supervisors, action spaces.
- **LLM (Large Language Models)** — the semantic flexibility of GPT-class models: dialogue, reasoning, emergent behavior.

The name pays homage to its two ancestors: **Mesa** (Python ABM framework) and **NetLogo** (a 25-year-old language for agent simulation).

> If [Dify](https://github.com/langgenius/dify) / [Langflow](https://github.com/langflow-ai/langflow) are about *single-agent workflows*,
> MesaLogo is about *multi-agent worlds*.

---

## Why MesaLogo

### vs Traditional ABM (NetLogo / Mesa / AnyLogic)

| Capability | MesaLogo | Traditional ABM |
|---|---|---|
| **Rule definition** | Dual engine: natural-language + programmatic | Code-only |
| **User barrier** | Both technical and non-technical | Programmers only |
| **Supervisor** | Built-in, monitors and intervenes | Manual / absent |
| **Interaction focus** | Dialogue and communication | Spatial / state changes |
| **Control surface** | MCP plugins (dialogue + real-world action) | State changes only |
| **Use cases** | Human conversation, decision, collaboration | Physics, simple behaviors |

### vs LLM Agent Frameworks (Dify / Langflow / AutoGen)

| Capability | MesaLogo | Workflow-style frameworks |
|---|---|---|
| **Multi-agent collaboration** | First-class: roles, action spaces, modes | Single agent or simple multi-turn |
| **Rule system** | Dual-engine hybrid (semantic + logical) | Flowchart orchestration |
| **Environment variables** | Template ↔ instance separation | Limited, often global |
| **Interaction simulation** | Real human collaboration patterns | Query-response loops |
| **Action space concept** | ABM-grounded structured environments | None |
| **Supervisor mechanism** | Built-in monitor-and-intervene loop | Generally absent |
| **Best at** | Expert panels, debates, team dynamics | RAG, FAQ bots, task automation |

---

## Core Concepts

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│     Tenant ──► ActionSpace ──► ActionTask ──► Conversation       │
│                    │                                             │
│                    ├─► Roles ──► Agents (LLM-driven)             │
│                    ├─► Rules (NL + logic, hybrid)                │
│                    ├─► Variables (template / instance)           │
│                    ├─► Supervisor (auto-monitor, intervene)      │
│                    └─► MCP Plugins (real-world actions)          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

- **Action Space** — the structured world an agent inhabits (one expert panel, one debate, one RPG quest).
- **Role** — a reusable agent template (the "Critic", the "Doctor", the "Customer").
- **Agent** — a Role instantiated in an Action Space, with its own state, memory, and tool access.
- **Supervisor** — a meta-agent that watches the simulation and steps in when rules are broken.
- **MCP Plugin** — Model Context Protocol tool servers that let agents take real actions (call APIs, control devices, run code).

> Detailed model: [`docs/key-arch/KEY-RESOURCES-RELATIONS.md`](./docs/key-arch/KEY-RESOURCES-RELATIONS.md).

---

## What it can do

### Built-in interaction modes

- **Sequential** — agents speak in order, classic panel
- **Panel** — open expert discussion, supervisor moderates
- **Debate** — pro/con sides, structured rounds
- **Collaborative** — agents jointly solve a problem

### Production-ready features

- ✅ **Multi-agent orchestration** with parallel and conditional execution
- ✅ **MCP plugin ecosystem** (Model Context Protocol; built-in + extensible)
- ✅ **Supervisor / rule sandbox** for safe controlled experiments
- ✅ **Knowledge bases** with vector + BM25 hybrid search (LightRAG, Milvus)
- ✅ **Parallel experiment lab** for parameter sweeps
- ✅ **NetLogo bridge** for combining ABM physics with LLM cognition
- ✅ **OpenAI-compatible API** for headless integration
- ✅ **Multi-tenancy** with role-based access control
- ✅ **Streaming SSE** for real-time agent output
- ✅ **Redis caching** for high-throughput scenarios

### Example use cases

| Scenario | Why MesaLogo fits |
|---|---|
| Strategic decision rooms (boards, war games) | Multiple agents play distinct roles with dialogue |
| Multi-specialist medical consultation | Each specialist agent reasons in its own domain |
| Classroom debate / case study simulation | Built-in debate mode + supervisor |
| Policy impact simulation | Stakeholder agents with diverging incentives |
| Customer service training | Rule-bound agents with real tool access |
| Smart-home / IoT control | Agents discuss → MCP plugins act |
| Synthetic data generation | Agents converse to produce labeled corpora |

---

## ✨ Roadmap

A snapshot of where we're heading. Full source of truth: [`TODO.md`](./TODO.md).

### 🔮 Near-term (active development)

| Feature | What it is | Status |
|---|---|---|
| **MemoryPalace v0.51** | Self-hosted temporal memory (Drawer + Knowledge Graph layers, replaces external Graphiti dependency). Catches fact mutations via `kg_verify` + `fact_check()`. 5-layer hierarchy `Realm → Wing → Hall → Room → Closet/Drawer`. ([design docs](./docs/feature-mempalace-v0.51/)) | 📐 Spec phase, 4 PRs planned (P1 skeleton → P4 frontend) |
| **Agent Heartbeat** | Per-agent configurable inner clock that ticks even when no human is talking — drives `reflect` / `plan_progress` / `speak_if_due` / `poll` / `noop` policies. ABM-tick skeleton (Mesa / NetLogo style) + Generative-Agent inner-loop semantics, bounded by ActionSpace lifecycle. ([design docs](./docs/feature-heartbeat/PLAN.md)) | 📐 Spec phase, P1 skeleton → P4 cross-process |
| **Workflow Graph orchestration** | Visual DAG editor for multi-agent flows: agent / condition / parallel / loop nodes, cross-action-space variable propagation, orchestration template marketplace. ([plan](./docs/feature-workflow-graph/PLAN.md)) | 🚧 Phase 1 in progress |
| **5000-concurrency architecture** | Async-first refactor → Redis queue & worker separation → distributed multi-machine deploy. ([plan](./docs/feature-parallellab/PLAN-5000-concurrency.md)) | 🚧 Phase 1 of 3 (async migration) |
| **True parallel agent execution** | Per-agent isolated output queues so multi-agent panels stream without interleaving; multi-column frontend rendering, cancellation & timeout per stream. | 📋 Planned |
| **SubAgent Phase 2 / 3** | Nested SubAgents with tool calls, ODM constraints, token accounting; later: call-graph visualization, result cache, config templates. ([plan](./docs/feature-subagent/PLAN.md)) | ✅ Phase 1 MVP shipped, Phase 2+ planned |
| **Workflow planner — sub-planning** | Browse historical plans of a conversation, nest sub-plans so different roles can pursue different sub-tasks in parallel. | 📋 Planned |
| **LightRAG knowledge base — completion** | Batch / incremental document import, partition isolation (conversation / agent / global), frontend polish, MCP-tool exposure. ([plan](./docs/feature-knowledge-base/lightrag-PLAN.md)) | 🚧 Beta, gaps to close |

### 🚀 Mid-term

| Feature | What it is | Status |
|---|---|---|
| **Mesa Python ABM bridge** | First-class adapter alongside the existing NetLogo bridge; unified ABM bridge service + MCP servers (`mesa_server.py`, `netlogo_server.py`). | 📋 Planned |
| **NVIDIA NIM inference backend** | Use NIM microservices as a pluggable LLM backend; Nemotron model support; basic GPU resource management. | 📋 Planned |
| **Isaac Sim physics ↔ cognition bridge** | Couple Isaac Sim physical state with LLM agent cognitive state; warehouse / factory scenario demos. | 📋 Planned |
| **ACE digital-human visualization** | NVIDIA ACE avatars for multi-role agent meetings; voice interaction. | 📋 Planned |
| **OAuth providers** | Google / Microsoft / Apple / generic OIDC + OAuth2 login flows. | 🚧 In progress |
| **External-platform IM integrations** | WeChat / DingTalk / generic IM webhook for agent-in-the-loop. | 📋 Planned |
| **Domain entity apps** | RPG game world, RPA (customs scenario), GIS map MCP tools (`add_map_layer`, `set_map_view`, `draw_map_geometry`, …). ([RPA plan](./docs/feature-nextrpa/PLAN.md)) | 📋 Planned |
| **Frontend polish** | DeepSeek mermaid rendering, unified front-back env-var management. | 📋 Planned |

### 🏢 Long-term — enterprise & ecosystem

| Theme | What it is |
|---|---|
| **Large-scale simulation** | Optimization for 1000+ concurrent agents per action space. |
| **Synthetic data pipelines** | Reproducible corpus generation from multi-agent dialogues with labeling hooks. |
| **Multi-tenant SaaS** | Stricter isolation, per-tenant quotas, billing-ready primitives. |
| **Private deployment kit** | Air-gapped install, offline model bundles, license server. |
| **Plugin marketplace** | First-party + community MCP plugins with signing / supply-chain checks. |

### ✅ Recently shipped

- SubAgent Phase 1 MVP (executor / context builder / security / MCP tools / frontend cards)
- Agent-API exposure (OpenAI-compatible) with API-key management + rate limiting + Python SDK + OpenAPI docs
- Autonomous task framework refactored on top of the orchestration engine
- Summary-service context-window optimization (strips raw tool-call args between rounds)
- Repo-wide `print()` → structured `logger` migration
- Claude `<tool_call>` round-trip parity

### 🐛 Known bugs being chased

- Autonomous task sometimes can't be stopped cleanly (Redis queue + scheduler triggers + SSE need joint teardown).
- HTTP 400 from upstream model isn't propagated to the SSE `done` event → frontend spinner hangs.
- Auto-dispatch mode: pick the best-fitting role for an incoming message automatically.

See [`TODO.md`](./TODO.md) for the full backlog, design docs, and per-phase plans.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Frontend                               │
│            React 19 + Antd 6 + @xyflow/react                    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ SSE / REST
┌──────────────────────────────▼──────────────────────────────────┐
│                        FastAPI Backend                          │
│   ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐     │
│   │ Agents /   │  │ Supervisors │  │ MCP Plugin Manager   │     │
│   │ Roles      │  │ Rule sandbox│  │ (built-in + custom)  │     │
│   └────────────┘  └─────────────┘  └──────────────────────┘     │
│   ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐     │
│   │ SubAgents  │  │ Scheduler   │  │ Memory / Knowledge   │     │
│   │ (nested)   │  │ + Job Queue │  │ (LightRAG + Milvus)  │     │
│   └────────────┘  └─────────────┘  └──────────────────────┘     │
└────┬──────────┬──────────┬───────────────┬─────────────────────┘
     │          │          │               │
┌────▼─────┐ ┌──▼──────┐ ┌─▼──────┐  ┌─────▼──────────┐
│ MariaDB  │ │ Redis   │ │ Milvus │  │ LLM Backends   │
│ (state)  │ │ (cache) │ │(vector)│  │ OpenAI / Claude│
│          │ │         │ │        │  │ Gemini / Local │
└──────────┘ └─────────┘ └────────┘  └────────────────┘
```

**Key design principles** ([details](./AGENTS.md)):

- All async; no blocking IO in request paths
- SSE for streaming (no WebSocket)
- Supervisor / rule sandbox is the safety boundary
- MCP for tool extensibility

---

## Quick Start

### Requirements

- Python 3.13+ (project uses 3.13.5)
- Node 20+ and pnpm
- Docker (for full stack: MariaDB, Redis, Milvus)

### Run with Docker (recommended)

```bash
git clone https://github.com/yourname/MesaLogo.git
cd MesaLogo

# 1. Copy secrets/config templates and fill in your values.
#    Full guide: docs/SECRETS.md
cp abm-docker/.env.example          abm-docker/.env
cp abm-docker/lightrag.env.example  abm-docker/lightrag.env
cp abm-docker/config.conf.example   abm-docker/config.conf
cp abm-docker/mcp_config.json.example abm-docker/mcp_config.json
$EDITOR abm-docker/.env             # at minimum: set MARIADB_ROOT_PASSWORD + your LLM API key

# 2. Boot the stack.
cd abm-docker
make up
```

This boots backend + frontend + MariaDB + Redis + Milvus + Neo4j (optional).
Open <http://localhost:3000>.

> 📖 **See [`docs/SECRETS.md`](./docs/SECRETS.md) for the full configuration guide**
> (which files need which keys, how to generate strong secrets, OAuth setup, etc.).

### Run for development

**Backend:**

```bash
cd backend-fastapi
pip install -e .
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

**Frontend:**

```bash
cd frontend
pnpm install
pnpm dev
```

> See [`backend-fastapi/AGENTS.md`](./backend-fastapi/AGENTS.md) for development conventions.

### Production

```bash
./backend-fastapi/start_prod.sh   # gunicorn + uvicorn workers
```

---

## Project Structure

```
MesaLogo/
├── abm-docker/          # docker-compose for full stack
├── backend-fastapi/     # FastAPI + SQLAlchemy 2.0 + async stack ⭐
├── frontend/            # React 19 + Antd 6 + @xyflow/react
├── desktop-app/         # Electron wrapper (optional)
├── docs/                # Design docs, plans, architecture
│   ├── key-arch/        # Core architecture docs
│   ├── feature-*/       # Per-feature plans
│   └── feature-mempalace-v0.51/  # 🔮 New memory system spec
├── tests/               # End-to-end + integration tests
├── tools/               # CLI helpers, generators
├── third_party/         # Submodules (NetLogo, etc.)
├── AGENTS.md            # Conventions for AI coding assistants
├── TODO.md              # Live roadmap
└── README.md            # This file
```

---

## Status & Stability

| Area | Status |
|---|---|
| Core agent loop / SSE | **Stable** |
| Multi-agent action spaces | **Stable** |
| MCP plugin system | **Stable** |
| Knowledge bases (LightRAG / Milvus) | **Beta** |
| Workflow Graph (visual DAG) | **In design** |
| MemoryPalace v0.51 (new memory system) | **Spec phase** |
| 5000-concurrency target | **Phase 1 of 3** |
| API stability guarantees | **Pre-1.0** (expect breaking changes) |

This is **active research-grade software**. Production deployment requires ops experience.

---

## Contributing

We welcome contributions! Before opening a PR:

1. Read [`AGENTS.md`](./AGENTS.md) — repo-wide conventions
2. Read [`backend-fastapi/AGENTS.md`](./backend-fastapi/AGENTS.md) if your change touches backend
3. Look for failure-mode docs under `docs/agents/failures/` to avoid known traps
4. Open an issue first for non-trivial changes

**No automatic squash, no automatic push.** Maintainers review every PR.

### Areas where we'd love help

- 🧠 MemoryPalace v0.51 implementation (P1 skeleton ready to start)
- 🔌 New MCP plugins (especially domain-specific: GIS, finance, biology)
- 🌐 Internationalization (English / Japanese)
- 📚 Documentation translation
- 🐛 Bug reports with reproducible cases
- 🧪 Test cases for action spaces and supervisor edge cases

---

## License

MIT — see [`LICENSE`](./LICENSE).

You may use, modify, and distribute this software freely, including for commercial purposes. We ask that you keep the copyright notice in any substantial portion you redistribute.

---

## Acknowledgments

MesaLogo stands on the shoulders of giants:

- **[Mesa](https://github.com/projectmesa/mesa)** — the Python ABM framework that informs our agent model
- **[NetLogo](https://ccl.northwestern.edu/netlogo/)** — 25 years of agent simulation wisdom
- **[mempalace](https://github.com/mempalace/mempalace)** — design inspiration for the new memory system
- **[FastAPI](https://github.com/tiangolo/fastapi)**, **[React](https://github.com/facebook/react)**, **[Ant Design](https://github.com/ant-design/ant-design)** — the foundational web stack
- **[Milvus](https://github.com/milvus-io/milvus)**, **[LightRAG](https://github.com/HKUDS/LightRAG)** — vector + RAG infrastructure
- **[Model Context Protocol](https://github.com/modelcontextprotocol)** — the plugin standard
- All early contributors and adopters who tolerated rough edges

---

<div align="center">

**Built with care, in the open.**
**Star ⭐ this repo if MesaLogo helps your work.**

[Documentation](./docs/) · [Roadmap](./TODO.md) · [中文 README](./README.zh.md)

</div>
