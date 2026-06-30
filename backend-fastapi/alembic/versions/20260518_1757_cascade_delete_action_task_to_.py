"""cascade delete action_task to conversations

Revision ID: a51a7c66578c
Revises: fedea876a659
Create Date: 2026-05-18 17:57:49.659806

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a51a7c66578c'
down_revision: Union[str, Sequence[str], None] = 'fedea876a659'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _conversations_action_task_fk(bind):
    """返回 conversations.action_task_id 上现有外键的 (约束名, 是否已 CASCADE)。

    不能硬编码约束名：基线建表时 MySQL/MariaDB 给该 FK 自动生成的名字并非
    固定的 `conversations_ibfk_1`（实测可能是 `1` 等），硬编码会导致
    `Can't DROP FOREIGN KEY` (1091)。这里按列动态查出真实约束名。
    """
    rows = bind.execute(sa.text(
        """
        SELECT rc.CONSTRAINT_NAME, rc.DELETE_RULE
        FROM information_schema.REFERENTIAL_CONSTRAINTS rc
        JOIN information_schema.KEY_COLUMN_USAGE kcu
          ON kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
         AND kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
          AND rc.TABLE_NAME = 'conversations'
          AND kcu.COLUMN_NAME = 'action_task_id'
        """
    )).fetchall()
    if not rows:
        return None, False
    name, rule = rows[0]
    return name, (str(rule).upper() == 'CASCADE')


def upgrade() -> None:
    """Add ON DELETE CASCADE to conversations.action_task_id.

    Background: see docs/agents/failures/2026-05-18-action-task-delete-cascade-default.md.
    The original FK had no ondelete rule, so SQLAlchemy's default cascade
    behaviour tried to NULL the child FK on parent delete and collided
    with the NOT NULL constraint (MariaDB 1048).

    幂等：动态解析真实外键名再替换；若已是 CASCADE 则跳过（兼容此前因进程
    中断遗留的半完成状态）。
    """
    bind = op.get_bind()
    if bind.dialect.name != 'mysql':
        # SQLite 等不支持 ALTER 外键，跳过（其 cascade 由 ORM 层处理）。
        return

    existing_name, already_cascade = _conversations_action_task_fk(bind)
    if already_cascade:
        return

    if existing_name is not None:
        op.drop_constraint(existing_name, 'conversations', type_='foreignkey')
    op.create_foreign_key(
        'conversations_action_task_id_fkey',
        'conversations',
        'action_tasks',
        ['action_task_id'],
        ['id'],
        ondelete='CASCADE',
    )


def downgrade() -> None:
    """Revert to the original FK without ON DELETE rule."""
    bind = op.get_bind()
    if bind.dialect.name != 'mysql':
        return
    existing_name, _ = _conversations_action_task_fk(bind)
    if existing_name is not None:
        op.drop_constraint(existing_name, 'conversations', type_='foreignkey')
    op.create_foreign_key(
        'conversations_action_task_id_fkey',
        'conversations',
        'action_tasks',
        ['action_task_id'],
        ['id'],
    )
