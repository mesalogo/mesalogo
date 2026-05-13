# tests/_archive/AGENTS.md

> ❌ **Do nothing in this directory.** Read-only.

## What this is

Test code left over from the Flask era (copied from the now-removed `backend-deprecated/`).
**It cannot run** under the current FastAPI/async codebase:

- Uses `from app import create_app` / `app.test_client()` / `with app.app_context()` (Flask API).
- No `async def`; assumes the whole stack is sync.
- Directly imports modules that no longer exist, e.g. `app.services.subscription_service`.

## Why we keep it

1. **Historical lookup** — how was a given API tested back then? What parameters did it take?
2. **Refactor reference** — sometimes the business logic still exists; move it under `tests/<layer>/` and rewrite.
3. **Forensics** — visible trace of "test suite was abandoned here → rebuilt".

## Red lines (红线)

- ❌ Do not add any new files here.
- ❌ Do not modify the code here.
- ❌ Do not say "I copied from `_archive`" in a PR description — that counts as a rewrite.
- ❌ Do not let pytest collect this directory (`pytest.ini` already excludes via `norecursedirs` + `--ignore`).

## What you want to do → where to go

| Intent | Go to |
|---|---|
| Write a new test | `backend-fastapi/tests/<unit\|integration\|e2e\|contract>/` |
| Find a reference | `grep` here, read-only |
| Wipe this directory | Do not initiate. Requires explicit user confirmation. |

See `backend-fastapi/tests/AGENTS.md`.

---

_archived: 2026-05-13_
