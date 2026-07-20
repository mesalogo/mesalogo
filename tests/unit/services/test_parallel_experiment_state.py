"""Unit coverage for full-run state used by Parallel Lab orchestration."""

from app.services.parallel_experiment_state import (
    build_orchestration_runs,
    extract_condition_variable_names,
    normalize_autonomous_status,
    should_update_orchestration,
)


def test_orchestration_runs_include_tasks_outside_the_visible_page():
    task_ids = [f"task-{index}" for index in range(12)]
    statuses = {task_id: "completed" for task_id in task_ids}
    metrics = {"task-11": {"score": 0.99}}

    runs = build_orchestration_runs(
        task_ids=task_ids,
        status_by_task=statuses,
        metrics_by_task=metrics,
    )

    assert len(runs) == 12
    assert runs[-1] == {
        "action_task_id": "task-11",
        "status": "completed",
        "current_metrics": {"score": 0.99},
    }


def test_orchestration_runs_default_missing_status_and_metrics():
    runs = build_orchestration_runs(
        task_ids=["task-1"],
        status_by_task={},
        metrics_by_task={},
    )

    assert runs == [
        {
            "action_task_id": "task-1",
            "status": "pending",
            "current_metrics": {},
        }
    ]


def test_only_current_iteration_may_mutate_orchestration():
    assert should_update_orchestration(current_iteration=3, query_iteration=3)
    assert not should_update_orchestration(current_iteration=3, query_iteration=2)
    assert not should_update_orchestration(current_iteration=0, query_iteration=0)


def test_stop_condition_variables_include_both_non_numeric_operands():
    names = extract_condition_variable_names(
        [
            {"expression": "score >= 0.9"},
            {"expression": "cost < budget"},
            {"expression": ""},
        ]
    )

    assert names == {"score", "cost", "budget"}


def test_running_and_active_autonomous_statuses_are_both_running():
    assert normalize_autonomous_status("active") == "running"
    assert normalize_autonomous_status("running") == "running"
