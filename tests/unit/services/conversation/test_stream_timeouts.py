"""Repro + guard for streaming timeout dead-ends (流式超时兜底).

Bug #4: AsyncStreamRunner.iter_lines used to exhaust its read-timeout polls
and silently `break`. The user saw a "normally finished" but truncated reply
with no error whatsoever. It must raise TimeoutError so the existing
socket-timeout branch in handle_streaming_response notifies the callback.

Bug #5: queue_to_sse used a blocking `result_queue.get()` with no timeout.
If the producer thread died without pushing the `None` sentinel, the SSE
generator hung forever (frontend spinner never resolves). It must poll with
a timeout, emit SSE keepalive comments while idle, and after max idle emit
a done event and terminate.
"""

from __future__ import annotations

import json
import queue
import threading

import pytest

from app.services.conversation import stream_handler
from app.services.conversation.model_client import AsyncStreamRunner


# ── bug #4: iter_lines read-timeout must raise, not silently truncate ────


def test_iter_lines_raises_timeout_when_no_data(monkeypatch):
    monkeypatch.setattr(
        stream_handler.connection_manager, "is_cancelled", lambda rid: False
    )
    monkeypatch.setattr(
        stream_handler.connection_manager, "should_interrupt", lambda rid: False
    )
    runner = AsyncStreamRunner("t:c:a", http_read_timeout=1, poll_interval=0.01)

    with pytest.raises(TimeoutError):
        list(runner.iter_lines())


def test_iter_lines_yields_data_then_done_without_timeout():
    runner = AsyncStreamRunner("t:c:a", http_read_timeout=5, poll_interval=0.01)
    runner.line_queue.put(("line", "hello"))
    runner.line_queue.put(("done", None))

    assert list(runner.iter_lines()) == ["hello"]


def test_iter_lines_still_stops_on_cancel(monkeypatch):
    # cancel detection via connection_manager must exit cleanly (no raise)
    monkeypatch.setattr(
        stream_handler.connection_manager, "is_cancelled", lambda rid: True
    )
    runner = AsyncStreamRunner("t:c:a", http_read_timeout=60, poll_interval=0.01)

    assert list(runner.iter_lines()) == []


def test_handle_streaming_response_surfaces_timeout_to_callback(monkeypatch):
    # End-to-end through handle_streaming_response: a TimeoutError from
    # iter_lines must produce a user-visible warning via callback, not a
    # silent "normal" completion.
    monkeypatch.setattr(
        stream_handler.connection_manager, "is_cancelled", lambda rid: False
    )
    monkeypatch.setattr(
        stream_handler.connection_manager, "should_interrupt", lambda rid: False
    )

    class _TimeoutResponse:
        status_code = 200

        def iter_lines(self):
            yield 'data: {"choices":[{"delta":{"content":"partial"}}]}'
            raise TimeoutError("等待流式数据超时")

    chunks = []

    def cb(content, meta=None):
        if content:
            chunks.append(content)

    api_config = {
        "api_format": "openai-compatible",
        "task_id": 1,
        "conversation_id": 2,
        "agent_info": {"id": "a1"},
    }
    result = stream_handler.handle_streaming_response(
        _TimeoutResponse(), cb, original_messages=[], api_config=api_config
    )

    joined = "".join(chunks)
    assert "partial" in joined
    assert "超时" in joined  # user-visible timeout notice
    assert "partial" in result


# ── bug #5: queue_to_sse must not hang forever without the None sentinel ──


def _drain_sse(gen, limit=50):
    out = []
    for item in gen:
        out.append(item)
        if len(out) >= limit:
            break
    return out


def test_queue_to_sse_terminates_when_producer_dies():
    # empty queue, no sentinel: generator must emit keepalives, then a done
    # event, then terminate -- instead of blocking forever.
    q = queue.Queue()
    result = {}

    def run():
        result["items"] = _drain_sse(
            stream_handler.queue_to_sse(q, poll_interval_seconds=0.01, max_idle_seconds=0.05)
        )

    t = threading.Thread(target=run, daemon=True)
    t.start()
    t.join(timeout=5)

    assert not t.is_alive(), "queue_to_sse hung forever on a dead producer"
    items = result["items"]
    assert any(item.startswith(":") for item in items), "expected SSE keepalive comments"
    done_payloads = [
        item for item in items
        if item.startswith("data: {") and '"connectionStatus": "done"' in item
    ]
    assert done_payloads, "expected a done event so the frontend spinner resolves"


def test_queue_to_sse_normal_flow_unaffected():
    q = queue.Queue()
    q.put({"content": "hi"})
    q.put(None)  # sentinel

    items = _drain_sse(
        stream_handler.queue_to_sse(q, poll_interval_seconds=0.5, max_idle_seconds=10)
    )
    data_items = [i for i in items if i.startswith("data: {")]
    assert json.loads(data_items[0][6:].strip()) == {"content": "hi"}
    assert items[-1] == "data: \n\n"


def test_queue_to_sse_idle_timer_resets_on_message():
    # a message arriving between idle polls must reset the idle budget
    q = queue.Queue()

    def feed():
        import time
        for _ in range(3):
            time.sleep(0.03)
            q.put({"content": "tick"})
        q.put(None)

    feeder = threading.Thread(target=feed, daemon=True)
    feeder.start()

    items = _drain_sse(
        stream_handler.queue_to_sse(q, poll_interval_seconds=0.01, max_idle_seconds=0.08)
    )
    # all three ticks must be delivered (no premature idle abort at 0.08s total)
    assert sum(1 for i in items if "tick" in i) == 3
    assert items[-1] == "data: \n\n"
