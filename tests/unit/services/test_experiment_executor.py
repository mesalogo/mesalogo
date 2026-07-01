"""Unit tests for experiment_executor concurrency/state bookkeeping.

Covers the three fixes:
- worker pool sized by SUM(max_concurrent) across live experiments, not MAX
- per-experiment creation lock serializes lazy task creation (no duplicate Runs)
- in-memory state is released on cleanup (no leak)

These exercise only the pure in-memory helpers; submitting empty task_ids
means _dispatch has nothing to run, so no DB / threads are touched.
"""
from __future__ import annotations

import pytest

from app.services import experiment_executor as ex


@pytest.fixture(autouse=True)
def _reset_executor_state():
    """Isolate module globals between tests."""
    ex.shutdown()
    ex._experiment_state.clear()
    ex._creation_locks.clear()
    yield
    ex.shutdown()
    ex._experiment_state.clear()
    ex._creation_locks.clear()


def test_worker_pool_sized_by_sum_across_experiments():
    ex.submit_experiment_tasks("exp-a", [], {}, max_concurrent=3)
    assert ex._executor_size == 3

    # Second live experiment must ADD capacity, not be capped at MAX(3).
    ex.submit_experiment_tasks("exp-b", [], {}, max_concurrent=4)
    assert ex._executor_size == 7


def test_stopped_experiment_excluded_from_worker_sum():
    ex.submit_experiment_tasks("exp-a", [], {}, max_concurrent=3)
    ex.cancel_experiment("exp-a")  # marks stopped
    assert ex._required_workers_locked() == 0

    ex.submit_experiment_tasks("exp-b", [], {}, max_concurrent=5)
    assert ex._required_workers_locked() == 5


def test_get_creation_lock_is_stable_per_experiment():
    lock1 = ex.get_creation_lock("exp-a")
    lock2 = ex.get_creation_lock("exp-a")
    lock_other = ex.get_creation_lock("exp-b")
    assert lock1 is lock2
    assert lock1 is not lock_other


def test_creation_lock_serializes_concurrent_creation():
    """Second acquirer must be rejected while the first holds the lock.

    This is the guard against executor-callback and web-poll threads both
    pulling the same pending combination and double-creating a Run.
    """
    lock = ex.get_creation_lock("exp-a")
    assert lock.acquire(blocking=False) is True
    try:
        assert lock.acquire(blocking=False) is False
    finally:
        lock.release()
    assert lock.acquire(blocking=False) is True
    lock.release()


def test_cleanup_releases_state_when_no_running_tasks():
    ex.submit_experiment_tasks("exp-a", [], {}, max_concurrent=3)
    ex.get_creation_lock("exp-a")
    assert "exp-a" in ex._experiment_state

    ex.cleanup_experiment("exp-a")
    assert "exp-a" not in ex._experiment_state
    assert "exp-a" not in ex._creation_locks


def test_cleanup_defers_when_tasks_still_running():
    ex.submit_experiment_tasks("exp-a", [], {}, max_concurrent=3)
    ex._experiment_state["exp-a"]["running"] = 2

    ex.cleanup_experiment("exp-a")
    # Still-running threads: keep state but mark stopped so the last
    # done-callback drains it.
    assert "exp-a" in ex._experiment_state
    assert ex._experiment_state["exp-a"]["stopped"] is True
    assert ex._experiment_state["exp-a"]["pending"] == []


def test_cleanup_is_idempotent_for_unknown_experiment():
    ex.cleanup_experiment("does-not-exist")  # must not raise
    assert "does-not-exist" not in ex._experiment_state


def test_resubmit_after_cancel_resets_stopped_flag():
    ex.submit_experiment_tasks("exp-a", [], {}, max_concurrent=3)
    ex.cancel_experiment("exp-a")
    assert ex._experiment_state["exp-a"]["stopped"] is True

    ex.submit_experiment_tasks("exp-a", [], {}, max_concurrent=3)
    assert ex._experiment_state["exp-a"]["stopped"] is False
