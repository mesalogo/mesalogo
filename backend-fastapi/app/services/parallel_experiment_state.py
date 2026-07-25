"""Pure state helpers for Parallel Lab orchestration."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

_COMPARISON_OPERATORS = (">=", "<=", "!=", "==", ">", "<")


def normalize_autonomous_status(status: str | None) -> str:
    """Map persisted autonomous-task states to Parallel Lab run states."""
    if status in {"active", "running"}:
        return "running"
    if status in {"completed", "failed", "stopped"}:
        return status
    return "pending"


def extract_condition_variable_names(
    conditions: Iterable[Mapping[str, Any]],
) -> set[str]:
    """Extract environment-variable operands from simple stop conditions."""
    names: set[str] = set()
    for condition in conditions:
        expression = str(condition.get("expression", "")).strip()
        operator = next(
            (candidate for candidate in _COMPARISON_OPERATORS if candidate in expression),
            None,
        )
        if operator is None:
            continue

        parts = expression.split(operator)
        if len(parts) != 2:
            continue

        for operand in parts:
            value = operand.strip()
            if not value:
                continue
            try:
                float(value)
            except ValueError:
                names.add(value)
    return names


def build_orchestration_runs(
    *,
    task_ids: Iterable[Any],
    status_by_task: Mapping[str, str],
    metrics_by_task: Mapping[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """Build the full run set used for scheduling and stop-condition checks."""
    return [
        {
            "action_task_id": task_id,
            "status": status_by_task.get(str(task_id), "pending"),
            "current_metrics": metrics_by_task.get(str(task_id), {}),
        }
        for task_id in task_ids
    ]


def should_update_orchestration(
    *,
    current_iteration: int,
    query_iteration: int,
) -> bool:
    """Return whether a status read may update the active experiment."""
    return current_iteration > 0 and query_iteration == current_iteration


def successful_task_ids(
    task_ids: Iterable[Any],
    status_by_task: Mapping[str, str],
) -> list[Any]:
    """Return only runs that reached the completed terminal state."""
    return [
        task_id
        for task_id in task_ids
        if status_by_task.get(str(task_id)) == "completed"
    ]


def derive_experiment_terminal_status(statuses: Iterable[str]) -> str:
    """Derive the experiment terminal state from persisted run outcomes."""
    run_statuses = list(statuses)
    if "completed" in run_statuses:
        return "completed"
    if "failed" in run_statuses:
        return "failed"
    if "stopped" in run_statuses:
        return "stopped"
    return "failed"
