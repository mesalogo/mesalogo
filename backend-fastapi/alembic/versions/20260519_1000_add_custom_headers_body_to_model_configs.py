"""add custom_headers and custom_body to model_configs

Revision ID: b7d5f23a1c84
Revises: a51a7c66578c
Create Date: 2026-05-19 10:00:00.000000

Background: see docs/agents/model-config-custom-params.md.

Splits the previously-overloaded `model_configs.additional_params` (a single
JSON dict that mixed upstream-request payload fields with local-only
constructor / SDK / env parameters) into three semantically distinct fields:

* custom_headers   - merged into the outbound HTTP headers when calling the
                     upstream model API (e.g. Azure `api-key`, OpenRouter
                     `HTTP-Referer` / `X-Title`).
* custom_body      - merged into the outbound HTTP request body / SDK kwargs
                     (e.g. `reasoning_effort`, vendor-specific `top_k`).
* additional_params - retained as-is; from this migration onward it is
                      reserved for local-process-only parameters
                      (reranker `use_fp16` / `batch_size`, embedding
                      `dimensions`, LightRAG `embedding_dim`, ...).

This migration:
* Adds the two new JSON columns with a non-null default of empty object so
  that existing rows are immediately readable without backfill.
* Does NOT migrate any keys out of `additional_params`. Existing rows that
  happen to have e.g. `reasoning_effort` in `additional_params` will keep
  working through the legacy code paths until callers are switched over to
  `custom_body`; new writes go to `custom_body` directly.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d5f23a1c84'
down_revision: Union[str, Sequence[str], None] = 'a51a7c66578c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add custom_headers / custom_body JSON columns to model_configs."""
    op.add_column(
        'model_configs',
        sa.Column(
            'custom_headers',
            sa.JSON(),
            nullable=False,
            server_default=sa.text("('{}')"),
        ),
    )
    op.add_column(
        'model_configs',
        sa.Column(
            'custom_body',
            sa.JSON(),
            nullable=False,
            server_default=sa.text("('{}')"),
        ),
    )


def downgrade() -> None:
    """Drop custom_headers / custom_body columns from model_configs."""
    op.drop_column('model_configs', 'custom_body')
    op.drop_column('model_configs', 'custom_headers')
