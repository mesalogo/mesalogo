<div align="center">

# MesaLogo

**Where ABM meets LLM.**
**We're betting the next leap isn't smarter models — it's better worlds for them to live in.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Status: Active](https://img.shields.io/badge/status-active%20development-orange.svg)]()

[中文](./README.zh.md) · [Docs](./docs/) · [Architecture](./docs/key-arch/) · [Roadmap](./TODO.md) · [Design notes (`docs/feature-*`)](./docs/)

</div>

---

## 🧭 What MesaLogo is

A small open-source team's long-running bet on **multi-agent systems**, built at the intersection of two traditions:

- **ABM (Agent-Based Modeling)** — the structural rigor of NetLogo / Mesa: rules, environments, supervisors, action spaces.
- **LLM (Large Language Models)** — the semantic flexibility of GPT-class models: dialogue, reasoning, emergent behavior.

The name honors its ancestors: **Mesa** (Python ABM framework) and **NetLogo** (a 25-year-old language for agent simulation).

> If Dify / Langflow are about *single-agent workflows*, and AutoGen / CrewAI / LangGraph are about *agent crews*,
> MesaLogo is about *multi-agent **worlds*** — places that have rules, supervisors, MCP-driven side effects, and a memory of what happened.

---

## 🧠 Why we built it this way — three bets on LLMs

We don't see LLMs as tools to be wired into workflows. We see them as **inhabitants of structured worlds** we can supervise, orchestrate, and learn from. Three bets follow from that:

| | Our bet | What it looks like in code |
|---|---|---|
| 🌐 | **Action Space, not just Agents.** Agents need a structured world to inhabit — not a flat tool list. | `ActionSpace` is a first-class entity: roles, rules, variables, supervisors, MCP plugins all live inside it. ([`docs/feature-action-space/`](./docs/feature-action-space/)) |
| 🛡️ | **LLMs need a harness, not a leash.** Freedom inside a structure beats restriction outside it. | Supervisor + rule sandbox watches every turn; SubAgents must declare `cross_space=True` to leave their world. ([`docs/feature-supervisor-workflow/`](./docs/feature-supervisor-workflow/)) |
| 🧬 | **Real behavior emerges when cognition meets simulation.** Chat alone won't get us there. | NetLogo bridge + parallel experiment lab + roadmap to Mesa Python + Isaac Sim. ([`docs/feature-parallellab/`](./docs/feature-parallellab/)) |

We're not religious about these — but every feature in this repo can be traced back to one of them.

---

## 🔭 What we're waiting for

The most exciting work in multi-agent systems hasn't happened yet, and much of it lives at the seam where **LLMs**, **social science**, and **simulation** meet. We're building for three shifts we think are close:

- **Cheaper, faster models** → thousands of LLM-driven agents in one run, real experiments instead of demos. Our 5000-concurrency architecture, parallel experiment lab, and Action Space abstraction are bets on that day.
- **Production-ready cognition + simulation** → models reliable enough to play social actors, physics simulators and LLM reasoning sharing one loop, MCP plugins safely reaching real systems.
- **Memory as architecture, not addon** → temporal knowledge graphs, contradiction detection, multi-scale forgetting. MemoryPalace v0.51 is our first serious attempt.

> If any of this resonates, especially if you work in **computational social science, ABM, organizational research, policy simulation, or agentic systems research**, open an issue or start a Discussion.

---

## 🗝️ Key Features

Highlights — full design notes under [`docs/feature-*`](./docs/). Status: **`[x]`** stable · **`[~]`** MVP/Beta · **`[ ]`** spec/planned.

### Current release highlights

- **Research-first ParallelLab workbench.** Frame the research question, inspect
  portfolio readiness, monitor runs, compare analysis, and trace conclusions
  back to run evidence from one experiment workspace.
- **Reviewable AI experiment protocols.** Protocol generation has its own
  feature switch, prompt template, and model selection. A protocol can be
  generated before scan variables are complete, then reviewed and edited before
  it becomes part of an experiment.
- **Truthful run settlement.** Worker callbacks start with fresh database
  sessions, scheduler failures propagate into run outcomes, failed runs never
  enter best-result selection, and an experiment with no successful run settles
  as failed.
- **Service Center for operators.** Administrators get one logical-service
  inventory with health, readiness, dependencies, and image availability.
  Allowlisted start/stop/restart actions are disabled by default and require the
  explicit, security-sensitive Docker control overlay.

### 🧱 Platform foundation

