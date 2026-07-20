"""Pure pagination helpers for Parallel Lab run placeholders."""

from __future__ import annotations

from typing import Any, Optional


def build_queued_run_page(
    *,
    created_count: int,
    pending_combinations: list[dict[str, Any]],
    page: Optional[int],
    limit: Optional[int],
) -> tuple[list[dict[str, Any]], int]:
    """Return queued rows belonging to one combined created+queued page."""
    total = created_count + len(pending_combinations)

    if page is None:
        pending_start = 0
        pending_end = len(pending_combinations)
    else:
        page_limit = limit or 10
        page_start = max(0, page - 1) * page_limit
        page_end = page_start + page_limit
        pending_start = max(0, page_start - created_count)
        pending_end = min(
            len(pending_combinations),
            max(0, page_end - created_count),
        )

    rows = [
        {
            "run_number": created_count + pending_index + 1,
            "action_task_id": None,
            "status": "queued",
            "parameters": pending_combinations[pending_index],
            "current_metrics": {},
        }
        for pending_index in range(pending_start, pending_end)
    ]
    return rows, total
