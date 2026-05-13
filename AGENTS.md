# AGENTS.md — abm-llm-v2 engineering entrypoint

> This is the **first file an AI coding agent (Claude / Codex / Droid / Cursor / …) reads when entering this repo**.
> It is not a human README — it is the agent's onboarding manual.
>
> Principles (Harness Engineering style, after Mitchell Hashimoto / OpenAI):
> 1. **Stay small and stable.** Long instructions crowd out the task; stale rules are worse than no rules.
> 2. **Every rule maps to a real past incident.** See `docs/agents/failures/`.
> 3. **Retrieve on demand, never one-shot.** For domain-specific changes, read the matching `docs/agents/*.md` first.
> 4. **On failure, re-read this file and the relevant failure note before retrying.**
>
> Language policy (语言策略): documentation is **English-first, Chinese as glossary**.
> Key terms get bilingual annotation on first use: `English (中文术语)`. Code identifiers and log messages are always English.

---

## 1. What this project is (one sentence)

**abm-llm-v2** is a multi-agent LLM simulation platform (Agent-Based Modeling + LLM / 多智能体仿真) with the following capabilities:
- Multi-agent collaboration / parallel execution / orchestration (Workflow Graph / 编排图)
- MCP (Model Context Protocol) tool ecosystem + nested SubAgent invocation (子智能体嵌套调用)
- Knowledge bases (LightRAG / Milvus / BM25) + memory partitions (记忆分区)
- Bidirectional communication with ABM frameworks (NetLogo / Mesa)

> You are not writing a chatbot. You are modifying **a system that runs simulation experiments, lets agents call each other, and produces observable side effects**. Any action may affect a running experiment, task, or agent. **Default to conservative.**

### 1.1 Branch model (mandatory read / 必读)

This repo has two external remotes with **fundamentally different meaning**. Always verify which branch you're on before pushing.

| Local branch | Remote | Visibility | Purpose |
|---|---|---|---|
| `public` | `mesalogo` → `git@github.com:mesalogo/mesalogo.git` (remote name `main`) | ⭐ **Public open source** | The MesaLogo open-source release branch on GitHub |
| Others (e.g. `0.14`, `250504-agentcolor`) | `origin` → internal git server (see `git remote -v`) | 🔒 Internal / private | Development / experimental / customer-specific |

**Red lines:**
- `public` = **github.com/mesalogo/mesalogo** — anything pushed to `public` becomes public.
- ❌ **Never merge internal code, secrets, deployment configs, or customer-specific code into `public`.**
- ❌ **Never `git push` without first verifying the branch.** Run `git status -b` to confirm your current branch and upstream.
- Before committing to `public`, let the user review `git diff` and `git status` (see §7 "no auto-push").

---

## 2. Repo topology (the 90% you'll touch)

```
abm-llm-v2/
├── backend-fastapi/          ← ⭐ Main backend (FastAPI + SQLAlchemy + Redis)
│   ├── main.py               Entry point
│   ├── app/services/         ⭐ Business core. Read backend-fastapi/AGENTS.md first.
│   │   ├── subagent/         SubAgent execution engine (shipped)
│   │   ├── scheduler/        Autonomous-task scheduler (shipped)
│   │   ├── conversation/     Conversation service (对话服务)
│   │   ├── supervisor_*.py   Supervisor / rule sandbox = Harness constraint layer. Touch with care.
│   │   ├── mcp_server_manager.py   MCP tool registry (~73k LOC, fragile)
│   │   └── parallel_experiment_service.py  Parallel-experiment runner (~75k LOC, fragile)
│   ├── app/models.py         ⚠️ ~90k LOC. Read migration-progress.md before adding fields.
│   └── tests/                ⭐ The real test directory. Read tests/AGENTS.md before writing tests.
│       ├── unit/             ms-scale, pure functions
│       ├── integration/      s-scale, with DB / Redis
│       ├── e2e/              minute-scale, full pipeline
│       ├── contract/         OpenAPI / MCP signature non-regression
│       ├── fixtures/         shared mocks + factories
│       └── _archive/         old Flask leftovers, read-only
│
├── frontend/                 React 19 + Ant Design 6 + @xyflow/react
│   └── src/                  Read frontend/AGENTS.md (if present) before changing.
│
├── abm-docker/               docker-compose multi-service stack (redis/milvus/neo4j/…)
├── tests/                    ❌ Root tests/ is historical scratchpad, fully gitignored
│                              (only tests/AGENTS.md is exempt and tracked).
│                              New tests go to backend-fastapi/tests/.
├── third_party/              ❌ Submodules. Do not modify.
├── docs/                     Design docs (read on demand)
│   ├── feature-*/PLAN.md     Per-feature plans
│   └── agents/               ⭐ Agent-facing workbooks (retrieve on demand)
│       ├── mcp-tool-writing.md
│       ├── subagent-patterns.md
│       ├── parallel-execution.md
│       ├── database-changes.md
│       └── failures/         Past incidents — skim titles before code changes
└── TODO.md                   Live product roadmap (read the relevant entry before working on it)
```

