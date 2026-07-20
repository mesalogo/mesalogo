# Feature readiness snapshot (功能完善度快照)

> Evidence-based snapshot for 2026-07-20. Update this file when the README
> feature catalog, automated test layers, or strategic roadmap changes.

## Executive assessment

MesaLogo has broad, usable core functionality, but it is not yet uniformly
production-ready. It is suitable today for controlled research, demos, and
pilot deployments of the established Action Space / Agent / MCP / Planner /
NetLogo paths. It should not yet be presented as complete for unattended
enterprise workloads, true parallel multi-agent streaming, visual workflow
orchestration, Heartbeat-driven simulation, or 5000-concurrency operation.

Avoid compressing this into one percentage. The two useful measurements are:

| Dimension | Evidence | Assessment |
|---|---|---|
| Feature coverage (功能覆盖) | README catalog: 25 stable, 10 MVP/Beta, 7 planned | 35/42 have an implementation; maturity-weighted coverage is about 71% (`stable + 0.5 × beta`) |
| Verification depth (验证深度) | 141 collected backend tests; 138 deterministic tests pass; 3 real-LLM E2E tests are opt-in | Unit coverage exists around fragile paths, but integration/E2E breadth remains low |

## Strongest areas

- Action Space, Role/Agent separation, variables, supervisor/rule sandbox.
- MCP server lifecycle and isolation.
- Planner, autonomous-task foundation, external Agent API, and NetLogo bridge.
- SSE cancellation/keepalive and model wire-format request construction.
- Frontend translation discipline: zh/en keys match and hard-coded visible CJK
  is blocked.
- The stability baseline adds CI for deterministic backend tests, diff-aware
  Ruff checks, frontend i18n, ESLint errors, and production builds.

## Partial or high-risk areas

- SubAgent nesting, ODM, Parallel Experiment Lab, memory partitions, and
  LightRAG remain MVP/Beta.
- The current test pyramid has only one real API integration module and three
  opt-in external E2E scenarios; frontend behavior has no automated component
  or browser tests.
- Ruff reports a large historical backlog, so CI can safely block only new-line
  regressions today.
- Frontend ESLint currently reports 399 warnings. CI blocks errors and keeps
  warnings visible.
- A source scan finds 112 `requests.*` / `time.sleep(...)` references under
  `backend-fastapi/app`. This is an audit queue, not proof that all 112 run on
  async request paths, but it conflicts with treating "fully async" as a
  completed, verified property.

## Not complete

- Workflow Graph visual orchestration.
- Heartbeat / ABM-tick-driven living agents.
- True parallel multi-agent execution with isolated output queues.
- Mesa Python integration and MemoryPalace v0.51.
- Validated 5000-concurrency architecture.

## Next release gates

1. Merge and observe the stability CI baseline on a clean GitHub runner.
2. Add integration scenarios for authentication, Action Space CRUD, one
   conversation/tool round, and scheduler stop behavior.
3. Turn the known autonomous-stop and SSE-400 failure reports into failing
   E2E tests before changing those paths.
4. Audit blocking I/O by reachable async call path, then migrate in small,
   measured batches.
5. Implement true parallel isolated streams before building Workflow Graph or
   claiming large-scale concurrency.
