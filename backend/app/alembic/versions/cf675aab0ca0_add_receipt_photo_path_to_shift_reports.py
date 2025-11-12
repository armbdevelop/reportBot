"""add_receipt_photo_path_to_shift_reports

Revision ID: cf675aab0ca0
Revises: ea775d7b8f95
Create Date: 2025-11-12 19:16:49.927347

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cf675aab0ca0'
down_revision: Union[str, None] = 'ea775d7b8f95'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
