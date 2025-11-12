"""add_receipt_photo_path_to_shift_reports

Revision ID: ea775d7b8f95
Revises: 60183f1090fd
Create Date: 2025-11-12 19:15:50.818211

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ea775d7b8f95'
down_revision: Union[str, None] = '60183f1090fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
