"""Unit tests for protocol-specific request construction in ModelClient.

We exercise the non-streaming path of `send_request` with `httpx.Client`
patched to capture the outbound (url, headers, json) and return a canned
response. This verifies that `format_compatibility` alone drives:

  - URL suffix       (/chat/completions vs /responses vs /v1/messages)
  - auth header      (Authorization Bearer vs x-api-key)
  - payload shape    (messages vs input+instructions vs messages+system)
  - response parsing (choices vs output_text vs content[].text)

No network, no DB: SystemSetting reads in send_request are wrapped in
try/except with defaults, so the absence of a DB is handled by the code
under test itself.
"""

from __future__ import annotations

import json

import pytest

from app.services.conversation.model_client import ModelClient


class _FakeResponse:
    def __init__(self, payload: dict, status_code: int = 200):
        self._payload = payload
        self.status_code = status_code
        self.text = json.dumps(payload)
        self.request = None

    def json(self):
        return self._payload

    def raise_for_status(self):
        return None


class _CapturingClient:
    """Stand-in for httpx.Client that records the outbound request."""

    captured: dict = {}

    def __init__(self, *args, **kwargs):
        pass

    def post(self, url, headers=None, json=None):
        type(self).captured = {"url": url, "headers": headers or {}, "json": json or {}}
        return _CapturingClient._response_factory()

    # set per-test
    _response_factory = staticmethod(lambda: _FakeResponse({"choices": [{"message": {"content": "ok"}}]}))


class _Cfg:
    def __init__(self, fmt, base_url="https://api.example.com/v1", api_key="sk-test"):
        self.base_url = base_url
        self.api_key = api_key
        self.model_id = "test-model"
        self.provider = "openai"
        self.format_compatibility = fmt
        self.custom_headers = {}
        self.custom_body = {}
        self.modalities = []
        self.max_output_tokens = 1000
        # These tests pin the one-shot POST payload/URL construction, so opt out
        # of the default wire-level streaming with a single-shot POST.
        self.additional_params = {"wire_stream": False}


@pytest.fixture
def patch_httpx(monkeypatch):
    import app.services.conversation.model_client as mc

    monkeypatch.setattr(mc.httpx, "Client", _CapturingClient)
    _CapturingClient.captured = {}
    return _CapturingClient


@pytest.fixture
def client():
    return ModelClient()


# ── openai-compatible (Chat Completions) ───────────────────────────────


def test_openai_compatible_url_and_auth(client, patch_httpx):
    patch_httpx._response_factory = staticmethod(
        lambda: _FakeResponse({"choices": [{"message": {"content": "hi"}}]})
    )
    out = client.send_request(
        _Cfg("openai-compatible"),
        [{"role": "system", "content": "S"}, {"role": "user", "content": "U"}],
        is_stream=False,
    )
    cap = patch_httpx.captured
    assert cap["url"].endswith("/chat/completions")
    assert cap["headers"]["Authorization"] == "Bearer sk-test"
    assert cap["json"]["messages"][0]["role"] == "system"  # system stays inline
    assert "input" not in cap["json"]
    assert out == "hi"


# ── openai (Responses API) ──────────────────────────────────────────────


def test_openai_responses_url_and_payload(client, patch_httpx):
    patch_httpx._response_factory = staticmethod(
        lambda: _FakeResponse({"output_text": "resp-ok"})
    )
    out = client.send_request(
        _Cfg("openai"),
        [{"role": "system", "content": "SYS"}, {"role": "user", "content": "U"}],
        is_stream=False,
        max_tokens=512,
    )
    cap = patch_httpx.captured
    assert cap["url"].endswith("/responses")
    assert cap["headers"]["Authorization"] == "Bearer sk-test"
    # system hoisted to instructions; remaining go to input
    assert cap["json"]["instructions"] == "SYS"
    assert cap["json"]["input"] == [{"role": "user", "content": "U"}]
    assert "messages" not in cap["json"]
    # max_tokens remapped to max_output_tokens
    assert cap["json"]["max_output_tokens"] == 512
    assert "max_tokens" not in cap["json"]
    assert out == "resp-ok"


