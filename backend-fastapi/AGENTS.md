# backend-fastapi / AGENTS.md

> Read this file before any change under `backend-fastapi/`.
> Assumes you have read the repo-root `/AGENTS.md`. This file only covers **backend-only** rules.
> Language policy: English-first, Chinese as glossary (`English (中文术语)` on first use).

---

## 1. Stack mental model (技术栈心智模型)

- **Web**: FastAPI 0.115+ (**not Flask**; do not carry over patterns from `backend-deprecated/`)
- **ASGI**: uvicorn (dev) / gunicorn + uvicorn workers (prod, see `gunicorn.conf.py`)
- **ORM**: SQLAlchemy 2.0 style (async session) + Alembic migrations (迁移)
- **DB**: MariaDB (primary) + Redis (cache / queue) + Milvus (vector / 向量) + optional TiDB vector
- **Agent / LLM**: `httpx.AsyncClient` + MCP (Model Context Protocol, official `mcp` SDK)
- **Concurrency model**: async/await end-to-end. **Any blocking I/O is a bug.**
- **asyncio compatibility**: the project installs `nest-asyncio`, which means there's a history of nested-loop problems. Do not assume `asyncio.run()` works anywhere.

---

## 2. `app/services/` layout (区域划分)

| Path | Meaning | Touch risk |
|---|---|---|
| `conversation/`, `conversation_service.py` | Conversation core, SSE stream generation | 🟥 high — one wrong line can hang the frontend |
| `subagent/` | SubAgent execution engine (Phase 1 MVP shipped) | 🟧 medium — read `docs/feature-subagent/PLAN.md` first |
| `scheduler/` | Autonomous-task scheduling + triggers | 🟧 medium — has the "task won't stop" historical bug |
| `parallel_experiment_service.py` | Parallel experiment orchestration (~75k LOC) | 🟥 high — minimal fixes only, no refactor |
| `mcp_server_manager.py` | MCP tool registry (~73k LOC) | 🟥 high — tool contract changes affect every agent |
| `supervisor_*.py`, `rule_sandbox.py` | Harness constraint layer (supervisor + rule + sandbox / 监督者 + 规则 + 沙箱) | 🟥 high — one wrong permission = systemic risk |
| `memory_*`, `vector_db*`, `lightrag/` | Memory / vector / RAG | 🟧 medium |
| `statistics_service.py` (~44k LOC) | Statistics | 🟨 low |
| `license_service.py`, `oauth_service.py` | Billing / auth | 🟥 high — do not change without explicit user approval |

**General rule**: files larger than 10k LOC are core and fragile. Before changing one, `grep` for its callers and assess the blast radius.

---

## 3. Most common failure modes (by frequency)

### 3.1 Sync I/O inside an async function

```python
# ❌ broken
import requests
async def foo():
    r = requests.get(url)   # blocks the entire event loop; kills 5000-concurrency

# ✅ correct
import httpx
async def foo():
    async with httpx.AsyncClient() as c:
        r = await c.get(url)

# ✅ if you must call a sync library (e.g. some LLM SDKs)
result = await asyncio.to_thread(sync_fn, arg)
```

### 3.2 SSE stream raises but never emits `done`

The frontend is waiting for `event: done`. After `raise HTTPException` the SSE response is already consumed by FastAPI — the frontend spinner spins forever.

```python
# ✅ correct pattern
async def stream():
    try:
        async for chunk in agent_loop():
            yield sse_event("message", chunk)
    except Exception as e:
        logger.exception("agent loop failed")
        yield sse_event("error", {"message": str(e)})
    finally:
        yield sse_event("done", {})   # ← mandatory
```

### 3.3 Added a column but forgot the Alembic migration

`app/models.py` is ~90k LOC. Editing class attributes directly causes a schema mismatch on production startup.

```bash
cd backend-fastapi
alembic revision --autogenerate -m "add foo column to bar"
# Manually review the generated .py — verify upgrade/downgrade are symmetric.
alembic upgrade head    # Run locally first.
```

