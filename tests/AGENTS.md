# /tests/AGENTS.md — this is **NOT** the real test directory

> If you are an AI agent entering this directory, **stop first**.

## What this is

A historical scratchpad (历史 scratchpad). ~100+ debug scripts, one-off verifications, curl replays.
**The entire directory is gitignored** at the repo root (`tests/*` rule), with **this AGENTS.md** as the only exception (`!tests/AGENTS.md`). Every other `*.py` / `*.sh` / `*.json` / `*.html` / `*.md` here is **untracked**.

These files are local archaeological artifacts. They will **not** enter git, **not** enter CI, and **must not** be referenced by current code. Most are Flask-era code and offer **no useful pattern** for the current FastAPI/async codebase — they will only mislead you.

## What you probably want to do

| Intent | Go to |
|---|---|
| Write or change a test | `backend-fastapi/tests/` (read the `AGENTS.md` there) |
| Find a historical reference for some API call | `grep` here, read-only — **do not copy** |
| Add a debug script | Use your own local workspace; do not pollute this dir |
| Clean this directory up | **Do not initiate.** Repo-root AGENTS.md §3.3 red line: do not delete untracked files. |

## Red lines (红线)

1. ❌ **Do not add new tests here.** New tests go to `backend-fastapi/tests/<layer>/`.
2. ❌ **Do not template-copy from here into `backend-fastapi/tests/`.** Flask code simply cannot run under FastAPI/async.
3. ❌ **Do not `git add -f`** anything in here. The `tests/*` gitignore rule is intentional.
4. ❌ **Do not modify anything except this file**, unless the user explicitly asks to clean this directory.

## Historical context

This directory accumulated between 2025-05 and 2025-09, before the project migrated from Flask to FastAPI. There was no formal test suite at the time, so all debug scripts piled up here. After the migration (2025-10+) the real test directory moved to `backend-fastapi/tests/`, and this one was frozen.

See repo-root `/AGENTS.md` §2 (repo topology) and `backend-fastapi/tests/AGENTS.md`.

---

_last review: 2026-05-13_