| Status | Feature | One-liner | Design notes |
|---|---|---|---|
| [x] | Action Space — a first-class "world" | Roles, rules, variables, supervisors, MCP tools all live *inside* one space, not as a flat list. | [`feature-action-space/`](./docs/feature-action-space/) |
| [x] | Role ↔ Agent: template / instance split | One "Critic" template can run as N independent agents across N spaces, each with its own state, memory, tool access. | [`feature-role-management/`](./docs/feature-role-management/) |
| [x] | Variable system — template / instance / cross-space | Not just prompt variables, but a state channel between action spaces. | [`feature-variables/`](./docs/feature-variables/) |
| [x] | Multi-tenancy + RBAC + workspaces | `created_by` / `is_shared` on every resource; enterprise-ready out of the box. | [`feature-multi-tenancy/`](./docs/feature-multi-tenancy/) |
| [x] | UUID-native resource IDs | All core resources are UUIDs, friendly to cross-instance migration. | [`feature-uuid/`](./docs/feature-uuid/) |

### ✍️ Creation experience

| Status | Feature | One-liner | Design notes |
|---|---|---|---|
| [ ] | Magic Journal — "narrate freely → AI builds your world" | A four-pane workbench (notes list / notebook / AI comment stream / action panel). You write down what you want like a journal entry; AI parses it paragraph-by-paragraph into concrete `ActionSpace` / `Role` / `Rule` / `Variable` / `Plan` scaffolds. Low-risk actions auto-execute; high-risk ones queue for one-click confirmation. SSE-streamed, `@`-mention existing entities. | — |

### 🎭 Multi-agent interaction

| Status | Feature | One-liner | Design notes |
|---|---|---|---|
| [ ] | Advanced interaction modes modeled on human social organization | More deliberative, more institutional multi-agent dynamics; design ongoing. | — |
| [x] | Supervisor + dual-engine rule sandbox | Natural-language rules + programmatic logic rules; supervisor intervenes in real time. | [`feature-supervisor-workflow/`](./docs/feature-supervisor-workflow/) · `supervisor_*.py` · `rule_sandbox.py` |
| [x] | Observer with multi-tier intervention | `round_based` triggering × `passive`/active intervention modes; decides *when* and *how strongly* the supervisor steps in. | `ObserverManagement.tsx` |
| [x] | Smart Dispatch — auto routing to the best agent | When a user message arrives, picks the most suitable agent without `@`-mentioning. Hot-path with LRU caches sized for a 260k-row conversation–agent table. | `smart_dispatch_service.py` · `core/model_cache.py` |
| [~] | Cross-space orchestration (`cross_space`) | SubAgents must explicitly declare crossing space boundaries; the supervisor blocks undeclared crossings. | [`feature-subagent/`](./docs/feature-subagent/) · [`feature-workflow-graph/`](./docs/feature-workflow-graph/) |
| [x] | Resource-relation visualizer | See the live web of `ActionSpace ↔ Role ↔ Agent ↔ Rule ↔ Variable` in the UI. | [`feature-ui-resource-graph/`](./docs/feature-ui-resource-graph/) |
| [ ] | Heartbeat — ABM-tick-driven "living" agents | Every Agent has its own beat; even with no one chatting, it runs `observe → reflect/plan → act`. ActionSpace closes ⇒ heartbeat stops. Inspired by Mesa `step()` / NetLogo `tick` / Stanford Generative Agents. | [`feature-heartbeat/`](./docs/feature-heartbeat/) |
| [ ] | Background brain — adaptive cadence, continuous learning, platform brain | Extends Heartbeat along three axes: beat rate as a function of system pressure × per-agent priority (foreground requests are never starved by background thinking); a learning closure where reflections become skills / rules / preferences only after passing an evaluation gate, with shadow-first rollout, rollback, and decay; and a system-scope platform brain that reads telemetry and writes reviewable insights, never applying changes itself. | [`PLAN-background-brain.md`](./docs/feature-heartbeat/PLAN-background-brain.md) |
| [ ] | True parallel multi-agent execution | Independent SSE streams + isolated queues per agent; ends shared-stream interleaving. | `TODO.md#7` |

### 🪆 SubAgent / Agent-as-Tool

