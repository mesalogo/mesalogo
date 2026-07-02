"""Unit tests for the wire-level streaming fallback on the non-streaming path.

Repro Bug: gateway models that ONLY support streaming (e.g. minimax-m3,
deepseek-v4-pro on some gateways) return HTTP 400 to any one-shot POST. Internal
callers (smart dispatch, supervisor, summary, subagent) invoke
`send_request(is_stream=False)`, so they all broke against such models.

Fix: the non-streaming path keeps its synchronous "return full text" contract
but issues the wire request with stream=true and aggregates the deltas. A model
may opt out with additional_params={"wire_stream": False} to force a one-shot POST.

These tests patch httpx.Client with a fake that yields canned SSE lines; no
network, no DB (SystemSetting reads are wrapped in try/except with defaults).
"""

from __future__ import annotations

import json

import httpx
import pytest

from app.services.conversation.model_client import ModelClient


class _FakeStreamCtx:
    def __init__(self, lines, status_code=200, body=""):
        self._lines = lines
        self.status_code = status_code
        self._body = body
        self.request = None

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def iter_lines(self):
        yield from self._lines

    def read(self):
        return self._body.encode("utf-8")


class _FakeStreamClient:
    """Stand-in for httpx.Client capturing the outbound stream() payload."""

    captured: dict = {}
    lines: list = []
    status_code: int = 200
    body: str = ""

    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def stream(self, method, url, headers=None, json=None):
        type(self).captured = {"method": method, "url": url, "headers": headers or {}, "json": json or {}}
        return _FakeStreamCtx(type(self).lines, type(self).status_code, type(self).body)


class _Cfg:
    def __init__(self, fmt="openai-compatible", additional_params=None):
        self.base_url = "https://api.example.com/v1"
        self.api_key = "sk-test"
        self.model_id = "test-model"
        self.provider = "custom"
        self.format_compatibility = fmt
        self.custom_headers = {}
        self.custom_body = {}
        self.modalities = []
        self.max_output_tokens = 1000
        self.additional_params = additional_params


def _sse(obj) -> str:
    return f"data: {json.dumps(obj)}"


@pytest.fixture
def patch_stream(monkeypatch):
    import app.services.conversation.model_client as mc

    monkeypatch.setattr(mc.httpx, "Client", _FakeStreamClient)
    _FakeStreamClient.captured = {}
    _FakeStreamClient.lines = []
    _FakeStreamClient.status_code = 200
    _FakeStreamClient.body = ""
    return _FakeStreamClient


@pytest.fixture
def client():
    return ModelClient()


def test_nonstream_defaults_to_wire_stream_and_aggregates(client, patch_stream):
    patch_stream.lines = [
        _sse({"choices": [{"delta": {"role": "assistant"}}]}),
        _sse({"choices": [{"delta": {"content": "HELLO"}}]}),
        _sse({"choices": [{"delta": {"content": " WORLD"}}]}),
        "data: [DONE]",
    ]
    out = client.send_request(
        _Cfg(),
        [{"role": "user", "content": "hi"}],
        is_stream=False,
    )
    # wire request must be streaming even though caller asked is_stream=False
    assert patch_stream.captured["json"]["stream"] is True
    assert patch_stream.captured["method"] == "POST"
    assert out == "HELLO WORLD"


def test_reasoning_content_wrapped_in_thinking_tags(client, patch_stream):
    patch_stream.lines = [
        _sse({"choices": [{"delta": {"reasoning_content": "let me think"}}]}),
        _sse({"choices": [{"delta": {"content": "ANSWER"}}]}),
        "data: [DONE]",
    ]
    out = client.send_request(
        _Cfg(),
        [{"role": "user", "content": "hi"}],
        is_stream=False,
    )
    assert out == "<thinking>\nlet me think\n</thinking>\nANSWER"


def test_reasoning_only_gets_closing_tag(client, patch_stream):
    patch_stream.lines = [
        _sse({"choices": [{"delta": {"reasoning_content": "thinking"}}]}),
        "data: [DONE]",
    ]
    out = client.send_request(
        _Cfg(),
        [{"role": "user", "content": "hi"}],
        is_stream=False,
    )
    assert out == "<thinking>\nthinking\n</thinking>"


def test_wire_stream_non_200_raises_and_returns_error(client, patch_stream):
    # Reproduces the gateway 400: aggregation path must surface the body, and
    # send_request's error handler converts it to an "Error: ..." string.
    patch_stream.status_code = 400
    patch_stream.body = json.dumps(
        {"error": {"message": "stream_options is only valid when stream=true."}}
    )
    patch_stream.lines = []
    out = client.send_request(
        _Cfg(),
        [{"role": "user", "content": "hi"}],
        is_stream=False,
    )
    assert isinstance(out, str)
    assert out.startswith("Error:")


def test_wire_stream_false_opts_out_to_one_shot_post(client, monkeypatch):
    # additional_params.wire_stream=False must force the legacy one-shot POST.
    import app.services.conversation.model_client as mc

    captured = {}

    class _PostResp:
        def __init__(self):
            self.status_code = 200
            self.text = "{}"
            self.request = None

        def json(self):
            return {"choices": [{"message": {"content": "one-shot"}}]}

        def raise_for_status(self):
            return None

    class _PostClient:
        def __init__(self, *a, **k):
            pass

        def post(self, url, headers=None, json=None):
            captured["json"] = json or {}
            return _PostResp()

        def stream(self, *a, **k):
            raise AssertionError("stream() must not be called when wire_stream=False")

    monkeypatch.setattr(mc.httpx, "Client", _PostClient)
    out = client.send_request(
        _Cfg(additional_params={"wire_stream": False}),
        [{"role": "user", "content": "hi"}],
        is_stream=False,
    )
    assert out == "one-shot"
    assert captured["json"]["stream"] is False
