"""add_receipt_photo_path_to_shift_reports

Revision ID: f4763f825583
Revises: bff9e021aa7e
Create Date: 2025-11-12 19:44:24.276791

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4763f825583'
down_revision: Union[str, None] = 'bff9e021aa7e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