| Status | Feature | One-liner | Design notes |
|---|---|---|---|
| [~] | SubAgent nesting via MCP | `invoke_agent` / `invoke_agents` / `list_available_agents` exposed as MCP tools; Phase 1 MVP shipped. | [`feature-subagent/`](./docs/feature-subagent/) |
| [x] | SubAgent sandbox | executor / context_builder / security as three separate layers. | [`feature-subagent/`](./docs/feature-subagent/) |
| [~] | ODM — structured agent protocols | IDL-style contracts on SubAgent inputs / outputs. | [`feature-odm/`](./docs/feature-odm/) |

### 🔌 MCP ecosystem (more than just an MCP client)

| Status | Feature | One-liner | Design notes |
|---|---|---|---|
| [x] | MCP Server Manager | Full lifecycle: register / start / stop / health-check / isolation. Not "we call MCP tools" — we *operate* MCP servers. | `mcp_server_manager.py` (73 KB) |
| [x] | MCP server isolation | MCP instances in different spaces don't bleed into each other. | [`feature-mcp-server-isolation/`](./docs/feature-mcp-server-isolation/) |
| [~] | MCP → API gateway (`mcp2apimcp`) | Expose any MCP server as a standard HTTP API so legacy systems can call it. | [`feature-mcp2apimcp/`](./docs/feature-mcp2apimcp/) |

### 🎯 Orchestration & autonomy

| Status | Feature | One-liner | Design notes |
|---|---|---|---|
| [ ] | Workflow Graph — visual DAG editor | ReactFlow-based; node types: agent / condition / parallel / loop. | [`feature-workflow-graph/`](./docs/feature-workflow-graph/) |
| [x] | Planner — structured plan items | `create_plan` / `update_plan_item` / `get_plan` as MCP tools + frontend `PlannerPanel` + live SSE updates. | [`feature-planner/`](./docs/feature-planner/) |
| [x] | Autonomous Task — three trigger modes | Time-triggered, variable-triggered, self-driven scheduling. | [`feature-autonomous/`](./docs/feature-autonomous/) |
| [~] | Parallel Experiment Lab | Research workbench for parameter sweeps across LLM-agent populations, with reviewable AI behavior protocols, run monitoring, analysis, evidence views, and explicit failed-run accounting. | [`current plan`](./docs/feature-parallellab/PLAN-parallellab.md) · [`v2 research design (draft)`](./docs/feature-parallellab/PLAN-cognitive-simulation-v2.md) |
| [~] | Job queue / task manager | Redis + thread pool + handler-registry pattern. | [`feature-job-queue/`](./docs/feature-job-queue/) |

### 🧬 Memory & knowledge

| Status | Feature | One-liner | Design notes |
|---|---|---|---|
| [ ] | MemoryPalace v0.51 — temporal-KG memory | `(subject, predicate, object, valid_from, valid_to)` triples; built-in `kg_verify` + offline `fact_check()`; 5-layer `Realm → Wing → Hall → Room → Drawer`. Drops external Graphiti dependency, fully local, fully async. | [`feature-mempalace-v0.51/`](./docs/feature-mempalace-v0.51/) |
| [~] | Memory partitions (global / agent / conversation) | Strict isolation with cross-partition policies. | [`PLAN-memory-partition.md`](./docs/feature-memory/PLAN-memory-partition.md) |
| [~] | Graphiti-style community detection | Auto-discover communities within memory graphs. | [`PLAN-COMMUNITIES-GRAPH.md`](./docs/feature-memory/PLAN-COMMUNITIES-GRAPH.md) |
| [~] | LightRAG + Milvus + BM25 hybrid retrieval | Knowledge graph × vector × full-text, three lanes in parallel. | [`lightrag-PLAN.md`](./docs/feature-knowledge-base/lightrag-PLAN.md) · [`feature-vector-db/`](./docs/feature-vector-db/) |
| [x] | Document parser pipeline | PDF / Word / Excel pre-processing before ingestion. | [`feature-document-parser/`](./docs/feature-document-parser/) |
| [x] | Production-grade context engineering | Summary service strips `tool_call` args before next round; auto-summarize for long sessions. Most frameworks have blown up on this; we paid the price already. | [`feature-auto-summarize/`](./docs/feature-auto-summarize/) |

### 🏪 Entity apps & integrations

