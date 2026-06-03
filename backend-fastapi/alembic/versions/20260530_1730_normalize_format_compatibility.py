"""normalize model_configs.format_compatibility values

Revision ID: c9e1d4b2f067
Revises: b7d5f23a1c84
Create Date: 2026-05-30 17:30:00.000000

Background: the `format_compatibility` column previously stored
`openai` / `anthropic` / `custom`, where `openai` meant "OpenAI-compatible
Chat Completions" (the de-facto standard implemented by virtually every
third-party endpoint) and `custom` was an under-specified "manual parsing"
placeholder that the runtime never actually implemented.

The wire-protocol axis is being formalized into three values:

* `openai`            - OpenAI official **Responses API** (`/v1/responses`),
                        a NEW protocol with a different request/response shape.
* `openai-compatible` - Chat Completions (`/v1/chat/completions`), the
                        universal third-party-compatible protocol.
* `anthropic`         - Anthropic Messages API (`/v1/messages`).

Because every existing `openai` row was created under the OLD meaning
(= Chat Completions), promoting them to the new `openai` (= Responses API)
would silently break them. The safe migration therefore folds BOTH legacy
`openai` and legacy `custom` into `openai-compatible`. Choosing the official
Responses API is now an explicit, opt-in re-selection by the operator.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c9e1d4b2f067'
down_revision: Union[str, Sequence[str], None] = 'b7d5f23a1c84'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fold legacy openai/custom values into openai-compatible."""
    op.execute(
        "UPDATE model_configs "
        "SET format_compatibility = 'openai-compatible' "
        "WHERE format_compatibility IN ('openai', 'custom') "
        "OR format_compatibility IS NULL"
    )


def downgrade() -> None:
    """Best-effort reverse: openai-compatible -> openai.

    The original split between legacy `openai` and legacy `custom` cannot be
    recovered (the information was intentionally collapsed), so all
    `openai-compatible` rows revert to `openai`, matching the pre-migration
    de-facto meaning. `anthropic` rows are untouched.
    """
    op.execute(
        "UPDATE model_configs "
        "SET format_compatibility = 'openai' "
        "WHERE format_compatibility = 'openai-compatible'"
    )
