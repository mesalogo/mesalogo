# Parallel execution guide (并行执行手册)

> Read this before changing `asyncio.gather`, task groups, worker pools, SSE,
> WebSocket delivery, scheduler execution, SubAgent fan-out, or ParallelLab run
> orchestration.

## 1. Why this guide exists

Parallel execution in this repository is not merely a throughput optimization.
Each concurrent task may have its own conversation context, permissions,
simulation state, database lifecycle, external tool calls, and observable stream.
A shared mutable object can therefore corrupt experiment meaning without causing
an obvious crash.

Three incidents define the minimum contract:

- [parallel SSE interleave](./failures/2025-XX-parallel-sse-interleave.md):
  concurrent agents wrote into one result queue and mixed output/context;
- [autonomous task cannot stop](./failures/2025-11-autonomous-task-no-stop.md):
  clearing only one scheduler layer left zombie work;
- [HTTP 400 silent hang](./failures/2025-11-http-400-silent-hang.md): an error was
  logged but the client never received a terminal event.

## 2. Current repository reality

- True parallel multi-agent execution with isolated output streams is still
  incomplete; see [feature-readiness.md](./feature-readiness.md).
- Large-scale experiment execution is an existing platform baseline; this guide
  does not reopen that architecture decision.
- Do not add more orchestration responsibility to the already large
  `parallel_experiment_service.py`; introduce a bounded module with explicit
  ownership instead.

## 3. Non-negotiable invariants

### 3.1 Identity and ownership

Every asynchronous unit carries the identities needed to prove ownership:

```text
tenant -> experiment -> revision -> run -> attempt -> actor -> operation
```

Not every feature uses every level, but `task_id` alone is not sufficient when
multiple attempts, agents, or streams can exist.

- A queue/channel has one declared owner or one typed multiplexing protocol.
- An event is validated against channel ownership before delivery or persistence.
- Mutable conversation, database session, engine instance, and cancellation
  state are never shared across independent runs.
- Shared assets are read-only and preferably content-addressed.
- Context variables are set at the entry boundary and reset in `finally`.

### 3.2 Bounded concurrency

- Every fan-out has an explicit bound; never create one task per unbounded input.
- Apply bounds at all scarce resources: tenant, experiment, worker, model
  provider, engine process, database operation, and artifact upload.
- A semaphore limits admission but is not a durable queue or ownership record.
- Use queue `maxsize` or equivalent backpressure; do not buffer unlimited model
  deltas or experiment events in memory.
- Provider throttling must reduce admission. It must not create unbounded retry
  tasks.
- Never hold a database connection while awaiting a long model or engine call.

### 3.3 Structured lifecycle

Every started operation ends exactly once:

```text
planned -> queued -> starting -> running -> terminal
terminal = succeeded | invalid | failed | timed_out | cancelled | rejected
```

- Persist the transition before publishing a terminal user-visible event where
  practical.
- Completion handlers are idempotent.
- A retry creates a new attempt; it does not erase the failed attempt.
- Experiment counters are derived/reconciled from run state, not trusted as the
  sole source of truth.
- Process restart must not interpret missing in-memory state as success.

### 3.4 Cancellation

Cancellation is a protocol, not only `task.cancel()`.

One cancellation request must propagate through:

1. API command and admission control;
2. durable queue or scheduler trigger;
3. worker task and internal child tasks;
4. provider request or tool invocation;
5. engine adapter/process;
6. database and artifact finalization;
7. SSE/WebSocket terminal delivery.

Rules:

- Check cancellation at every loop boundary and before expensive side effects.
- Do not swallow `CancelledError`; clean up in `finally`, then re-raise or map it
  at the lifecycle boundary.
- Adapter `cancel()` and `close()` must be safe to call more than once.
- Stopping an experiment prevents new work and drains/removes queued work.
- If an external provider cannot cancel in flight, record that limitation and
  bound the wait with a timeout.
- A user-visible stop is not complete until terminal settlement is observable.

### 3.5 Error and stream semantics

- Logging an exception is not delivery.
- Every stream sends a structured `error` event and a terminal `done`/terminal
  event when an operation fails.
- Keepalive frames do not count as progress or terminal settlement.
- Preserve the earliest non-empty tool identity across streaming deltas; null
  continuation fields must not erase it. See
  [streamed tool identity failure](./failures/2026-07-streamed-tool-identity-null-overwrite.md).
- Do not guess a missing tool name or action. Return malformed structured output
  for bounded correction or mark the operation invalid.
- A slow client receives backpressure or a documented truncation policy; it must
  not cause unbounded server memory growth.

## 4. Safe execution shape

Use one context and one result channel per unit of independent work:

