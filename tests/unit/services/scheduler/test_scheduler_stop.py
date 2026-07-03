"""Unit tests for TaskScheduler.stop() wake-up semantics.

Repro for the "stop a PAUSED task leaves a zombie coroutine" bug
(TODO.md failure mode #1 variant):

The executor loop head is:

    while not task.cancel_event.is_set():
        await task.pause_event.wait()   # <- blocks while paused
        if task.cancel_event.is_set():
            break

pause() clears pause_event, so the coroutine parks inside wait().
stop() must therefore set BOTH cancel_event and pause_event, otherwise
the waiter never wakes up to observe the cancel.
"""

from __future__ import annotations

import asyncio

import pytest

from app.services.scheduler.scheduler import Task, TaskScheduler, TaskState


@pytest.fixture
def scheduler():
    TaskScheduler.reset_instance()
    yield TaskScheduler.get_instance()
    TaskScheduler.reset_instance()


def _make_paused_task(task_id: str = "t1") -> Task:
    task = Task(id=task_id, action_task_id="at1", conversation_id="c1")
    task.cancel_event = asyncio.Event()
    task.pause_event = asyncio.Event()
    task.pause_event.clear()  # paused
    task.state = TaskState.PAUSED
    return task


async def test_stop_sets_pause_event_so_waiters_wake(scheduler):
    task = _make_paused_task()
    scheduler._tasks[task.id] = task

    assert await scheduler.stop(task.id) is True

    assert task.cancel_event.is_set()
    # the actual bug: pause_event stayed cleared, executor blocked forever
    assert task.pause_event.is_set()
    assert task.state == TaskState.STOPPED


async def test_stop_paused_task_unblocks_executor_loop_head(scheduler):
    task = _make_paused_task()
    scheduler._tasks[task.id] = task

    entered_wait = asyncio.Event()

    async def executor_loop_head():
        # mirrors executor.py / scheduler._run_task loop head
        while not task.cancel_event.is_set():
            entered_wait.set()
            await task.pause_event.wait()
            if task.cancel_event.is_set():
                return "stopped"
        return "stopped"

    waiter = asyncio.ensure_future(executor_loop_head())
    await asyncio.wait_for(entered_wait.wait(), timeout=1.0)

    assert await scheduler.stop(task.id) is True

    # without the fix this raises TimeoutError: waiter is parked on
    # pause_event.wait() and never observes cancel_event
    result = await asyncio.wait_for(waiter, timeout=1.0)
    assert result == "stopped"


async def test_stop_running_task_still_works(scheduler):
    task = _make_paused_task("t2")
    task.pause_event.set()  # running, not paused
    task.state = TaskState.RUNNING
    scheduler._tasks[task.id] = task

    assert await scheduler.stop(task.id) is True
    assert task.cancel_event.is_set()
    assert task.state == TaskState.STOPPED


async def test_stop_unknown_task_returns_false(scheduler):
    assert await scheduler.stop("ghost") is False