| Status | Feature | One-liner | Design notes |
|---|---|---|---|
| [~] | Entity App Market (Applization) | NetLogo / GIS / RPA / RPG / VSCode etc. mount into an action space as first-class apps. | [`feature-applization/`](./docs/feature-applization/) · [`feature-market/`](./docs/feature-market/) |
| [x] | NetLogo bridge | Bidirectional ABM-physics × LLM-cognition; via `third_party/Galapagos`. | — |
| [ ] | Mesa Python integration | Alongside NetLogo. | `TODO.md` Phase 4 |
| [x] | OpenAI-compatible API + Python SDK | Action spaces, agents, knowledge bases all callable externally; API key mgmt + rate limit + OpenAPI docs. | [`feature-openai-export/`](./docs/feature-openai-export/) |
| [x] | External role import — Coze & FastGPT | Pull agents from third-party platforms with one line of config. | [`PLAN-role-coze.md`](./docs/feature-role-management/PLAN-role-coze.md) · [`PLAN-role-fastgpt.md`](./docs/feature-role-management/PLAN-role-fastgpt.md) |
| [x] | Multimodal image input | Paste or upload images into task conversations, with attachment preview, removal, and normalized message payload handling. | [`feature-image-input/`](./docs/feature-image-input/) |

### 🛠️ Engineering & culture

| Status | Feature | One-liner | Design notes |
|---|---|---|---|
| [x] | Fully async backend | FastAPI + SQLAlchemy 2.0 + httpx; no blocking I/O on request paths (AGENTS.md red-line). | [`AGENTS.md`](./AGENTS.md) |
| [x] | SSE streaming with cancel & keep-alive | Long sessions kept alive; mid-stream cancel supported. | [`feature-stream-cancel/`](./docs/feature-stream-cancel/) · [`feature-keep-alive-conversation/`](./docs/feature-keep-alive-conversation/) |
| [x] | Three-bag `ModelConfig` | Strict split between `custom_headers` / `custom_body` / `additional_params`, merged through `app/services/llm_http`. | [`model-config-custom-params.md`](./docs/agents/model-config-custom-params.md) |
| [~] | Service Center — runtime inventory & health | Admin-only logical-service inventory and dependency-aware health/readiness checks; allowlisted lifecycle control is opt-in behind a Docker socket overlay. | [`feature-service-center/`](./docs/feature-service-center/) · [`deployment guide`](./abm-docker/README.md) |
| [x] | Strict i18n | Per-feature namespaces; zh/en key-consistency checked by `pnpm run i18n:check-keys`; zero hard-coded CJK in frontend source, enforced by an AST scanner (`pnpm run i18n:check-cjk`). Both are run locally before commit. | [`feature-multi-lang/`](./docs/feature-multi-lang/) · [`docs/agents/i18n.md`](./docs/agents/i18n.md) |
| [x] | AGENTS.md-driven development culture | An "onboarding manual" for AI coding agents; every red line traces back to a real incident; release contract written down. Rare in open-source — this *is* a feature. | [`docs/agents/failures/`](./docs/agents/failures/) · [`release-flow.md`](./docs/agents/release-flow.md) |

---

## 🧩 Core concepts

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

> Full data model: [`docs/key-arch/KEY-RESOURCES-RELATIONS.md`](./docs/key-arch/KEY-RESOURCES-RELATIONS.md).

---

## 📊 How MesaLogo compares

### vs Traditional ABM (NetLogo · Mesa · AnyLogic)

| Capability | MesaLogo | Traditional ABM |
|---|---|---|
| Rule definition | Dual engine: natural-language + programmatic | Code-only |
| User barrier | Technical *and* non-technical | Programmers only |
| Supervisor | Built-in, monitors and intervenes | Manual / absent |
| Interaction focus | Dialogue and communication | Spatial / state changes |
| Control surface | MCP plugins (dialogue + real-world action) | State changes only |
| Use cases | Human conversation, decision, collaboration | Physics, simple behaviors |

### vs LLM Agent frameworks (Dify · Langflow · AutoGen · CrewAI · LangGraph · OpenAI Swarm · Claude Agent SDK)

| Capability | MesaLogo | Most LLM agent frameworks |
|---|---|---|
| **Action Space** as first-class abstraction | ✅ Roles, rules, variables, supervisor live *inside* a space | ❌ Flat agent / tool lists |
| **Supervisor + rule sandbox** as safety boundary | ✅ Built into the runtime | ⚠️ Usually left to the developer |
| **Cross-space orchestration** with variable propagation | ✅ Explicit `cross_space` declaration | ❌ Not a concept |
| **ABM bridge** (NetLogo today, Mesa / Isaac Sim coming) | ✅ Cognition × physics in one platform | ❌ |
| **MCP server manager** (not just MCP client) | ✅ Registry, isolation, MCP→API gateway | ⚠️ Client-side only, if at all |
| **Parallel experiment lab** (param sweeps over agents) | ✅ | ❌ |
| **Multi-tenancy + RBAC + OpenAI-compatible API** out of the box | ✅ | ⚠️ Varies |
| Best at | Expert panels, debates, simulations, controlled multi-agent worlds | RAG, FAQ bots, task automation, single-agent chains |