> Note: `backend-deprecated/` has been removed (see `docs/agents/failures/2026-05-13-public-branch-secret-leak.md`). Old Flask code is retained only in local untracked directories for historical reference.

---

## 3. Hard constraints (violation = stop and ask the user)

These are **red lines (红线)**, not suggestions. Self-check before any action.

### 3.1 Directory red lines

- ❌ **Do not modify `backend-deprecated/`** — deprecated Flask code, retained for history only.
- ❌ **Do not modify anything under `third_party/`** — git submodules.
- ❌ **Do not commit files under `backend-fastapi/knowledgebase/`, `logs/`, `.pnpm-store/`.**
- ❌ **Do not modify `.factory/artifacts/`** (tooling system directory).
- ❌ **Do not push internal material to the `public` branch / `mesalogo` remote** (= the GitHub open-source release, see §1.1). Anything with internal IP, secrets, private deployment, or customer-specific code stays on `origin` internal branches.
- ❌ **Always run a secret-scan before pushing to `public` / `mesalogo`.** Minimum bar: `git diff origin/main...HEAD | grep -iE "(api[_-]?key|secret|token|password|client_secret|sk-[a-z0-9])"`. Install `gitleaks` as a pre-push hook if possible. **This has already gone wrong once** — see `docs/agents/failures/2026-05-13-public-branch-secret-leak.md`.

### 3.2 Code red lines

