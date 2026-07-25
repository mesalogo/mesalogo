"""Database-session ownership boundary for scheduler worker threads."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any


def run_with_fresh_db_session(
    callback: Callable[[], Any],
    *,
    session: Any = None,
) -> Any:
    """Run one worker callback without inheriting a stale scoped session."""
    if session is None:
        from app import db

        session = db.session

    session.remove()
    try:
        return callback()
    finally:
        session.remove()