---

## ✨ What it can do

### Built-in interaction modes
- **Sequential** — agents speak in order; classic panel.
- **Panel** — open expert discussion, supervisor moderates.
- **Debate** — pro/con sides, structured rounds.
- **Collaborative** — agents jointly solve a problem.

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

## 🛠️ Architecture

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

**Design principles** ([`AGENTS.md`](./AGENTS.md)):
- All async; no blocking IO in request paths.
- SSE for streaming (no WebSocket).
- Supervisor / rule sandbox is the safety boundary.
- MCP is the tool-extensibility surface.

---

## 🚦 Quick Start (full)

### Requirements
- Python 3.13+ (project uses 3.13.5)
- Node 20+ and pnpm
- Docker (for the full stack: MariaDB, Redis, Milvus)

### Docker (recommended)

```bash
git clone https://github.com/mesalogo/mesalogo.git
cd mesalogo

# 1. Copy secrets / config templates and fill in your values.
#    Full guide: docs/SECRETS.md
cp abm-docker/.env.example          abm-docker/.env
cp abm-docker/lightrag.env.example  abm-docker/lightrag.env
cp abm-docker/config.conf.example   abm-docker/config.conf
cp abm-docker/mcp_config.json.example abm-docker/mcp_config.json
$EDITOR abm-docker/.env             # at minimum: MARIADB_ROOT_PASSWORD + LLM API key

# 2. Boot the stack.
cd abm-docker
make up
```

Boots backend + frontend + MariaDB + Redis + Milvus + Neo4j (optional). Open <http://localhost:16000> (backend API on `16001`; all host ports live in the `16000` range).

> 📖 **Read [`docs/SECRETS.md`](./docs/SECRETS.md)** for the full configuration walk-through.

### Development

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

> Backend development conventions: [`backend-fastapi/AGENTS.md`](./backend-fastapi/AGENTS.md).

### Production

```bash
./backend-fastapi/start_prod.sh   # gunicorn + uvicorn workers
```

---

## 🤝 Contributing

We welcome contributions. Before opening a PR:

1. Read [`AGENTS.md`](./AGENTS.md) — repo-wide conventions.
2. Read [`backend-fastapi/AGENTS.md`](./backend-fastapi/AGENTS.md) if your change touches backend.
3. Skim `docs/agents/failures/` to avoid known traps.
4. Open an issue first for non-trivial changes.

**No automatic squash. No automatic push.** Maintainers review every PR.

### Where we'd love help
- 🧠 MemoryPalace v0.51 implementation (P1 skeleton is ready to start)
- 🔌 New MCP plugins (especially domain-specific: GIS, finance, biology)
- 🌐 Internationalization (English / Japanese)
- 📚 Documentation translation
- 🐛 Bug reports with reproducible cases
- 🧪 Test cases for action spaces and supervisor edge cases

---

## 📜 License

MIT — see [`LICENSE`](./LICENSE).

You may use, modify, and distribute this software freely, including for commercial purposes. We ask that you keep the copyright notice in any substantial portion you redistribute.

---

## 🙏 Acknowledgments

MesaLogo stands on the shoulders of giants:

- **[Mesa](https://github.com/projectmesa/mesa)** — the Python ABM framework that informs our agent model.
- **[NetLogo](https://ccl.northwestern.edu/netlogo/)** — 25 years of agent simulation wisdom.
- **[mempalace](https://github.com/mempalace/mempalace)** — design inspiration for the new memory system.
- **[FastAPI](https://github.com/tiangolo/fastapi)**, **[React](https://github.com/facebook/react)**, **[Ant Design](https://github.com/ant-design/ant-design)** — the foundational web stack.
- **[Milvus](https://github.com/milvus-io/milvus)**, **[LightRAG](https://github.com/HKUDS/LightRAG)** — vector + RAG infrastructure.
- **[Model Context Protocol](https://github.com/modelcontextprotocol)** — the plugin standard.
- All early contributors and adopters who tolerated rough edges.

---

<div align="center">

**Built with care, in the open.**
**Star ⭐ this repo if MesaLogo helps your work — or if you share the bets above.**

[Docs](./docs/) · [Roadmap](./TODO.md) · [中文 README](./README.zh.md)

</div>
