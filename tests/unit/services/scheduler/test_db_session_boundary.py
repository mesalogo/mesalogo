import pytest

from app.services.scheduler.db_session_boundary import run_with_fresh_db_session


class FakeSession:
    def __init__(self):
        self.remove_calls = 0

    def remove(self):
        self.remove_calls += 1


def test_worker_starts_and_ends_with_a_fresh_database_session():
    session = FakeSession()

    result = run_with_fresh_db_session(lambda: "ok", session=session)

    assert result == "ok"
    assert session.remove_calls == 2


def test_worker_releases_database_session_when_callback_fails():
    session = FakeSession()

    with pytest.raises(RuntimeError, match="model failed"):
        run_with_fresh_db_session(
            lambda: (_ for _ in ()).throw(RuntimeError("model failed")),
            session=session,
        )

    assert session.remove_calls == 2
