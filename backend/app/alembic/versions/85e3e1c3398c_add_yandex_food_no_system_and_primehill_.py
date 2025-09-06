"""add yandex_food_no_system and primehill fields

Revision ID: 85e3e1c3398c
Revises: f347aa0dfda3
Create Date: 2025-06-03 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '85e3e1c3398c'
down_revision: Union[str, None] = 'f347aa0dfda3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Добавляем колонки с server_default='0' для совместимости с существующими записями
    op.add_column('shift_reports',
                  sa.Column('yandex_food_no_system',
                           sa.Numeric(precision=10, scale=2),
                           nullable=False,
                           server_default='0'))

    op.add_column('shift_reports',
                  sa.Column('primehill',
                           sa.Numeric(precision=10, scale=2),
                           nullable=False,
                           server_default='0'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('shift_reports', 'primehill')
    op.drop_column('shift_reports', 'yandex_food_no_system')