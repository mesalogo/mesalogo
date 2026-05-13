# /tests/ — Reference snippets archive (参考片段归档)

> This directory holds **historical reference snippets** — small scripts written between 2025-05 and 2025-09 to probe APIs, replicate bugs, or validate end-to-end behavior during the Flask → FastAPI migration.
>
> They are **reference material**, not the real test suite.
> - ⛔ **Do not run them as a regression suite.** Most won't run as-is — they hardcode dataset IDs, expect a particular DB state, or call services that have since changed.
> - ✅ **Do read them** when you need to remember "how did we call X back then?" — they preserve the exact request shape that was confirmed working.
> - ✅ Treat them as immutable history. If you need a real test, write it under `backend-fastapi/tests/` (see `backend-fastapi/tests/AGENTS.md`).

## Sanitization status (2026-05-13)

Every file here has been scrubbed of real secrets, internal IPs, and customer credentials:

| Category | Replaced with |
|---|---|
| RAGFlow tenant API key | `ragflow-REPLACE_ME` |
| FastGPT tenant API key | `fastgpt-REPLACE_ME` |
| Dify application key | `app-REPLACE_ME` |
| TiDB Cloud credential (real user/password/host) | `USER:PASSWORD@tidb.example.com:4000` |
| Internal lab IPs (RAGFlow / Milvus / Dify hosts) | `localhost:<original-port>` |
| Internal product domain | `app.example.com` |
| AWS docs example key | unchanged (AKIAIOSFODNN7EXAMPLE is publicly published by AWS) |

**To run a script**, you will need to set the matching environment variables (e.g. `RAGFLOW_API_KEY`, `RAGFLOW_HOST`) or hand-edit the placeholders in the file. **Do not commit real credentials.**

> See repo-root [`AGENTS.md` §3.1](../AGENTS.md) for the secret-scan red line.
> See [`docs/agents/failures/2026-05-13-public-branch-secret-leak.md`](../docs/agents/failures/2026-05-13-public-branch-secret-leak.md) for the incident that caused this scrub.

## Index (索引)

| Subdir | Topic | Files |
|---|---|---|
| [`supervisor/`](./supervisor/) | Supervisor / rule / intervention probes — supervisor API, message-processor integration, rule-checker, streaming, frontend handoff | 18 |
| [`ragflow/`](./ragflow/) | RAGFlow retrieval / dataset / adapter / direct API tests | 14 |
| [`fastgpt/`](./fastgpt/) | FastGPT adapter / score parsing / similarity / URL fix probes | 10 |
| [`dify/`](./dify/) | Dify params / rerank / user identifier / dynamic params merge | 8 |
| [`external_knowledge/`](./external_knowledge/) | External-KB phase 1 / 2 / standalone, table creation, document management | 7 |
| [`vector/`](./vector/) | Milvus connection / embedding-direct / universal vector DB / vector functionality | 6 |
| [`variable/`](./variable/) | Shared environment variables, external variables table, variable-stop-planning | 8 |
| [`planning/`](./planning/) | Planning-agent display / default-enabled / feature smoke | 5 |
| [`frontend/`](./frontend/) | Frontend integration HTML/JS/PY snippets (mostly archived UI verifications) | 5 |
| [`message/`](./message/) | Message model migration before/after, source field, model stream | 5 |
| [`target_agent/`](./target_agent/) | target_agent_ids API probes | 3 |
| [`autonomous/`](./autonomous/) | Autonomous-task scheduling / interrupt / round auto-check | 3 |
| [`api_fix/`](./api_fix/) | Misc API fix verifications (default model, SSE callback, simple API) | 8 |
| [`misc/`](./misc/) | Single-purpose probes that don't fit elsewhere (agent role binding, graph enhancement, observer scope, UI) | 8 |
| [`reports/`](./reports/) | JSON dumps of past API responses and migration reports (data, not code) | 5 |

## Red lines (红线 — what NOT to do)

1. ❌ **Do not write new tests here.** New tests go to `backend-fastapi/tests/<unit\|integration\|e2e\|contract>/`. This dir is closed for new code.
2. ❌ **Do not copy-paste a snippet into `backend-fastapi/tests/`.** All snippets are Flask-era / sync-style; they cannot run under FastAPI/async. Rewrite from scratch following the new test conventions.
3. ❌ **Do not put real secrets back in.** All hardcoded keys/IPs/passwords were replaced with placeholders. If a future change reintroduces a real value, the public-branch secret scan will fail and we'll have another postmortem.
4. ❌ **Do not delete files without explicit user approval.** Repo-root `AGENTS.md` §3.3 forbids cleanup operations on archived material.

## How to use a snippet (使用方法)

```bash
# 1. Identify the snippet you want.
ls tests/ragflow/

# 2. Open it; check the placeholder values it expects.
cat tests/ragflow/test_fixed_ragflow.py

# 3. Either: (a) export real values to your local shell, then run with python directly, OR
#    (b) edit the file in place to inject your values (do NOT commit the edit).
RAGFLOW_HOST=192.0.2.50:7080 RAGFLOW_API_KEY=ragflow-... python tests/ragflow/test_fixed_ragflow.py
```

## Historical context

Between 2025-05 and 2025-09 the project ran on Flask without a formal test suite, so engineers piled debug scripts into this folder. After the FastAPI/async migration (2025-10+) the real test directory moved to `backend-fastapi/tests/`. In 2026-05 these snippets were rescued, secret-scrubbed, classified by topic, and committed as immutable reference material rather than thrown away.

The first push of the `public` branch to GitHub leaked real OAuth secrets / MySQL credentials / RAGFlow / FastGPT / Dify / TiDB Cloud credentials sourced from this folder and `backend-deprecated/`. **Do not let it happen again.**

---

_last review: 2026-05-13_
