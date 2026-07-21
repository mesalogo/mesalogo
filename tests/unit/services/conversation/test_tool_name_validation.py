"""Regression tests for strict tool-name validation."""

from __future__ import annotations

import json
from types import SimpleNamespace

from app.services.conversation import stream_handler, tool_call_executor


class _FakeStreamResponse:
    status_code = 200

    def __init__(self, lines: list[str]):
        self._lines = lines

    def iter_lines(self):
        yield from self._lines


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}"


def test_nameless_tool_call_error_is_returned_to_llm_without_execution(monkeypatch):
    executed_calls = []
    follow_up_request = {}
    emitted_content = []

    def fake_execute(tool_call, _callback):
        executed_calls.append(tool_call)
        return {
            "result": "{}",
            "tool_name": tool_call["function"]["name"],
            "tool_call_id": tool_call["id"],
        }

    monkeypatch.setattr(
        stream_handler,
        "execute_and_format_tool_call",
        fake_execute,
    )

    class _CapturingModelClient:
        def send_request(self, **kwargs):
            follow_up_request.update(kwargs)
            return "recovered response"

    monkeypatch.setattr(stream_handler, "ModelClient", _CapturingModelClient)

    lines = [
        _sse(
            {
                "choices": [
                    {
                        "delta": {
                            "tool_calls": [
                                {
                                    "index": 0,
                                    "id": "call-1",
                                    "type": "function",
                                    "function": {
                                        "arguments": json.dumps(
                                            {"task_id": "task-123"}
                                        )
                                    },
                                }
                            ]
                        }
                    }
                ]
            }
        ),
        _sse({"choices": [{"delta": {}, "finish_reason": "tool_calls"}]}),
        "data: [DONE]",
    ]
    api_config = {
        "api_format": "openai-compatible",
        "model_config": SimpleNamespace(
            base_url="https://example.test/v1",
            model_id="test-model",
        ),
        "agent_info": {
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "list_task_vars",
                        "parameters": {
                            "type": "object",
                            "properties": {"task_id": {"type": "string"}},
                            "required": ["task_id"],
                        },
                    },
                }
            ]
        },
    }

    result = stream_handler.handle_streaming_response(
        _FakeStreamResponse(lines),
        lambda content, _meta=None: emitted_content.append(content),
        original_messages=[{"role": "user", "content": "List task variables"}],
        api_config=api_config,
    )

    assert executed_calls == []
    assert result.strip() == "recovered response"
    assert follow_up_request["messages"][-1]["role"] == "user"
    assert "function.name is missing" in follow_up_request["messages"][-1]["content"]
    assert "No tool was executed" in follow_up_request["messages"][-1]["content"]
    assert not any(
        content and "Tool error" in content
        for content in emitted_content
    )


def test_streamed_tool_identity_is_not_overwritten_by_null_deltas(monkeypatch):
    executed_calls = []
    emitted_content = []

    def fake_execute(tool_call):
        executed_calls.append(tool_call)
        return json.dumps({"variables": []})

    monkeypatch.setattr(tool_call_executor, "execute_tool_call", fake_execute)

    lines = [
        _sse(
            {
                "choices": [
                    {
                        "delta": {
                            "tool_calls": [
                                {
                                    "index": 0,
                                    "id": "call-1",
                                    "type": "function",
                                    "function": {
                                        "name": "list_task_vars",
                                        "arguments": "",
                                    },
                                }
                            ]
                        }
                    }
                ]
            }
        ),
        _sse(
            {
                "choices": [
                    {
                        "delta": {
                            "tool_calls": [
                                {
                                    "index": 0,
                                    "id": None,
                                    "type": "function",
                                    "function": {
                                        "name": None,
                                        "arguments": json.dumps(
                                            {"task_id": "task-123"}
                                        ),
                                    },
                                }
                            ]
                        }
                    }
                ]
            }
        ),
        _sse({"choices": [{"delta": {}, "finish_reason": "tool_calls"}]}),
        "data: [DONE]",
    ]

    stream_handler.handle_streaming_response(
        _FakeStreamResponse(lines),
        lambda content, _meta=None: emitted_content.append(content),
        api_config={"api_format": "openai-compatible"},
    )

    assert len(executed_calls) == 1
    assert executed_calls[0]["id"] == "call-1"
    assert executed_calls[0]["function"]["name"] == "list_task_vars"
    assert any(
        content and '"ToolCallAction"' in content and "list_task_vars" in content
        for content in emitted_content
    )
