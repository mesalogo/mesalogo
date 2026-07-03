# Stream cancellation architecture (流式取消架构)

> Read this before touching `connection_manager.py`, the cancel paths in
> `model_client.py` (`AsyncStreamRunner`, `cancel_request`), or
> `stream_handler.py` (`check_for_cancel_signal`). This is a 🟥 high-risk area:
> one wrong edit leaves a request that cannot be stopped (TODO.md failure #1)
> or a frontend spinner that hangs forever (failure #2).

Language policy: English-first, Chinese as glossary.

## 1. The hard problem this solves

The call site is **synchronous**: `ModelClient.send_request()` returns a `str`.
But the work is a **streaming HTTP read** that may block for tens of seconds
inside `aiter_lines()` waiting for the LLM to emit the next token. We must be
able to **hard-cancel (硬取消)** that in-flight read from *another thread* (the
HTTP request handler that received the user's "stop" click), and have the
synchronous caller unwind cleanly.

This is the single reason the project uses **raw httpx, not the OpenAI/Anthropic
SDKs**: the SDKs hide the connection object, so you cannot reach in and kill a
blocked read across threads. See the model-integration refactor decision.

## 2. The load-bearing pieces (do NOT remove)

```
caller thread (sync)                 worker thread (asyncio loop)
─────────────────────                ─────────────────────────────
send_request(is_stream=True)
  └─ AsyncStreamRunner.start() ─────▶ _run_loop()
                                        new_event_loop()
                                        task = _async_stream()
                                        connection_manager.register_connection(
                                            request_id, async_task, event_loop)
  iter_lines()  ◀── line_queue ─────── async for line in resp.aiter_lines():
                                            line_queue.put(('line', line))
  handle_streaming_response(wrapper)
    check_for_cancel_signal()  every line/blank line
```

Cancellation, triggered by `cancel_request()` →
`connection_manager.force_close_connection(request_id)`:

1. **`asyncio.Task.cancel()` via `loop.call_soon_threadsafe`** — the real hard
   cancel. Wakes the worker loop, raises `CancelledError` inside
   `aiter_lines()`, the `async with client.stream(...)` closes the socket.
   This is mechanism #1 and the only thing that *interrupts a blocked read*.
2. **`cancelled` flag** (per-connection dict entry) — polled by
   `AsyncStreamRunner.iter_lines()` on every 2s queue timeout and by
   `check_for_cancel_signal()`. This is the **fallback** for when the
   `CancelledError` doesn't propagate instantly (slow/blocked network): the
   sync side still notices within ≤2s and stops iterating. Necessary.
3. **`interrupt_flag` (threading.Event) + `should_interrupt()`** — this is NOT
   redundant with the `cancelled` flag, despite looking like it. Subtlety:
   `force_close_connection()` does `del self._active_connections[request_id]`
   in its `finally`, **but deliberately keeps `_thread_interrupt_flags[...]`**.
   After deletion:
   - `is_cancelled(request_id)` → **False** (dict entry gone)
   - `should_interrupt(request_id)` → **True** (flag survives)
   So the Event is the **tombstone (墓碑标记)** that lets a worker still inside
   the loop discover "you were cancelled" *after* the connection record was
   already torn down. Every cancel check is therefore
   `is_cancelled(...) or should_interrupt(...)` — the two cover disjoint
   windows (before vs after dict deletion). Remove either and you reopen the
   "can't stop" failure mode.
4. **queue cancel signal** — `callback.result_queue` may receive
   `{'type': 'cancel'}` (used when the stop path pushes onto the agent's result
   queue rather than going through connection_manager). `check_for_cancel_signal`
   honors it. Necessary for the auto-discussion stop path.

## 3. What was genuinely dead / no-op (removed 2026-05-30)

These carried no behavior on any live path and were removed as part of the
"compress meaningless complexity" cleanup:

- **`set_socket_timeout()` in `stream_handler.py`** — pokes
  `response.raw._connection.sock`. The only live caller of
  `handle_streaming_response()` (`model_client.py`) always passes an
  `AsyncResponseWrapper`, which has **no `.raw`**, so every call returned
  `False` and did nothing. The actual fast-cancel response comes from the
  2s queue-poll in `AsyncStreamRunner.iter_lines()`, not from socket timeouts.
  (Historic: this was real in the old *synchronous* httpx path that streamed a
  true `httpx.Response`; that path is gone.)
- **`ConnectionManager.update_connection()`** — zero callers (only referenced
  by stale docs). Was part of the sync-era flow where the response object was
  attached after the request started.
- **`ConnectionManager.get_active_connections()`** — zero callers.
- **`ConnectionManager.get_interrupt_flags_count()`** — debug-only, zero callers.
- **`ConnectionManager.clear_interrupt_flag()`** — zero callers; the only flag
  GC that runs is the inline `del` inside `cleanup_old_connections()`.

`cancel_request()`'s no-`agent_id` branch was also de-duplicated to call
`force_close_connections_by_prefix()` instead of re-implementing the same
prefix sweep while iterating `_active_connections` **without the lock**.

## 3.5 Pending tombstone: cancel arriving before/without a registered connection (2026-07-03)

`force_close_connection()` on an id with **no** active connection used to be a
pure no-op ("return True, avoid stuck frontend"). That silently dropped the
cancel when the user pressed stop in a gap where no connection record existed:
between tool-call rounds after a prior teardown, after the periodic reaper had
GC'd everything, or when re-pressing stop on a zombie stream. Now it sets a
**pending tombstone**: the interrupt flag is created and set even though there
is no connection dict entry, so the worker's next
`should_interrupt()` poll (`check_for_cancel_signal`, `iter_lines` 2s poll)
still observes the cancel.

Bounds: the next `register_connection()` on the same id replaces the flag
(same "new run starts clean" semantics as §2.3 / the reregister test), and
`cleanup_old_connections()` reaps orphaned set flags. Known residual window:
a cancel landing in the sub-100ms gap between `AsyncStreamRunner.start()` and
its `register_connection()` is still wiped by that register; closing it would
require distinguishing "pending cancel" from "stale tombstone before a
legitimate new run", which the current data model cannot do.

Guard tests: `test_cancel_before_register_leaves_pending_tombstone`,
`test_pending_tombstone_cleared_by_next_register`,
`test_pending_tombstone_reaped_by_cleanup`.

## 3.6 Queue cancel check must be a non-destructive scan (2026-07-03)

`check_for_cancel_signal()` used to `get_nowait()` one message off
`callback.result_queue` and `put()` it back when it was not a cancel dict.
Two bugs: (a) the same queue is concurrently drained by `queue_to_sse`, and a
popped-then-requeued data message lands at the **tail**, reordering SSE output
towards the frontend whenever the consumer lags; (b) a cancel dict sitting
*behind* pending data messages was invisible to a head-only peek. The check
now scans the whole deque under `queue.mutex` without consuming anything; the
cancel message itself stays queued for `queue_to_sse`, which emits the
cancel-done events to the frontend.

Guard tests: `test_cancel_check_does_not_reorder_pending_queue_messages`,
`test_queue_cancel_signal_detected_behind_pending_messages`.

## 3.7 Timeout dead-ends fixed (2026-07-03)

Two silent-failure paths were converted into loud ones:

- **`AsyncStreamRunner.iter_lines` read-timeout**: after exhausting
  `http_read_timeout` worth of empty polls it used to `break`, so the user got
  a "normally finished" truncated reply with no error. It now raises
  `TimeoutError` (`from None`), which `handle_streaming_response` catches in
  its `except socket.timeout` branch (Py3.10+: `socket.timeout` **is**
  `TimeoutError`) and surfaces a `[警告] 模型响应超时…` callback to the user.
  The poll interval is now a constructor arg (`poll_interval`, default 2.0s)
  so tests can run at ms scale.
- **`queue_to_sse` blocking `get()`**: if the producer thread died without
  pushing the `None` sentinel, the SSE generator hung forever (failure #2
  variant). It now polls with `poll_interval_seconds` (default 15s), emits SSE
  comment keepalives (`: keepalive`, ignored by the frontend's `data: ` parser,
  also prevents proxy idle disconnects), and after `max_idle_seconds` (default
  1h) emits a `connectionStatus: done` event and terminates.

Guard tests: `tests/unit/services/conversation/test_stream_timeouts.py`.

The cancel-stream route (`conversations.py::cancel_streaming_response`) also
moved its blocking work (sync ORM query, external-platform stop API,
`stop_task`'s `future.result(timeout=5)`) into `asyncio.to_thread` so a stop
click cannot stall the event loop.

## 4. Periodic reaper (tombstone GC)

`_thread_interrupt_flags` entries are intentionally kept past connection
deletion (the tombstone, §2.3). They are reaped by `cleanup_old_connections()`,
which is now driven on a schedule:

- `ConnectionManager.start_periodic_cleanup(interval_seconds=300,
  max_age_seconds=3600)` spawns an asyncio task (`_cleanup_loop`) that every
  `interval_seconds` calls `cleanup_old_connections()`. The **interval itself
  is the tombstone grace period** — at minutes-scale it is far longer than the
  worker's 2s queue poll, so the reaper can never race a worker that is still
  inside the loop and delete a flag it hasn't read yet.
- Wired in `main.py`: started in `startup_event` (step 5.5), cancelled in
  `shutdown_event`. `start_periodic_cleanup` is idempotent; the loop swallows
  per-iteration exceptions so it never dies and lets the dict grow again.

Do not "simplify" by reaping flags immediately on `force_close_connection` —
that destroys the tombstone (§2.3) and reopens the can't-stop failure mode.

## 5. Minimum tests that must stay green

- `tests/unit/services/conversation/test_responses_streaming.py`
  - `test_responses_stream_stops_on_connection_manager_cancel`
  - `test_responses_stream_stops_on_queue_cancel_signal`
  - `test_responses_stream_completes_when_not_cancelled` (control)
- `tests/unit/services/conversation/test_connection_manager.py`
  - tombstone invariant: after `force_close_connection`,
    `is_cancelled` is False **and** `should_interrupt` is True
  - `force_close_connections_by_prefix` closes only matching ids

If you "simplify" the tombstone away, the connection_manager test fails first —
that's the guard rail.

---

_created 2026-05-30 during the model-integration refactor cleanup; supersedes
the stale `docs/optimization-connectionmanager/PLAN.md` sync-era line refs._
