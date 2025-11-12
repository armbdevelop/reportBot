"""add_receipt_photo_path_to_shift_reports

Revision ID: bff9e021aa7e
Revises: cf675aab0ca0
Create Date: 2025-11-12 19:43:50.051274

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bff9e021aa7e'
down_revision: Union[str, None] = 'cf675aab0ca0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
