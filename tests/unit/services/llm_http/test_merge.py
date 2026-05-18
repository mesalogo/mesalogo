"""Unit tests for app.services.llm_http merge helpers.

These cover the three-bag custom-params contract (see
docs/agents/model-config-custom-params.md): we verify *only* the merge
semantics in isolation; integration with ModelClient.send_request and the
embedding HTTP path lives in tests/integration/.

Iron rules from tests/AGENTS.md:
  - one test function tests one thing
  - no network / DB / Redis from this layer
  - fail-loud on bad input (TypeError), no silent fallback
"""

from __future__ import annotations

import logging

import pytest

from app.services.llm_http import merge_custom_headers, merge_custom_body


# ── headers ────────────────────────────────────────────────────────────


def test_merge_custom_headers_returns_base_copy_when_custom_is_none():
    base = {"Authorization": "Bearer base"}
    out = merge_custom_headers(base, None)
    assert out == base
    assert out is not base  # shallow copy, not aliased


def test_merge_custom_headers_returns_base_copy_when_custom_is_empty():
    base = {"Authorization": "Bearer base"}
    assert merge_custom_headers(base, {}) == base


def test_merge_custom_headers_appends_unknown_keys():
    out = merge_custom_headers(
        {"Authorization": "Bearer base"},
        {"HTTP-Referer": "https://example.com", "X-Title": "MyApp"},
    )
    assert out == {
        "Authorization": "Bearer base",
        "HTTP-Referer": "https://example.com",
        "X-Title": "MyApp",
    }


def test_merge_custom_headers_lets_user_override_authorization():
    # This is intentional: Azure / Kong style auth schemes need to replace
    # the platform's Bearer header.
    out = merge_custom_headers(
        {"Authorization": "Bearer base"},
        {"Authorization": "Bearer overridden"},
    )
    assert out == {"Authorization": "Bearer overridden"}


def test_merge_custom_headers_drops_content_type_override(caplog):
    base = {"Content-Type": "application/json", "Authorization": "Bearer base"}
    with caplog.at_level(logging.WARNING):
        out = merge_custom_headers(base, {"Content-Type": "text/plain"})
    assert out["Content-Type"] == "application/json"
    assert any("Content-Type" in rec.message for rec in caplog.records)


def test_merge_custom_headers_content_type_check_is_case_insensitive(caplog):
    with caplog.at_level(logging.WARNING):
        out = merge_custom_headers(
            {"Content-Type": "application/json"},
            {"content-type": "x/y"},
        )
    assert out == {"Content-Type": "application/json"}


def test_merge_custom_headers_raises_on_non_dict():
    # Fail-loud per backend AGENTS.md §4 "no silent fallbacks".
    with pytest.raises(TypeError):
        merge_custom_headers({}, "not a dict")


def test_merge_custom_headers_raises_on_non_string_key():
    with pytest.raises(TypeError):
        merge_custom_headers({}, {123: "x"})


def test_merge_custom_headers_stringifies_non_string_value():
    out = merge_custom_headers({}, {"X-Count": 42})
    assert out == {"X-Count": "42"}


# ── body ───────────────────────────────────────────────────────────────


def test_merge_custom_body_returns_base_copy_when_custom_is_none():
    base = {"model": "m", "messages": []}
    out = merge_custom_body(base, None)
    assert out == base
    assert out is not base


def test_merge_custom_body_custom_overrides_base():
    out = merge_custom_body(
        {"model": "m", "temperature": 0.7},
        {"temperature": 0.3, "top_k": 40},
    )
    assert out == {"model": "m", "temperature": 0.3, "top_k": 40}


def test_merge_custom_body_raises_on_non_dict():
    with pytest.raises(TypeError):
        merge_custom_body({}, ["not", "a", "dict"])


def test_merge_custom_body_warns_when_chat_keys_used_on_embedding_model(caplog):
    with caplog.at_level(logging.WARNING):
        out = merge_custom_body(
            {"model": "m", "input": "x"},
            {"temperature": 0.5},
            modalities=["vector_output"],
        )
    # Soft hint: passes through, but warns
    assert out["temperature"] == 0.5
    assert any("different model type" in rec.message for rec in caplog.records)


def test_merge_custom_body_warns_when_embedding_keys_used_on_chat_model(caplog):
    with caplog.at_level(logging.WARNING):
        out = merge_custom_body(
            {"model": "m", "messages": []},
            {"input": "x"},
            modalities=["text_output"],
        )
    assert out["input"] == "x"
    assert any("different model type" in rec.message for rec in caplog.records)


def test_merge_custom_body_no_warning_when_modalities_unknown(caplog):
    with caplog.at_level(logging.WARNING):
        merge_custom_body(
            {"model": "m"},
            {"temperature": 0.5},
            modalities=None,
        )
    assert not any("different model type" in rec.message for rec in caplog.records)


def test_merge_custom_body_no_warning_when_keys_are_neutral(caplog):
    with caplog.at_level(logging.WARNING):
        merge_custom_body(
            {"model": "m"},
            {"some_vendor_field": "ok"},
            modalities=["text_output"],
        )
    assert not any("different model type" in rec.message for rec in caplog.records)


def test_merge_custom_body_rerank_classification_wins_over_others(caplog):
    # A model declaring both rerank_output and text_output is rare but
    # treat rerank as the most specific classifier.
    with caplog.at_level(logging.WARNING):
        merge_custom_body(
            {"model": "m"},
            {"messages": []},  # chat hint
            modalities=["rerank_output", "text_output"],
        )
    # messages is a chat hint, so on a rerank-classified model it must warn
    assert any("different model type" in rec.message for rec in caplog.records)