- ❌ **No `print()`**. Always use `logger` (see "Completed > print → logger migration" in TODO.md).
- ❌ **No blocking I/O on async paths** (`requests.get`, `time.sleep`, large synchronous file reads/writes). The project is moving toward 5000-concurrency (5000 并发); one blocking call drags down the whole event loop. Use `httpx.AsyncClient` / `asyncio.to_thread`.
- ❌ **Do not migrate schema by editing `models.py` table fields directly.** Write an Alembic migration in `backend-fastapi/migrations/`.
- ❌ **Do not change the permission semantics of `supervisor_*.py` / `rule_sandbox.py`** (the Harness constraint layer / Harness 约束层). One wrong rule lets an experiment perform an illegal action. If you must touch this, read `docs/agents/supervisor-rules.md` first (create the file with background notes if it doesn't exist yet).

### 3.3 Agent-behavior red lines (about you)

- ❌ **No one-shot mode.** When tempted to "just fix this other thing on the way", stop, write it into TODO or a failure note.
- ❌ **No premature victory declarations.** Unit tests passing ≠ feature done; `curl` returning 200 ≠ the frontend works. See `docs/agents/failures/2025-*-premature-victory.md` if present.
- ❌ **Do not assume "tests pass means safe".** You wrote the tests. If the tests are wrong, they will of course pass. When fixing a bug, **first write a test that reproduces the bug and watch it fail (确认它失败)**, then fix.
- ❌ **Do not copy patterns from `backend-deprecated/`.** That code is Flask/sync; this project is FastAPI/async.

---

## 4. Upstream retrieval before you start (上游检索)

Before writing or changing code, read the matching doc as needed (all under `docs/agents/`):

| What you're doing | Required reading |
|---|---|
| Adding an MCP tool | `docs/agents/mcp-tool-writing.md` |
| Modifying SubAgent / `invoke_agent*` | `docs/agents/subagent-patterns.md` + `docs/feature-subagent/PLAN.md` |
| Parallel tasks / `asyncio.gather` | `docs/agents/parallel-execution.md` + `TODO.md#真正的并行智能体执行` |
| Adding columns / schema changes | `docs/agents/database-changes.md` + `backend-fastapi/migration-progress.md` |
| Supervisor / rule sandbox | `docs/agents/supervisor-rules.md` |
| LightRAG / vector store | `docs/feature-knowledge-base/lightrag-PLAN.md` |
| Workflow Graph orchestration | `docs/feature-workflow-graph/PLAN.md` |
| Heartbeat / self-driven agents | `docs/feature-heartbeat/PLAN.md` + `policies.md` + `stop-the-world.md` |
| **Writing or modifying any test** | `backend-fastapi/tests/AGENTS.md` (30-second decision tree) |
| Deployment / Docker / performance | `abm-docker/README.md` + `docs/feature-parallellab/PLAN-5000-concurrency.md` |

If no matching doc exists → **create one** (even just a "placeholder" line), then write your decision into it. This is the Harness "living docs" principle.

---

## 5. Known failure modes (one-minute recap)

These have **really happened in TODO.md**. Do not repeat them.

1. **Autonomous task can't stop** (see `TODO.md#BUG`): the stop signal must clear the Redis queue **and** `scheduler.triggers` **and** the SSE stream. Killing only one of them leaves a zombie.
2. **Error 400 cannot be aborted** (same place): HTTP errors must **propagate back into the SSE `done` event**, otherwise the frontend spinner hangs forever. Log-but-don't-emit = stuck UI.
3. **Interleaved parallel agent output**: the current `asyncio.gather` shares one SSE stream, so multi-agent output gets jumbled. For any new feature that needs true parallelism, use isolated queues (see TODO #7).
4. **Context explosion**: the summary service must strip `tool_call` args before the next round (see "Completed > summarized-context optimization" in TODO.md). Do not reintroduce raw `tool_call` payloads in new features.
5. **Undeclared cross-action-space invocation**: SubAgent calls across action spaces must explicitly set `cross_space=True`, otherwise the supervisor blocks them. The error often *looks* like "tool unavailable" but the real cause is here.
6. **First `public`-branch push leaked secrets** (`docs/agents/failures/2026-05-13-public-branch-secret-leak.md`): pushing without secret-scan via `git push mesalogo public:main` published real OAuth secrets from `backend-deprecated/config.conf`, MySQL credentials, and `PLAY_HTTP_SECRET_KEY` from `docker-compose.galapagos.yml`. Rotating the leaked credentials afterwards is the only real remediation.

Every new incident → write `docs/agents/failures/YYYY-MM-short-description.md`, then add one line back to the list above.

---

## 6. Run & verify (minimum viable)

```bash
# Backend (development)
cd backend-fastapi
uvicorn main:app --host 0.0.0.0 --port 8080 --reload

# Backend (production)
./backend-fastapi/start_prod.sh   # gunicorn + uvicorn workers

# Frontend
cd frontend && pnpm dev

# Full Docker stack
cd abm-docker && make up
```

**Done means** (do not declare victory otherwise):

1. `python3 -c "import main"` succeeds (no syntax/import errors).
2. The relevant route `curl http://localhost:8080/<endpoint>` returns the expected JSON (not just an empty 200).
3. The frontend page actually opens and you see data flow (not just "the page doesn't crash").
4. Relevant existing tests pass: `pytest backend-fastapi/tests/...`. If you changed business logic without tests, **first write a test that reproduces the original problem.**
5. Changed `models.py` → generate an Alembic migration and run `upgrade`/`downgrade` locally.

---

## 7. Output style conventions

- **Language**: documentation, code comments, and commit messages are **English-first, Chinese as glossary** (`English (中文术语)` on first mention of a key concept). Code identifiers and log messages are always English.
- **Commit format**: follow the recent `git log --oneline -5` style (e.g. `fix: add GET /agents/{id}/memories endpoint to resolve frontend 404`).
- **No ads in commits**: do not add `Co-authored-by: Claude/Codex/…`; do not add `Generated with …`.
- **No automatic push.** Always let the user review `git diff` and `git status` before pushing.

---

## 8. When AGENTS.md itself needs updating

If you hit a failure mode **not covered by this file**, that's exactly the "environment hole" Harness engineering wants to surface. Process:

1. Write a post-mortem under `docs/agents/failures/`.
2. Pull the one or two most critical lines back into §3 or §5 of this file (keep this file small).
3. Tell the user: "The root cause of this incident should be captured in AGENTS.md — I've added it, please review."

---

_last human review: 2026-05-13_
_inspiration: Harness Engineering (Mitchell Hashimoto, 2026-02) + OpenAI 1M-line report_