### 3.4 New MCP tool not registered → agent can't see it

An MCP tool requires **all** of:

1. Implementation in `app/mcp_servers/<your_server>.py`
2. Declaration in `mcp_config.json`
3. Registration in `MCPServerManager`
4. Prompt-injection description of usage

Miss any step and the agent either can't see the tool, or sees it but 500s when calling. See `docs/agents/mcp-tool-writing.md` (create the file if missing).

### 3.5 Redis cache not invalidated

The project integrates Redis (see commit `83fffd8e feat: Redis 缓存集成`). When you mutate underlying data, delete the corresponding cache key — otherwise the frontend shows stale data **without** any error.

### 3.6 SubAgent infinite recursion / context explosion

Phase 1 MVP does not enforce ODM (Open Domain Model / 开放领域约束). Calling `invoke_agent` inside a SubAgent **may infinite-loop**. Current mitigation:

- `invoke_agent` checks depth ≤ 2 in `subagent/security.py`.
- When adding any tool callable by a SubAgent, ask: can this tool transitively trigger another SubAgent?

### 3.7 Import path confusion (backend vs backend-deprecated vs backend-fastapi)

**Only import from `app.*` and `core.*`.** If you see `from backend.xxx import ...`, that **is** deprecated code — do not copy it.

---

## 4. Checklist for adding a new route (新路由)

1. Route function in `app/api/routes/<module>.py`.
2. Mount the router in `app/api/__init__.py` or `main.py`.
3. Consider the auth/license middleware allowlist (`LicenseMiddleware` / auth).
4. Provide a pydantic response model (the frontend reads from OpenAPI).
5. Large or real-time responses use SSE (`StreamingResponse`) — **not** WebSocket (the project is SSE end-to-end).
6. Verify with `curl -i` before writing the frontend.
7. Add a minimum test in `tests/` that actually hits the route.

---

## 5. Performance / 5000-concurrency notes

`docs/feature-parallellab/PLAN-5000-concurrency.md` is the target state. For any recent PR, self-check:

- Any new sync I/O introduced? (see 3.1)
- Any `await` in a loop one-by-one (N+1)? It should be `asyncio.gather`.
- Any heavy compute in the request cycle? Move it to `job_queue/`.
- Any N+1 DB queries? Use `selectinload` / `joinedload`.
- Cache hit rate? Can Redis caching help?

---

## 6. Tests

Full rules: ⭐ [`tests/AGENTS.md`](./tests/AGENTS.md) (30-second decision tree, directory layout, fixture naming, red lines, minimum set for new features).

**This section** only lists the easiest mistakes:

- Location: `backend-fastapi/tests/`. **Not** the repo-root `/tests/` — that's historical scratchpad, fully gitignored.
- Layout: **mirror `app/`**. `app/services/heartbeat/clock.py` ↔ `tests/unit/services/heartbeat/test_clock.py`.
- Layers: `unit/` (ms, no I/O) / `integration/` (s, DB+Redis) / `e2e/` (min, full pipeline) / `contract/` (signatures non-regression).
- Framework: pytest + anyio (**not** `pytest-asyncio`, see `tests/AGENTS.md §6`).
- **Bug-fix flow is non-negotiable**: first write a test that **reproduces** the bug and watch it **fail**, then fix to green. Otherwise you don't know if you fixed it.
- LLM **may** be mocked — use `MockLLM` from `tests/fixtures/mocks/llm.py` via dependency injection.
- **Do not mock** supervisor / rule_sandbox / MCP tool signatures — they **are** the test subjects.
- Do not copy patterns from `tests/_archive/` — that's old Flask-era code that simply cannot run on FastAPI/async.

---

## 7. Config / secrets (配置 / 密钥)

- Dev uses `config.conf` (INI format) + `.env`.
- **Never commit `config.conf` or any key.** `.gitignore` covers this, but watch out for an agent doing `git add -f` to bypass it.
- New config entries: declare a default in `core/config.py` `settings` with a doc comment.

---

_last human review: 2026-05-13_
