"""baseline

Revision ID: fedea876a659
Revises:
Create Date: 2026-05-18 17:53:32.356640

This is the project's first Alembic revision.

When this project adopted Alembic (2026-05-18), the schema already
existed (it had been built by repeated `Base.metadata.create_all()`
calls on startup). Running `alembic revision --autogenerate` against
that schema therefore produced an empty diff — there were no ALTERs to
emit, because the live DB already matched `models.py`.

But "empty diff" is wrong for a *baseline* revision: a fresh empty
database needs the baseline to actually create the tables. Otherwise
`alembic upgrade head` on a virgin DB happily emits "applied baseline"
and the next revision (which assumes the schema exists) immediately
crashes.

So we hand-write the baseline as a single `metadata.create_all()` call
against the live engine bound by Alembic. This is the canonical Alembic
recipe for adopting an existing schema; see
https://alembic.sqlalchemy.org/en/latest/cookbook.html#building-an-up-to-date-database-from-scratch.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'fedea876a659'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _models_metadata():
    """Import every ORM model so SQLAlchemy metadata is complete, then
    return the shared metadata object used by `app.extensions.db.Model`.
    """
    # Side-effect import: registers every Table on the metadata.
    import app.models  # noqa: F401
    from app.extensions import db
    return db.Model.metadata


def upgrade() -> None:
    """Create the full schema as it stood at adoption time."""
    metadata = _models_metadata()
    bind = op.get_bind()
    metadata.create_all(bind=bind)


def downgrade() -> None:
    """Drop everything. Only ever runs on a totally throwaway DB."""
    metadata = _models_metadata()
    bind = op.get_bind()
    metadata.drop_all(bind=bind)
