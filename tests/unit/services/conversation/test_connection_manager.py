"""Unit tests for ConnectionManager cancellation invariants.

The most important property is the TOMBSTONE (墓碑) invariant documented in
docs/agents/stream-cancel-architecture.md §2.3: force_close_connection deletes
the connection dict entry but keeps the interrupt flag, so that a worker still
inside the streaming loop can discover the cancel *after* teardown.

  after force_close_connection(rid):
      is_cancelled(rid)     == False   (dict entry gone)
      should_interrupt(rid) == True    (flag survives as tombstone)

These are pure in-memory checks: no network, no real httpx connection.
"""

from __future__ import annotations

import asyncio

from app.services.conversation.connection_manager import ConnectionManager


class _FakeTask:
    """Minimal stand-in for asyncio.Task: not done, records cancel()."""

    def __init__(self):
        self.cancelled = False

    def done(self):
        return False

    def cancel(self):
        self.cancelled = True


class _FakeLoop:
    """Minimal stand-in for an event loop: runs the callback inline."""

    def call_soon_threadsafe(self, fn, *args):
        fn(*args)


def _mgr():
    # Fresh instance per test; the production singleton is module-global.
    return ConnectionManager()


def _register_live(m, request_id):
    # Mirror how AsyncStreamRunner registers: always with an async_task +
    # event_loop, so force_close has something concrete to cancel (returns True).
    m.register_connection(request_id, async_task=_FakeTask(), event_loop=_FakeLoop())


def test_register_then_not_cancelled():
    m = _mgr()
    _register_live(m, "t:c:a")
    assert m.is_cancelled("t:c:a") is False
    assert m.should_interrupt("t:c:a") is False


def test_unknown_request_is_not_interrupted():
    # A brand-new request_id (checked before register) must NOT look cancelled.
    m = _mgr()
    assert m.is_cancelled("nope") is False
    assert m.should_interrupt("nope") is False


def test_tombstone_invariant_after_force_close():
    m = _mgr()
    task = _FakeTask()
    m.register_connection("t:c:a", async_task=task, event_loop=_FakeLoop())
    assert m.force_close_connection("t:c:a") is True

    # the async task was hard-cancelled
    assert task.cancelled is True
    # dict entry deleted -> is_cancelled False
    assert m.is_cancelled("t:c:a") is False
    # interrupt flag kept as tombstone -> should_interrupt True
    assert m.should_interrupt("t:c:a") is True


def test_force_close_missing_connection_is_safe():
    m = _mgr()
    # Closing something never registered must not raise and reports success.
    assert m.force_close_connection("ghost") is True


def test_cancel_before_register_leaves_pending_tombstone():
    # Repro: user clicks stop in the gap between two streaming rounds (e.g.
    # during tool execution) when no connection is registered. The cancel must
    # NOT be lost: it has to leave a set tombstone so the worker's next
    # check_for_cancel_signal() (which polls should_interrupt) aborts the round.
    m = _mgr()
    assert m.force_close_connection("t:c:a") is True

    assert m.should_interrupt("t:c:a") is True


def test_pending_tombstone_cleared_by_next_register():
    # A brand-new request reusing the same request_id must start clean,
    # same semantics as test_reregister_same_id_resets_flag.
    m = _mgr()
    m.force_close_connection("t:c:a")
    assert m.should_interrupt("t:c:a") is True

    _register_live(m, "t:c:a")
    assert m.should_interrupt("t:c:a") is False
    assert m.is_cancelled("t:c:a") is False


def test_pending_tombstone_reaped_by_cleanup():
    m = _mgr()
    m.force_close_connection("t:c:a")
    assert "t:c:a" in m._thread_interrupt_flags

    m.cleanup_old_connections(max_age_seconds=3600)
    assert "t:c:a" not in m._thread_interrupt_flags


def test_force_close_by_prefix_closes_only_matching():
    m = _mgr()
    _register_live(m, "1:2:a")
    _register_live(m, "1:2:b")
    _register_live(m, "9:9:z")

    closed = m.force_close_connections_by_prefix("1:2:")
    assert closed == 2

    # matching ones are torn down (tombstoned)
    assert m.should_interrupt("1:2:a") is True
    assert m.should_interrupt("1:2:b") is True
    # non-matching one is untouched and still live
    assert m.is_cancelled("9:9:z") is False
    assert m.should_interrupt("9:9:z") is False


def test_reregister_same_id_resets_flag():
    # Reusing a request_id after a prior cancel must start clean, otherwise the
    # tombstone of the old run would instantly kill the new run.
    m = _mgr()
    _register_live(m, "t:c:a")
    m.force_close_connection("t:c:a")
    assert m.should_interrupt("t:c:a") is True

    _register_live(m, "t:c:a")
    assert m.should_interrupt("t:c:a") is False
    assert m.is_cancelled("t:c:a") is False


# ── periodic cleanup / tombstone reaping ─────────────────────────────────


def test_cleanup_reaps_orphaned_tombstone_flag():
    # After a cancel, the interrupt flag is an orphaned tombstone. The reaper
    # must remove it so _thread_interrupt_flags does not grow unbounded.
    m = _mgr()
    _register_live(m, "t:c:a")
    m.force_close_connection("t:c:a")
    assert "t:c:a" in m._thread_interrupt_flags  # tombstone present

    m.cleanup_old_connections(max_age_seconds=3600)

    assert "t:c:a" not in m._thread_interrupt_flags
    # once the tombstone is gone, should_interrupt falls back to False
    assert m.should_interrupt("t:c:a") is False


def test_cleanup_force_closes_aged_connection(monkeypatch):
    import app.services.conversation.connection_manager as cm

    m = _mgr()
    _register_live(m, "old:1:a")
    # make the connection look 2h old
    m._active_connections["old:1:a"]["created_at"] -= 7200

    m.cleanup_old_connections(max_age_seconds=3600)

    # aged connection torn down (and its now-set tombstone reaped in same pass)
    assert "old:1:a" not in m._active_connections


def test_cleanup_keeps_live_unset_flag():
    # A live connection whose flag is NOT set must survive cleanup.
    m = _mgr()
    _register_live(m, "live:1:a")
    m.cleanup_old_connections(max_age_seconds=3600)
    assert "live:1:a" in m._active_connections
    assert "live:1:a" in m._thread_interrupt_flags


async def test_periodic_cleanup_runs_and_stops(monkeypatch):
    # Drive the loop with a tiny interval; assert it actually calls
    # cleanup_old_connections, then that stop cancels the task.
    m = _mgr()
    calls = []
    monkeypatch.setattr(m, "cleanup_old_connections", lambda *a, **k: calls.append(1))

    m.start_periodic_cleanup(interval_seconds=0, max_age_seconds=10)
    # idempotent: second call must not spawn a second task
    task = m._cleanup_task
    m.start_periodic_cleanup(interval_seconds=0, max_age_seconds=10)
    assert m._cleanup_task is task

    await asyncio.sleep(0.05)
    assert len(calls) > 0

    m.stop_periodic_cleanup()
    assert m._cleanup_task is None
