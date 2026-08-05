<div align="center">

# MesaLogo

**A multi-agent platform that combines agent-based modeling structure with LLM reasoning.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Status: Active](https://img.shields.io/badge/status-active%20development-orange.svg)]()

[中文](./README.zh.md) · [Docs](./docs/) · [Architecture](./docs/key-arch/) · [Roadmap](./TODO.md) · [Design notes (`docs/feature-*`)](./docs/)

</div>

---

## What MesaLogo is

An open-source platform for building and running multi-agent systems, drawing on two traditions:

- **ABM (Agent-Based Modeling)** — structural conventions from NetLogo / Mesa: rules, environments, supervisors, bounded action spaces.
- **LLM (Large Language Models)** — dialogue and reasoning as the mechanism driving agent behavior.

The name references **Mesa** (Python ABM framework) and **NetLogo** (agent simulation language, first released 1999).

The organizing abstraction is the **Action Space**: a bounded environment holding roles, rules, variables, a supervisor, and MCP tool servers. Agents run inside a space rather than against a flat tool list. Compared with workflow-oriented tools (Dify, Langflow) or agent-crew libraries (AutoGen, CrewAI, LangGraph), the emphasis is on that boundary and on the supervisor that enforces it.

### Project status

Active development. Core paths — Action Space, Role/Agent separation, MCP server lifecycle, Planner, autonomous tasks, NetLogo bridge — are usable for research, demos, and pilot deployments. Several advertised areas are still MVP or unimplemented, and test coverage is uneven.

Read [`docs/agents/feature-readiness.md`](./docs/agents/feature-readiness.md) before adopting this for anything load-bearing. It is an evidence-based snapshot, including the parts that are not ready.

Design direction, if you want to know where this is heading: larger agent populations per run, tighter coupling between simulation and LLM reasoning, and memory as a temporal knowledge graph rather than a retrieval add-on. Concrete plans live in [`docs/feature-*`](./docs/) and [`TODO.md`](./TODO.md).

If you work in computational social science, ABM, organizational research, policy simulation, or agentic systems research, issues and discussions are welcome.

---

## Feature catalog

Full design notes under [`docs/feature-*`](./docs/). Status: **`[x]`** stable · **`[~]`** MVP/Beta · **`[ ]`** spec/planned.

"Stable" means the path works and has been exercised; it does not imply hardening for unattended production use. See [`feature-readiness.md`](./docs/agents/feature-readiness.md) for per-area caveats.

### Recent additions

- **Research-first ParallelLab workbench.** Frame the research question, inspect
  portfolio readiness, monitor runs, compare analysis, and trace conclusions
  back to run evidence from one experiment workspace.
- **Reviewable AI experiment protocols.** Protocol generation has its own
  feature switch, prompt template, and model selection. A protocol can be
  generated before scan variables are complete, then reviewed and edited before
  it becomes part of an experiment.
- **Correct run settlement.** Worker callbacks start with fresh database
  sessions, scheduler failures propagate into run outcomes, failed runs never
  enter best-result selection, and an experiment with no successful run settles
  as failed rather than reporting success.
- **Service Center for operators.** Administrators get one logical-service
  inventory with health, readiness, dependencies, and image availability.
  Allowlisted start/stop/restart actions are disabled by default and require the
  explicit, security-sensitive Docker control overlay.

### Platform foundation

| Status | Feature | One-liner | Design notes |
|---|---|---|---|
| [x] | Action Space — bounded agent environment | Roles, rules, variables, supervisors, and MCP tools are scoped to one space rather than a flat global list. | [`feature-action-space/`](./docs/feature-action-space/) |
| [x] | Role ↔ Agent: template / instance split | One Role template can run as N independent agents across N spaces, each with its own state, memory, and tool access. | [`feature-role-management/`](./docs/feature-role-management/) |
| [x] | Variable system — template / instance / cross-space | Prompt variables plus a state channel between action spaces. | [`feature-variables/`](./docs/feature-variables/) |
| [x] | Multi-tenancy + RBAC + workspaces | `created_by` / `is_shared` on every resource. | [`feature-multi-tenancy/`](./docs/feature-multi-tenancy/) |
| [x] | UUID-native resource IDs | All core resources use UUIDs, which simplifies cross-instance migration. | [`feature-uuid/`](./docs/feature-uuid/) |

### Creation experience

| Status | Feature | One-liner | Design notes |
|---|---|---|---|
| [ ] | Magic Journal — "narrate freely → AI builds your world" | A four-pane workbench (notes list / notebook / AI comment stream / action panel). You write down what you want like a journal entry; AI parses it paragraph-by-paragraph into concrete `ActionSpace` / `Role` / `Rule` / `Variable` / `Plan` scaffolds. Low-risk actions auto-execute; high-risk ones queue for one-click confirmation. SSE-streamed, `@`-mention existing entities. | — |

### Multi-agent interaction

| Status | Feature | One-liner | Design notes |
|---|---|---|---|
| [ ] | Advanced interaction modes modeled on human social organization | More deliberative, more institutional multi-agent dynamics; design ongoing. | — |
| [x] | Supervisor + dual-engine rule sandbox | Natural-language rules + programmatic logic rules; supervisor intervenes in real time. | [`feature-supervisor-workflow/`](./docs/feature-supervisor-workflow/) · `supervisor_*.py` · `rule_sandbox.py` |
| [x] | Observer with multi-tier intervention | `round_based` triggering × `passive`/active intervention modes; decides *when* and *how strongly* the supervisor steps in. | `ObserverManagement.tsx` |
| [x] | Smart Dispatch — automatic agent routing | Routes an incoming user message to a suitable agent without an explicit `@`-mention. Uses LRU caches on the lookup path. | `smart_dispatch_service.py` · `core/model_cache.py` |
| [~] | Cross-space orchestration (`cross_space`) | SubAgents must explicitly declare crossing space boundaries; the supervisor blocks undeclared crossings. | [`feature-subagent/`](./docs/feature-subagent/) · [`feature-workflow-graph/`](./docs/feature-workflow-graph/) |
| [x] | Resource-relation visualizer | See the live web of `ActionSpace ↔ Role ↔ Agent ↔ Rule ↔ Variable` in the UI. | [`feature-ui-resource-graph/`](./docs/feature-ui-resource-graph/) |
| [ ] | Heartbeat — ABM-tick-driven "living" agents | Every Agent has its own beat; even with no one chatting, it runs `observe → reflect/plan → act`. ActionSpace closes ⇒ heartbeat stops. Inspired by Mesa `step()` / NetLogo `tick` / Stanford Generative Agents. | [`feature-heartbeat/`](./docs/feature-heartbeat/) |
| [ ] | Background brain — adaptive cadence, continuous learning, platform brain | Extends Heartbeat along three axes: beat rate as a function of system pressure × per-agent priority (foreground requests are never starved by background thinking); a learning closure where reflections become skills / rules / preferences only after passing an evaluation gate, with shadow-first rollout, rollback, and decay; and a system-scope platform brain that reads telemetry and writes reviewable insights, never applying changes itself. | [`PLAN-background-brain.md`](./docs/feature-heartbeat/PLAN-background-brain.md) |
| [ ] | True parallel multi-agent execution | Independent SSE streams + isolated queues per agent; ends shared-stream interleaving. | `TODO.md#7` |

### SubAgent / Agent-as-Tool

| Status | Feature | One-liner | Design notes |
|---|---|---|---|
| [~] | SubAgent nesting via MCP | `invoke_agent` / `invoke_agents` / `list_available_agents` exposed as MCP tools; Phase 1 MVP shipped. | [`feature-subagent/`](./docs/feature-subagent/) |
| [x] | SubAgent sandbox | executor / context_builder / security as three separate layers. | [`feature-subagent/`](./docs/feature-subagent/) |
| [~] | ODM — structured agent protocols | IDL-style contracts on SubAgent inputs / outputs. | [`feature-odm/`](./docs/feature-odm/) |

### MCP ecosystem

| Status | Feature | One-liner | Design notes |
|---|---|---|---|
| [x] | MCP Server Manager | Server-side lifecycle management: register, start, stop, health-check, isolate. The platform runs MCP servers, not only calls them as a client. | `mcp_server_manager.py` (73 KB) |
| [x] | MCP server isolation | MCP instances in different spaces don't bleed into each other. | [`feature-mcp-server-isolation/`](./docs/feature-mcp-server-isolation/) |
| [~] | MCP → API gateway (`mcp2apimcp`) | Expose any MCP server as a standard HTTP API so legacy systems can call it. | [`feature-mcp2apimcp/`](./docs/feature-mcp2apimcp/) |

### Orchestration & autonomy

| Status | Feature | One-liner | Design notes |
|---|---|---|---|
| [ ] | Workflow Graph — visual DAG editor | ReactFlow-based; node types: agent / condition / parallel / loop. | [`feature-workflow-graph/`](./docs/feature-workflow-graph/) |
| [x] | Planner — structured plan items | `create_plan` / `update_plan_item` / `get_plan` as MCP tools + frontend `PlannerPanel` + live SSE updates. | [`feature-planner/`](./docs/feature-planner/) |
| [x] | Autonomous Task — three trigger modes | Time-triggered, variable-triggered, self-driven scheduling. | [`feature-autonomous/`](./docs/feature-autonomous/) |
| [~] | Parallel Experiment Lab | Research workbench for parameter sweeps across LLM-agent populations, with reviewable AI behavior protocols, run monitoring, analysis, evidence views, and explicit failed-run accounting. | [`current plan`](./docs/feature-parallellab/PLAN-parallellab.md) · [`v2 research design (draft)`](./docs/feature-parallellab/PLAN-cognitive-simulation-v2.md) |
| [~] | Job queue / task manager | Redis + thread pool + handler-registry pattern. | [`feature-job-queue/`](./docs/feature-job-queue/) |

### Memory & knowledge

| Status | Feature | One-liner | Design notes |
|---|---|---|---|
| [ ] | MemoryPalace v0.51 — temporal-KG memory | `(subject, predicate, object, valid_from, valid_to)` triples; built-in `kg_verify` + offline `fact_check()`; 5-layer `Realm → Wing → Hall → Room → Drawer`. Drops external Graphiti dependency, fully local, fully async. | [`feature-mempalace-v0.51/`](./docs/feature-mempalace-v0.51/) |
| [~] | Memory partitions (global / agent / conversation) | Strict isolation with cross-partition policies. | [`PLAN-memory-partition.md`](./docs/feature-memory/PLAN-memory-partition.md) |
| [~] | Graphiti-style community detection | Auto-discover communities within memory graphs. | [`PLAN-COMMUNITIES-GRAPH.md`](./docs/feature-memory/PLAN-COMMUNITIES-GRAPH.md) |
| [~] | LightRAG + Milvus + BM25 hybrid retrieval | Knowledge graph × vector × full-text, three lanes in parallel. | [`lightrag-PLAN.md`](./docs/feature-knowledge-base/lightrag-PLAN.md) · [`feature-vector-db/`](./docs/feature-vector-db/) |
| [x] | Document parser pipeline | PDF / Word / Excel pre-processing before ingestion. | [`feature-document-parser/`](./docs/feature-document-parser/) |
| [x] | Context window management | Summary service strips `tool_call` arguments before the next round and auto-summarizes long sessions, which keeps context growth bounded. | [`feature-auto-summarize/`](./docs/feature-auto-summarize/) |

### Entity apps & integrations

| Status | Feature | One-liner | Design notes |
|---|---|---|---|
| [~] | Entity App Market (Applization) | NetLogo / GIS / RPA / RPG / VSCode etc. mount into an action space as first-class apps. | [`feature-applization/`](./docs/feature-applization/) · [`feature-market/`](./docs/feature-market/) |
| [x] | NetLogo bridge | Bidirectional ABM-physics × LLM-cognition; via `third_party/Galapagos`. | — |
| [ ] | Mesa Python integration | Alongside NetLogo. | `TODO.md` Phase 4 |
| [x] | OpenAI-compatible API + Python SDK | Action spaces, agents, knowledge bases all callable externally; API key mgmt + rate limit + OpenAPI docs. | [`feature-openai-export/`](./docs/feature-openai-export/) |
| [x] | External role import — Coze & FastGPT | Pull agents from third-party platforms with one line of config. | [`PLAN-role-coze.md`](./docs/feature-role-management/PLAN-role-coze.md) · [`PLAN-role-fastgpt.md`](./docs/feature-role-management/PLAN-role-fastgpt.md) |
| [x] | Multimodal image input | Paste or upload images into task conversations, with attachment preview, removal, and normalized message payload handling. | [`feature-image-input/`](./docs/feature-image-input/) |

### Engineering practices

| Status | Feature | One-liner | Design notes |
|---|---|---|---|
| [~] | Async backend | FastAPI + SQLAlchemy 2.0 + httpx. "No blocking I/O on request paths" is an enforced convention for new code, not a finished state: a source scan still finds ~56 `requests.*` / `time.sleep()` call sites under `backend-fastapi/app` awaiting audit. | [`AGENTS.md`](./AGENTS.md) · [`feature-readiness.md`](./docs/agents/feature-readiness.md) |
| [x] | SSE streaming with cancel & keep-alive | Long sessions kept alive; mid-stream cancel supported. | [`feature-stream-cancel/`](./docs/feature-stream-cancel/) · [`feature-keep-alive-conversation/`](./docs/feature-keep-alive-conversation/) |
| [x] | Three-bag `ModelConfig` | Strict split between `custom_headers` / `custom_body` / `additional_params`, merged through `app/services/llm_http`. | [`model-config-custom-params.md`](./docs/agents/model-config-custom-params.md) |
| [~] | Service Center — runtime inventory & health | Admin-only logical-service inventory and dependency-aware health/readiness checks; allowlisted lifecycle control is opt-in behind a Docker socket overlay. | [`feature-service-center/`](./docs/feature-service-center/) · [`deployment guide`](./abm-docker/README.md) |
| [x] | Enforced i18n | Per-feature namespaces; zh/en key consistency checked by `pnpm run i18n:check-keys`; hard-coded CJK in frontend source blocked by an AST scanner (`pnpm run i18n:check-cjk`). Both run locally before commit. | [`feature-multi-lang/`](./docs/feature-multi-lang/) · [`docs/agents/i18n.md`](./docs/agents/i18n.md) |
| [x] | Documented conventions and incident log | `AGENTS.md` holds repo-wide rules for human and AI contributors, each traceable to a recorded incident in `docs/agents/failures/`. The public release procedure is written down rather than tribal knowledge. | [`docs/agents/failures/`](./docs/agents/failures/) · [`release-flow.md`](./docs/agents/release-flow.md) |

---

## Core concepts

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

## Where MesaLogo sits

These comparisons describe design emphasis, not benchmark results. Each project listed is mature in its own domain, and several of the differences below are deliberate trade-offs rather than gaps.

### Relative to traditional ABM (NetLogo · Mesa · AnyLogic)

| Dimension | MesaLogo | Traditional ABM |
|---|---|---|
| Rule definition | Natural-language rules alongside programmatic ones | Code |
| Agent behavior | Driven by LLM reasoning | Driven by explicit state machines |
| Interaction focus | Dialogue between agents | Spatial and numeric state change |
| Side effects | MCP tool servers can reach external systems | Simulation-internal state |
| Maturity | Early, evolving | Decades of validation, established literature |
| Determinism | Low; LLM output varies between runs | High; reproducible given a seed |

If you need reproducible, peer-reviewable simulations of large populations with well-defined behavior rules, use an established ABM tool. MesaLogo is aimed at scenarios where the interesting behavior is linguistic.

### Relative to LLM agent frameworks (Dify · Langflow · AutoGen · CrewAI · LangGraph · OpenAI Swarm · Claude Agent SDK)

| Dimension | MesaLogo's approach |
|---|---|
| Structure | Action Space is the unit of scoping: roles, rules, variables, and supervisor belong to a space |
| Safety boundary | Supervisor and rule sandbox run inside the platform rather than being left to application code |
| Cross-boundary calls | SubAgents must declare `cross_space=True`; undeclared crossings are blocked |
| Simulation coupling | NetLogo bridge today; Mesa integration planned |
| MCP | Server-side lifecycle management and isolation, plus an MCP→API gateway |
| Experiments | Parameter sweeps across agent populations with run-level evidence |
| Deployment surface | Multi-tenancy, RBAC, and an OpenAI-compatible API included |

Those frameworks are generally lighter, better documented, and have far larger communities. Several are libraries where MesaLogo is a platform, which is a different set of trade-offs rather than a worse one. Choose MesaLogo if the bounded-world model and supervisor enforcement match your problem; choose a framework if you want a smaller dependency you compose yourself.

---

## What it can do

### Built-in interaction modes
- **Sequential** — agents speak in order; classic panel.
- **Panel** — open expert discussion, supervisor moderates.
- **Debate** — pro/con sides, structured rounds.
- **Collaborative** — agents jointly solve a problem.

### Example use cases

These are scenarios the abstractions were designed for, not case studies with published results.

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

**Design rules** ([`AGENTS.md`](./AGENTS.md)):
- Async by default; no new blocking I/O on request paths.
- SSE for streaming; no WebSocket.
- Supervisor / rule sandbox is the safety boundary.
- MCP is the tool-extensibility surface.

---

## Quick start

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

## Contributing

We welcome contributions. Before opening a PR:

1. Read [`AGENTS.md`](./AGENTS.md) — repo-wide conventions.
2. Read [`backend-fastapi/AGENTS.md`](./backend-fastapi/AGENTS.md) if your change touches backend.
3. Skim `docs/agents/failures/` to avoid known traps.
4. Open an issue first for non-trivial changes.

**No automatic squash. No automatic push.** Maintainers review every PR.

### Where help is most useful
- MemoryPalace v0.51 implementation (P1 skeleton is ready to start)
- New MCP plugins, especially domain-specific ones (GIS, finance, biology)
- Internationalization (English / Japanese)
- Documentation translation
- Bug reports with reproducible cases
- Integration and E2E tests, currently the thinnest layer of the test pyramid

---

## License

MIT — see [`LICENSE`](./LICENSE).

You may use, modify, and distribute this software freely, including for commercial purposes. We ask that you keep the copyright notice in any substantial portion you redistribute.

---

## Acknowledgments

This project builds on:

- **[Mesa](https://github.com/projectmesa/mesa)** — the Python ABM framework that informs the agent model.
- **[NetLogo](https://ccl.northwestern.edu/netlogo/)** — agent simulation conventions, and the bridge target via `third_party/Galapagos`.
- **[mempalace](https://github.com/mempalace/mempalace)** — design reference for the memory system.
- **[FastAPI](https://github.com/tiangolo/fastapi)**, **[React](https://github.com/facebook/react)**, **[Ant Design](https://github.com/ant-design/ant-design)** — the web stack.
- **[Milvus](https://github.com/milvus-io/milvus)**, **[LightRAG](https://github.com/HKUDS/LightRAG)** — vector and RAG infrastructure.
- **[Model Context Protocol](https://github.com/modelcontextprotocol)** — the plugin standard.
- Early contributors and adopters who worked through the rough edges.

---

<div align="center">

[Docs](./docs/) · [Roadmap](./TODO.md) · [中文 README](./README.zh.md)

</div>
