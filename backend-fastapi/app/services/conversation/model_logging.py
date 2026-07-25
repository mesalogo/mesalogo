"""Safe, allowlisted model settings for diagnostic logs."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

_LOGGABLE_MODEL_FIELDS = (
    "model_id",
    "provider",
    "platform",
    "temperature",
    "max_tokens",
    "top_p",
    "frequency_penalty",
    "presence_penalty",
)


def safe_model_settings(settings: Mapping[str, Any]) -> dict[str, Any]:
    """Return non-sensitive model metadata suitable for structured logging."""
    return {
        field: settings[field]
        for field in _LOGGABLE_MODEL_FIELDS
        if field in settings
    }