def test_openai_responses_parses_output_array(client, patch_httpx):
    patch_httpx._response_factory = staticmethod(
        lambda: _FakeResponse(
            {
                "output": [
                    {
                        "type": "message",
                        "content": [{"type": "output_text", "text": "from-array"}],
                    }
                ]
            }
        )
    )
    out = client.send_request(
        _Cfg("openai"),
        [{"role": "user", "content": "U"}],
        is_stream=False,
    )
    assert out == "from-array"


def test_internal_control_kwargs_never_leak_into_payload(client, patch_httpx):
    """Repro: internal routing kwargs (send_target etc.) leaked into the request
    body, causing strict gateways to 400 with 'Extra inputs are not permitted'."""
    patch_httpx._response_factory = staticmethod(
        lambda: _FakeResponse({"choices": [{"message": {"content": "ok"}}]})
    )
    client.send_request(
        _Cfg("openai-compatible"),
        [{"role": "user", "content": "U"}],
        is_stream=False,
        send_target="task",
        isolation_mode=False,
        user_id=42,
        smart_dispatch=False,
        enable_subagent=True,
    )
    body = patch_httpx.captured["json"]
    for leaked in ("send_target", "isolation_mode", "user_id", "smart_dispatch", "enable_subagent"):
        assert leaked not in body, f"internal kwarg {leaked!r} must not reach the LLM request body"


def test_tool_followup_control_kwargs_never_leak_into_payload(client, patch_httpx):
    """Repro: on the tool-call follow-up round, stream_handler rebuilds kwargs
    from api_config, which carries wire-protocol / timeout / tool-call control
    keys. These must not be spread into the outbound request body."""
    patch_httpx._response_factory = staticmethod(
        lambda: _FakeResponse({"choices": [{"message": {"content": "ok"}}]})
    )
    client.send_request(
        _Cfg("openai-compatible"),
        [{"role": "user", "content": "U"}],
        is_stream=False,
        api_format="openai-compatible",
        stream_socket_timeout=120,
        tool_call_context_rounds=5,
        tool_call_correction=False,
        tool_call_correction_threshold=5,
    )
    body = patch_httpx.captured["json"]
    for leaked in (
        "api_format",
        "stream_socket_timeout",
        "tool_call_context_rounds",
        "tool_call_correction",
        "tool_call_correction_threshold",
    ):
        assert leaked not in body, f"internal kwarg {leaked!r} must not reach the LLM request body"


def test_timeout_kwarg_never_leaks_into_payload(client, patch_httpx):
    """Repro: summary_service passes timeout=... as a kwarg; the httpx timeout is
    built independently from SystemSetting, so the kwarg must not reach the body."""
    patch_httpx._response_factory = staticmethod(
        lambda: _FakeResponse({"choices": [{"message": {"content": "ok"}}]})
    )
    client.send_request(
        _Cfg("openai-compatible"),
        [{"role": "user", "content": "U"}],
        is_stream=False,
        timeout=300,
    )
    assert "timeout" not in patch_httpx.captured["json"]


# ── anthropic (Messages) ────────────────────────────────────────────────


def test_anthropic_url_auth_and_system(client, patch_httpx):
    patch_httpx._response_factory = staticmethod(
        lambda: _FakeResponse({"content": [{"type": "text", "text": "claude-ok"}]})
    )
    out = client.send_request(
        _Cfg("anthropic"),
        [{"role": "system", "content": "SYS"}, {"role": "user", "content": "U"}],
        is_stream=False,
    )
    cap = patch_httpx.captured
    assert cap["url"].endswith("/v1/messages")
    assert cap["headers"]["x-api-key"] == "sk-test"
    assert cap["headers"]["anthropic-version"] == "2023-06-01"
    assert "Authorization" not in cap["headers"]
    # system hoisted to top-level, removed from messages
    assert cap["json"]["system"] == "SYS"
    assert all(m["role"] != "system" for m in cap["json"]["messages"])
    assert out == "claude-ok"