```python
async def run_one(spec: RunSpec, limiter: asyncio.Semaphore) -> RunResult:
    context = RunContext.create(spec)
    try:
        async with limiter:
            await context.mark_running()
            result = await execute_with_owned_resources(context)
            await context.mark_succeeded(result)
            return result
    except asyncio.CancelledError:
        await context.mark_cancelled()
        raise
    except DomainInvalidError as exc:
        await context.mark_invalid(exc)
        return RunResult.invalid(exc)
    except Exception as exc:
        await context.mark_failed(exc)
        raise
    finally:
        await context.close_owned_resources()
```

This is illustrative, not a copy-paste API. The important properties are owned
resources, bounded admission, explicit domain invalidity, idempotent terminal
state, and cleanup in `finally`.

When collecting results concurrently:

- return typed results to the parent, or publish to distinct child channels;
- if multiplexing for one client, attach stable source identity and sequence;
- preserve input/result association explicitly rather than relying on completion
  order;
- choose fail-fast or collect-all behavior in the feature contract;
- cancel and await remaining children when fail-fast behavior is selected;
- never reuse one mutable message list as scratch space for multiple children.

## 5. Database and external-resource rules

- Do not share a SQLAlchemy session across threads or independent async tasks.
- Open a session for a short ownership scope, commit/rollback explicitly, and
  close it before awaiting long external I/O.
- Prefer database constraints or compare-and-set transitions for lifecycle
  invariants; an in-memory lock is not sufficient across processes.
- Use unique idempotency keys for queue delivery and side-effecting callbacks.
- Claim durable work with a lease/heartbeat when a worker can die mid-run.
- On lease expiry, resume only from a verified checkpoint; otherwise record a
  failed attempt and create a new attempt.
- Temporary engine processes and clients belong to one run context and close in
  success, error, timeout, and cancellation paths.

## 6. Anti-patterns

Do not introduce these patterns:

```python
# One shared queue for unrelated agents.
await asyncio.gather(*(agent.run(result_queue=shared_queue) for agent in agents))

# Unlimited fan-out.
tasks = [asyncio.create_task(run(item)) for item in every_database_row]

# Swallowed cancellation.
try:
    await work()
except BaseException:
    logger.exception("work failed")

# Error without terminal stream delivery.
except Exception:
    logger.exception("request failed")
    return
```

Also avoid:

- global dictionaries as the only record of running work;
- polling that creates or starts work as a side effect of checking status;
- blocking `requests.*`, `time.sleep`, or large synchronous file I/O on async
  paths;
- holding a transaction open around an LLM call;
- retrying every exception with the same policy;
- treating `asyncio.gather` as proof of isolation;
- declaring a concurrency count without defining active run type, model-call
  rate, hardware, provider quotas, duration, and success criteria.

## 7. Required test matrix

### 7.1 Isolation

- two runs emit overlapping output without cross-run events;
- two actors in one run preserve actor identity and ordering per actor;
- one run cannot read another run's mutable context or artifact namespace;
- randomized scheduling repeats the isolation test enough to expose races.

### 7.2 Lifecycle and idempotency

- success emits/persists one terminal event;
- domain invalidity remains distinct from infrastructure failure;
- duplicate delivery/completion does not duplicate effects or counters;
- retry creates a new attempt and preserves the old one;
- process restart reconciles active leases and persisted states.

### 7.3 Cancellation and timeout

- cancel while queued;
- cancel during model streaming;
- cancel during tool/engine execution;
- cancel during result persistence or artifact upload;
- provider timeout and engine timeout;
- repeated stop requests;
- verify queues, scheduler triggers, external processes, and client streams all
  reach the expected state.

### 7.4 Streaming

- HTTP 4xx/5xx produces error plus terminal delivery;
- malformed tool/action chunks do not hang the stream;
- null continuation deltas do not erase streamed identity;
- a slow/disconnected client activates the declared backpressure policy;
- interleaved producer scheduling preserves source identity.

### 7.5 Load and backpressure

- queue capacity is enforced;
- provider rate limit reduces admission;
- database pool exhaustion fails or waits predictably without deadlock;
- memory remains bounded with a slow consumer;
- stop latency, terminal settlement, throughput, failure rate, and resource use
  are measured together.

Unit tests alone are insufficient for lifecycle, cancellation, streaming, and
worker-loss claims. Add integration tests, and add an end-to-end test before
marking the behavior production-ready.

## 8. Change checklist

Before implementation:

- identify the exact ownership unit and identity fields;
- document fail-fast versus collect-all behavior;
- document cancellation and retry semantics;
- choose bounded concurrency and backpressure points;
- determine which state must survive process restart;
- write the race/failure test that the change must pass.

Before handoff:

- inspect every `create_task`, `gather`, executor submission, queue, and background
  callback touched by the diff;
- verify no blocking I/O was added to an async path;
- verify database sessions and external clients have one owner;
- run targeted unit, integration, and streaming tests;
- exercise one real stop/error path and observe terminal client behavior;
- update [feature-readiness.md](./feature-readiness.md) only when the evidence
  layer genuinely changed.
