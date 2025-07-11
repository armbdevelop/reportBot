"""first model shift report

Revision ID: ded0503ef02b
Revises: 
Create Date: 2025-05-26 16:41:31.439645

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ded0503ef02b'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('shift_reports',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('location_id', sa.Integer(), nullable=False),
    sa.Column('shift_type', sa.String(length=20), nullable=False),
    sa.Column('date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('cashier_name', sa.String(length=255), nullable=False),
    sa.Column('income_entries', sa.JSON(), nullable=True),
    sa.Column('total_income', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('expense_entries', sa.JSON(), nullable=True),
    sa.Column('total_expenses', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('total_revenue', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('returns', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('acquiring', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('qr_code', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('online_app', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('yandex_food', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('fact_cash', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('total_acquiring', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('calculated_amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('surplus_shortage', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('photo_path', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_shift_reports_id'), 'shift_reports', ['id'], unique=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_shift_reports_id'), table_name='shift_reports')
    op.drop_table('shift_reports')
    # ### end Alembic commands ###
