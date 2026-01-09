"""
merge_heads

Revision ID: ee5db540f801
Revises: add_metadata_to_files, 20260109_2135
Create Date: 2026-01-09 19:40:44.776551+00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ee5db540f801'
down_revision = ('add_metadata_to_files', '20260109_2135')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
