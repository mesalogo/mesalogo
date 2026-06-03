"""Unit tests for the wire-protocol (api_format) resolution axis.

Covers ModelClient._resolve_api_format, which maps the stored
`format_compatibility` value onto exactly one of three protocols:

  - openai             -> OpenAI Responses API (/v1/responses)
  - openai-compatible  -> Chat Completions (/v1/chat/completions)  [default]
  - anthropic          -> Anthropic Messages (/v1/messages)

Legacy values (`custom`, empty, None, unknown) fold to `openai-compatible`.

Iron rules (tests/AGENTS.md): one assertion-theme per test, no I/O.
"""

from __future__ import annotations

import logging

import pytest

from app.services.conversation.model_client import ModelClient


class _Cfg:
    def __init__(self, format_compatibility=None):
        self.format_compatibility = format_compatibility


@pytest.fixture
def client():
    return ModelClient()


def test_openai_maps_to_responses_protocol(client):
    assert client._resolve_api_format(_Cfg("openai")) == "openai"


def test_openai_compatible_passes_through(client):
    assert client._resolve_api_format(_Cfg("openai-compatible")) == "openai-compatible"


def test_anthropic_passes_through(client):
    assert client._resolve_api_format(_Cfg("anthropic")) == "anthropic"


def test_legacy_custom_folds_to_openai_compatible(client):
    assert client._resolve_api_format(_Cfg("custom")) == "openai-compatible"


def test_none_value_defaults_to_openai_compatible(client):
    assert client._resolve_api_format(_Cfg(None)) == "openai-compatible"


def test_empty_string_defaults_to_openai_compatible(client):
    assert client._resolve_api_format(_Cfg("")) == "openai-compatible"


def test_missing_attribute_defaults_to_openai_compatible(client):
    assert client._resolve_api_format(object()) == "openai-compatible"


def test_explicit_override_wins_over_config(client):
    assert client._resolve_api_format(_Cfg("anthropic"), override="openai") == "openai"


def test_unknown_value_warns_and_folds(client, caplog):
    with caplog.at_level(logging.WARNING):
        out = client._resolve_api_format(_Cfg("gemini-native"))
    assert out == "openai-compatible"
    assert any("format_compatibility" in rec.message for rec in caplog.records)
