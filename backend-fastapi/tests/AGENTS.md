# tests/AGENTS.md

> Read this before writing tests under `backend-fastapi/tests/`.
> Assumes you have read repo-root `/AGENTS.md` and `backend-fastapi/AGENTS.md`.
> Language policy: English-first, Chinese as glossary on first use.

## 0. 30-second decision tree (决策树)

```
What does the thing under test involve?

A pure function / one method               → tests/unit/<mirror app/services path>/test_X.py
A FastAPI route / DB behavior              → tests/integration/api|db|services/
Nested SubAgent / full SSE pipeline        → tests/e2e/scenarios/
OpenAPI / MCP tool signature drift         → tests/contract/<openapi|mcp_tools>/
Reproducing a production bug               → put in the closest layer; commit message: "repro Bug #N"
Not sure                                   → put in unit/
```

**Iron rule (铁律)**: no mega-tests that span multiple layers; one test function tests one thing.

## 1. Directory layout (mirrors `app/`)

```
tests/
├── AGENTS.md           you are reading this
├── conftest.py         root fixtures: anyio_backend / settings_override / mock_llm / redis_fake
├── pytest.ini          markers / asyncio / collection / strict
├── unit/               ms-scale, pure functions, no I/O
│   └── services/<feature>/
├── integration/        second-scale, with DB (SQLite in-memory) / fakeredis / real FastAPI
│   ├── api/ db/ mcp/ services/
├── e2e/                minute-scale, full pipeline, only LLM is mocked
│   ├── scenarios/ smoke/
├── contract/           guards against API / tool-signature regression
│   ├── openapi/ mcp_tools/
├── fixtures/           shared factories + mocks + data
│   ├── factories.py mocks/ data/
└── _archive/           historical Flask code, read-only, do not touch
```

Rule for new test files: **the test path must mirror the production code path.**
`app/services/heartbeat/clock.py` ↔ `tests/unit/services/heartbeat/test_clock.py`.

## 2. Markers (strict mode)

| Marker | Meaning |
|---|---|
| `unit` | default; ms, no I/O |
| `integration` | with DB / Redis / MCP |
| `e2e` | full pipeline, minute-scale |
| `contract` | signature / schema non-regression |
| `slow` | > 5s |
| `external` | requires real external network |
| `heartbeat` / `subagent` / `supervisor` / `memory` / `knowledge` / `workflow` | feature tags |

`pytest.ini` runs with `strict-markers` — **any undeclared marker is an error**. New markers must be registered in `pytest.ini` first.

Running tests:
```
pytest -m "unit"                       # tight loop while writing
pytest -m "not slow and not external"  # full local run
pytest -m heartbeat                    # one feature at a time
pytest --collect-only -q               # collect, don't run
```

## 3. Fixtures (naming is the contract)

- Root `conftest.py`: `anyio_backend` (asyncio), `settings_override`, `redis_fake`, `mock_llm`, `caplog_info`.
- Layer conftest auto-tags items in its subtree (`unit/conftest.py` adds `pytest.mark.unit`, etc.).
- Names:
  - Fixture name = noun (`agent`, `client`).
  - Factory function = `make_<X>` (`make_agent`).
  - Mock object = `mock_<X>` (`mock_llm`).
- Factories build **in-memory** objects; they do **not** hit the DB. Integration tests do the persistence explicitly: `db_session.add(make_agent())`.

## 4. Red lines (红线 — violation = guaranteed regression)

1. ❌ **No Flask patterns** (`create_app()`, `app.test_client()`, `with app.app_context()`). `_archive/` is full of these — **do not** copy-paste from there. The FastAPI canonical form is the `client` fixture in `tests/integration/conftest.py` (`httpx.AsyncClient` + `ASGITransport`).
2. ❌ **No sync I/O** (`requests`, `time.sleep`, large synchronous file reads). Same rule as repo-root AGENTS §3.2.
3. ❌ **Do not mock the supervisor, rule_sandbox, or MCP tool signatures.** They **are** the system under test. What you may mock: LLM calls and external APIs.
4. ❌ **No `print()`**. Use `caplog` / `caplog_info`. Production code completed the `print → logger` migration; tests must not regress that.
5. ❌ **No "sleep then assert"** (flaky). Use `asyncio.Event` + `wait_for(timeout)`.
6. ❌ **Unit tests must not depend on network / DB / Redis.** If they do, they're not unit tests — move them to `integration/`.
7. ❌ **Do not reverse the bug-fix order**: first write a failing test that reproduces the bug, **watch it fail**, then fix to green. Otherwise you don't know if you fixed it.
8. ❌ **No `@pytest.mark.skip` to "survive"**. Delete the test; explain why in the commit message.
9. ❌ **`_archive/` is read-only**. Do not add files there. Do not say "I copied from _archive" in a PR.

## 5. Mock LLM — the only standard way

```python
# tests/fixtures/mocks/llm.py is already provided
async def test_X(mock_llm, agent):
    mock_llm.reply_with("hi!")
    assert await agent.run("hello") == "hi!"
    assert mock_llm.calls[-1].messages[-1]["content"] == "hello"
```

Inject `mock_llm` via dependency injection (依赖注入). Do **not** use `unittest.mock.patch` against OpenAI SDK internals — that's brittle; the next SDK upgrade breaks it.

## 6. Async conventions

- Use `pytest-anyio` (**not** `pytest-asyncio`).
- Root `conftest.py`'s `anyio_backend` session fixture pins backend to `"asyncio"`.
- Test functions just declare `async def test_X(...)`; `anyio_mode = auto` is on.
- For concurrent scenarios use `asyncio.gather`. Do **not** use threads.

## 7. Database patterns

- **Unit tests do not hit a real DB.** Use `make_<model>()` factories to build in-memory objects.
- **Integration tests**: the `db_session` fixture wraps each test in a transaction with auto-rollback. Tests should `flush()`, **never** `commit()`.
- **Migration tests**: every new Alembic migration must come with an upgrade↔downgrade roundtrip case in `tests/integration/db/test_migrations.py`.

## 8. Minimum test set for a new feature

Example for Agent Heartbeat (`docs/feature-heartbeat/PLAN.md`):

| File | Tests | Layer |
|---|---|---|
| `unit/services/heartbeat/test_clock.py` | TickClock fires on schedule + `stop()` actually stops | unit |
| `unit/services/heartbeat/test_registry.py` | register / deregister consistency | unit |
| `unit/services/heartbeat/test_policy_<name>.py` | one per policy | unit |
| `unit/services/heartbeat/test_overlap_skip.py` | previous tick still running → outcome=`overlap_skip` | unit |
| `integration/services/test_heartbeat_lifecycle.py` | lifespan startup/shutdown | integration |
| `e2e/scenarios/test_heartbeat_space_close.py` | closing the action space stops heartbeats immediately (`stop-the-world.md` §3 — mandatory) | e2e |

## 9. When to come back here

- Before writing a new test → §0 decision tree
- Before mocking anything → §4 red lines
- Adding a fixture / helper → §3 naming
- Tempted to `@skip` → §4.8 don't

---

_last review: 2026-05-13_
