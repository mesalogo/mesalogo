"""Unit tests for OpenAI Responses-API streaming parsing in stream_handler.

`handle_streaming_response` is the project's most fragile path. These tests
pin the NEW Responses branch (gated by api_config['api_format'] == 'openai')
without touching the proven Chat-Completions / Anthropic branches.

We drive it with a fake response whose iter_lines() yields canned SSE lines,
and a plain callable callback (no result_queue) so no streaming task is
registered and no DB / connection_manager state is needed.
"""

from __future__ import annotations

import json
import queue

from app.services.conversation import stream_handler


class _FakeStreamResponse:
    def __init__(self, lines):
        self._lines = lines
        self.status_code = 200

    def iter_lines(self):
        yield from self._lines


def _sse(obj) -> str:
    return f"data: {json.dumps(obj)}"


def _run(lines, api_format="openai"):
    chunks = []

    def cb(content, meta=None):
        if content:
            chunks.append(content)

    api_config = {"api_format": api_format, "agent_info": {}}
    result = stream_handler.handle_streaming_response(
        _FakeStreamResponse(lines), cb, original_messages=[], api_config=api_config
    )
    return result, chunks


def test_responses_text_deltas_are_streamed_and_accumulated():
    lines = [
        _sse({"type": "response.created"}),
        _sse({"type": "response.output_text.delta", "delta": "Hello"}),
        _sse({"type": "response.output_text.delta", "delta": ", world"}),
        _sse({"type": "response.completed"}),
        "data: [DONE]",
    ]
    result, chunks = _run(lines)
    assert "".join(chunks) == "Hello, world"
    assert result == "Hello, world"


def test_responses_ignores_lifecycle_events():
    # Lifecycle-only stream produces no streamed text. stream_handler treats a
    # totally empty model response as a diagnostic error (not our concern here);
    # what we assert is that none of these events are mis-parsed into content.
    lines = [
        _sse({"type": "response.created"}),
        _sse({"type": "response.in_progress"}),
        _sse({"type": "response.output_item.done"}),
        _sse({"type": "response.completed"}),
        _sse({"type": "response.output_text.delta", "delta": "x"}),
    ]
    _result, chunks = _run(lines)
    assert chunks == ["x"]


def test_responses_error_event_surfaces_to_callback():
    lines = [
        _sse({"type": "response.output_text.delta", "delta": "partial"}),
        _sse({"type": "response.error", "error": {"message": "boom"}}),
    ]
    _result, chunks = _run(lines)
    joined = "".join(chunks)
    assert "partial" in joined
    assert "boom" in joined


def test_responses_branch_does_not_fire_for_chat_completions():
    # A Responses-style event arriving under openai-compatible must NOT be
    # consumed by the Responses branch (it would be parsed by other branches).
    lines = [
        _sse({"type": "response.output_text.delta", "delta": "should-not-stream"}),
        "data: [DONE]",
    ]
    _result, chunks = _run(lines, api_format="openai-compatible")
    assert "should-not-stream" not in "".join(chunks)


# ── interruption / hard-cancel (协议无关，但必须验证 Responses 流也遵守) ──────
#
# 取消在每行 chunk 解析之前由 check_for_cancel_signal() 检查，先于 Responses
# 分支。这两条路径是当初选择保留 httpx（而非 SDK）的核心理由，必须覆盖。


class _QueueCallback:
    """带 result_queue 的 callback —— 触发 _request_id 计算与队列取消检查。"""

    def __init__(self):
        self.result_queue = queue.Queue()
        self.chunks = []

    def __call__(self, content, meta=None):
        if content:
            self.chunks.append(content)


def _api_config_with_ids():
    # 提供 task_id/conversation_id/agent_id 使 _request_id 非空，
    # 从而启用 connection_manager 取消检查路径。
    return {
        "api_format": "openai",
        "task_id": 1,
        "conversation_id": 2,
        "agent_info": {"id": "agent-7"},
    }


def test_responses_stream_stops_on_connection_manager_cancel(monkeypatch):
    # connection_manager.is_cancelled -> True：流应在第一行就中断，
    # 抛 StreamCancelledException 并被捕获后返回 ""，后续行不得被解析。
    monkeypatch.setattr(
        stream_handler.connection_manager, "is_cancelled", lambda rid: True
    )
    monkeypatch.setattr(
        stream_handler.connection_manager, "should_interrupt", lambda rid: False
    )

    cb = _QueueCallback()
    lines = [
        _sse({"type": "response.output_text.delta", "delta": "AFTER-CANCEL"}),
        _sse({"type": "response.output_text.delta", "delta": "MORE"}),
    ]
    result = stream_handler.handle_streaming_response(
        _FakeStreamResponse(lines), cb, original_messages=[], api_config=_api_config_with_ids()
    )
    assert result == ""
    assert "AFTER-CANCEL" not in "".join(cb.chunks)


def test_responses_stream_stops_on_queue_cancel_signal(monkeypatch):
    # 队列里投递 {'type':'cancel'}：第一次检查即应中断。
    monkeypatch.setattr(
        stream_handler.connection_manager, "is_cancelled", lambda rid: False
    )
    monkeypatch.setattr(
        stream_handler.connection_manager, "should_interrupt", lambda rid: False
    )

    cb = _QueueCallback()
    cb.result_queue.put({"type": "cancel", "agent_id": "agent-7"})
    lines = [
        _sse({"type": "response.output_text.delta", "delta": "SHOULD-NOT-APPEAR"}),
    ]
    result = stream_handler.handle_streaming_response(
        _FakeStreamResponse(lines), cb, original_messages=[], api_config=_api_config_with_ids()
    )
    assert result == ""
    assert "SHOULD-NOT-APPEAR" not in "".join(cb.chunks)


def test_responses_stream_completes_when_not_cancelled(monkeypatch):
    # 对照组：取消源都为 False 时，正常流必须跑完并累积全部文本。
    monkeypatch.setattr(
        stream_handler.connection_manager, "is_cancelled", lambda rid: False
    )
    monkeypatch.setattr(
        stream_handler.connection_manager, "should_interrupt", lambda rid: False
    )

    cb = _QueueCallback()
    lines = [
        _sse({"type": "response.output_text.delta", "delta": "Hello"}),
        _sse({"type": "response.output_text.delta", "delta": " there"}),
        _sse({"type": "response.completed"}),
        "data: [DONE]",
    ]
    result = stream_handler.handle_streaming_response(
        _FakeStreamResponse(lines), cb, original_messages=[], api_config=_api_config_with_ids()
    )
    assert result == "Hello there"
    assert "".join(cb.chunks) == "Hello there"
