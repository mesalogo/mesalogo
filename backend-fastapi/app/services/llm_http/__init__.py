"""HTTP merge helpers for outbound calls to upstream model APIs.

This module hosts the *single* pair of helpers that merge a
``ModelConfig.custom_headers`` / ``ModelConfig.custom_body`` value into the
HTTP request that we are about to send to an upstream LLM / embedding /
rerank service.

Design notes:

* There is no separate "client factory" class. The two existing outbound
  sites are ``app.services.conversation.model_client.ModelClient`` (chat
  completion) and ``app.services.vector_db_tidb.embedding_service`` (raw
  ``requests.post`` to ``/embeddings``). Both call into these helpers
  rather than reimplementing the merge logic.

* The semantics of merging are identical regardless of model type
  (``base ∪ custom``, custom keys win). We do **not** introduce a separate
  ``model_kind`` argument — the call site's existing ``modalities`` field
  on ``ModelConfig`` is the authoritative classifier. When the caller
  passes the model's ``modalities`` list, this module emits a
  ``logger.warning`` for body keys that look mismatched (e.g. ``messages``
  in an embedding-only model's body). This is a soft hint, not a hard
  validation, because vendor extensions are too varied to whitelist.

* On any non-dict input we ``raise TypeError`` (see backend AGENTS.md §4
  "No silent fallbacks"). Empty / ``None`` ``custom`` is a no-op and
  returns a shallow copy of ``base``.

* ``Content-Type`` cannot be overridden by ``custom_headers`` — attempting
  to do so logs a warning and the entry is dropped. Other headers
  (including ``Authorization``) *can* be overridden, which is the whole
  point of letting users plug their own auth schemes (Azure ``api-key``
  etc.) onto a generic openai-compatible base URL.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Iterable, Optional

logger = logging.getLogger(__name__)


# Headers that the platform is responsible for and the user must not be
# able to override (lowercase compare).
_PROTECTED_HEADERS = frozenset({'content-type'})


# Conventional body-field families per modality, used only to drive the
# "this key looks out of place" warning. Not a whitelist.
_CHAT_BODY_HINTS = frozenset({
    'messages', 'temperature', 'top_p', 'frequency_penalty',
    'presence_penalty', 'tools', 'tool_choice', 'reasoning_effort',
    'response_format', 'logit_bias',
})
_EMBEDDING_BODY_HINTS = frozenset({
    'input', 'dimensions', 'encoding_format',
})
_RERANK_BODY_HINTS = frozenset({
    'query', 'documents', 'top_n', 'return_documents',
})


def merge_custom_headers(
    base: Dict[str, str],
    custom: Optional[Dict[str, Any]],
) -> Dict[str, str]:
    """Return ``base`` merged with ``custom`` for HTTP request headers.

    Raises ``TypeError`` if ``custom`` is not ``None`` and not a ``dict``.
    Protected headers (e.g. ``Content-Type``) cannot be overridden and are
    dropped with a warning.
    """
    merged: Dict[str, str] = dict(base)
    if not custom:
        return merged
    if not isinstance(custom, dict):
        raise TypeError(
            f"custom_headers must be a dict, got {type(custom).__name__}"
        )

    for key, value in custom.items():
        if not isinstance(key, str):
            raise TypeError(
                f"custom_headers keys must be str, got {type(key).__name__}"
            )
        if key.lower() in _PROTECTED_HEADERS:
            logger.warning(
                "[llm_http] dropping protected custom header %r "
                "(cannot override platform-managed Content-Type)",
                key,
            )
            continue
        merged[key] = value if isinstance(value, str) else str(value)
    return merged


def _modality_hint_set(modalities: Optional[Iterable[str]]) -> frozenset:
    """Pick the body-hint set most relevant for a model's modalities.

    Priority: rerank > embedding > chat, since a model that does rerank
    is typically rerank-only.
    """
    if not modalities:
        return frozenset()
    mod = set(modalities)
    if 'rerank_output' in mod:
        return _RERANK_BODY_HINTS
    if 'vector_output' in mod:
        return _EMBEDDING_BODY_HINTS
    if 'text_output' in mod:
        return _CHAT_BODY_HINTS
    return frozenset()


def merge_custom_body(
    base: Dict[str, Any],
    custom: Optional[Dict[str, Any]],
    modalities: Optional[Iterable[str]] = None,
) -> Dict[str, Any]:
    """Return ``base`` merged with ``custom`` for an HTTP request body.

    ``modalities`` is optional and only used to warn about body keys that
    look mismatched for the model's declared modality (e.g. ``messages``
    being supplied for a ``vector_output``-only model). The warning is a
    soft hint — we still pass the user-supplied keys through unchanged.
    """
    merged: Dict[str, Any] = dict(base)
    if not custom:
        return merged
    if not isinstance(custom, dict):
        raise TypeError(
            f"custom_body must be a dict, got {type(custom).__name__}"
        )

    expected = _modality_hint_set(modalities)
    if expected:
        # Build the "other family" set so we can warn on obvious mismatches.
        other_families = (
            (_CHAT_BODY_HINTS | _EMBEDDING_BODY_HINTS | _RERANK_BODY_HINTS)
            - expected
        )
        wrong_keys = sorted(set(custom.keys()) & other_families)
        if wrong_keys:
            logger.warning(
                "[llm_http] custom_body for modalities=%s contains keys "
                "typical of a different model type: %s "
                "(passing through; verify upstream API contract)",
                list(modalities) if modalities else None,
                wrong_keys,
            )

    merged.update(custom)
    return merged


__all__ = [
    'merge_custom_headers',
    'merge_custom_body',
]
