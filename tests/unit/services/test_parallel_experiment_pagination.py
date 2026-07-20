"""Unit coverage for queued-run pagination in Parallel Lab."""

from app.services.parallel_experiment_pagination import build_queued_run_page


def test_queued_rows_fill_only_the_remaining_slots_on_each_page():
    pending = [
        {"temperature": 0.1},
        {"temperature": 0.2},
        {"temperature": 0.3},
        {"temperature": 0.4},
        {"temperature": 0.5},
    ]

    first_page, total = build_queued_run_page(
        created_count=3,
        pending_combinations=pending,
        page=1,
        limit=4,
    )
    second_page, second_total = build_queued_run_page(
        created_count=3,
        pending_combinations=pending,
        page=2,
        limit=4,
    )

    assert total == second_total == 8
    assert [row["run_number"] for row in first_page] == [4]
    assert [row["run_number"] for row in second_page] == [5, 6, 7, 8]
    assert second_page[-1]["parameters"] == {"temperature": 0.5}


def test_unpaginated_status_contains_every_queued_run():
    rows, total = build_queued_run_page(
        created_count=2,
        pending_combinations=[{"seed": 1}, {"seed": 2}],
        page=None,
        limit=None,
    )

    assert total == 4
    assert [row["run_number"] for row in rows] == [3, 4]
