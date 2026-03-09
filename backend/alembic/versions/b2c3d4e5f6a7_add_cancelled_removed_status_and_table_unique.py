"""add_cancelled_removed_status_and_table_unique

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add CANCELLED and REMOVED values to order_status enum
    op.execute("ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'CANCELLED'")
    op.execute("ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'REMOVED'")

    # Add unique constraint on tables(restaurant_id, table_number)
    op.create_unique_constraint(
        'uq_table_restaurant_number',
        'tables',
        ['restaurant_id', 'table_number'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_table_restaurant_number', 'tables', type_='unique')
    # Note: PostgreSQL does not support removing enum values
