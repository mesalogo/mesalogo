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

## ✨ Highlights / Coming Up

### 🔮 MemoryPalace v0.51 — Self-hosted Temporal Memory

> **Status: Spec phase** · [Design docs](./docs/feature-mempalace-v0.51/)

A multi-layer agent memory system inspired by the open-source [`mempalace`](https://github.com/mempalace/mempalace) project (LongMemEval R@5 = 96.6%), adapted for our multi-agent ABM context.

**Two layers, neither sufficient alone:**

- **Drawer layer** — verbatim narrative (messages, tool results, reflections), supports decay and consolidation
- **Knowledge Graph layer** — temporal triples `(subject, predicate, object, valid_from, valid_to)` for "what is true *now*" queries

**Why this matters:**

- Drops the external Graphiti dependency (HTTP + Neo4j) → fully local, all async, fits the 5000-concurrency target
- Catches "the user said his wife's name was X but later said *ex*-wife" with `kg_verify`
- `fact_check()` tool with offline contradiction detection
- 5-layer hierarchy: `Realm → Wing → Hall → Room → Closet/Drawer`

**Roadmap:** 4 independent PRs (`P1 skeleton → P2 closet+hybrid → P3 KG+reflection → P4 adapter+frontend`).

### Other in-progress features

- 🚧 **Workflow Graph orchestration** — visual DAG editor for multi-agent flows ([`docs/feature-workflow-graph/`](./docs/feature-workflow-graph/))
- 🚧 **5000-concurrency architecture** — async + Redis queue + multi-machine ([`docs/feature-parallellab/PLAN-5000-concurrency.md`](./docs/feature-parallellab/PLAN-5000-concurrency.md))
- 🚧 **NVIDIA NIM / Isaac Sim integration** — physics-cognition coupling
- 🚧 **Mesa Python integration** — alongside existing NetLogo bridge

See [`TODO.md`](./TODO.md) for the full roadmap.

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
