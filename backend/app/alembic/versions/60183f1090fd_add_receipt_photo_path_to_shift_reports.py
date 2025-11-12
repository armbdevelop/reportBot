"""add_receipt_photo_path_to_shift_reports

Revision ID: 60183f1090fd
Revises: 41383f19dc55
Create Date: 2025-11-12 19:15:35.182331

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '60183f1090fd'
down_revision: Union[str, None] = '41383f19dc55'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
