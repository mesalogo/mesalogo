"""Tool-call follow-up context retention tests."""

from __future__ import annotations

from types import SimpleNamespace

from app.services.conversation import stream_handler
from app.services.conversation.stream_handler import limit_tool_call_history


def _assistant_tool_call(call_id: str) -> dict:
    return {
        "role": "assistant",
        "content": "",
        "tool_calls": [
            {
                "id": call_id,
                "type": "function",
                "function": {"name": "lookup", "arguments": "{}"},
            }
        ],
    }


def _tool_result(call_id: str) -> dict:
    return {"role": "tool", "tool_call_id": call_id, "content": f"result-{call_id}"}


def test_limit_tool_call_history_keeps_anchor_and_recent_rounds():
    messages = [
        {"role": "system", "content": "system"},
        {"role": "user", "content": "analyze files"},
        _assistant_tool_call("old-1"),
        _tool_result("old-1"),
        _assistant_tool_call("old-2"),
        _tool_result("old-2"),
        _assistant_tool_call("recent-1"),
        _tool_result("recent-1"),
        _assistant_tool_call("recent-2"),
        _tool_result("recent-2"),
    ]

    limited = limit_tool_call_history(messages, max_rounds=2)

    serialized = repr(limited)
    assert [message["role"] for message in limited[:2]] == ["system", "user"]
    assert "old-1" not in serialized
    assert "old-2" not in serialized
    assert "recent-1" in serialized
    assert "recent-2" in serialized


def test_tool_followup_applies_context_limit_before_second_request(monkeypatch):
    captured: dict = {}

    class _CapturingModelClient:
        def send_request(self, **kwargs):
            captured.update(kwargs)
            return "done"

    monkeypatch.setattr(stream_handler, "ModelClient", _CapturingModelClient)

    original_messages = [
        {"role": "system", "content": "system"},
        {"role": "user", "content": "analyze files"},
        _assistant_tool_call("old-1"),
        _tool_result("old-1"),
        _assistant_tool_call("recent-1"),
        _tool_result("recent-1"),
    ]
    current_call = {
        "id": "current",
        "type": "function",
        "function": {"name": "lookup", "arguments": "{}"},
    }
    api_config = {
        "api_format": "openai-compatible",
        "model_config": SimpleNamespace(
            base_url="https://example.test/v1",
            model_id="test-model",
        ),
        "agent_info": {},
        "tool_call_context_rounds": 1,
    }

    result = stream_handler.call_llm_with_tool_results(
        original_messages=original_messages,
        tool_calls=[current_call],
        tool_results=[{"tool_call_id": "current", "result": "current-result"}],
        api_config=api_config,
        callback=lambda _content: None,
    )

    serialized = repr(captured["messages"])
    assert result == "done"
    assert "old-1" not in serialized
    assert "recent-1" in serialized
    assert "current-result" in serialized
