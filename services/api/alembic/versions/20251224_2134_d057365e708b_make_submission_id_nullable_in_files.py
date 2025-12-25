"""
make_submission_id_nullable_in_files

Revision ID: d057365e708b
Revises: 001
Create Date: 2025-12-24 21:34:47.062437+00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd057365e708b'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make submission_id nullable in files table
    op.alter_column('files', 'submission_id',
               existing_type=sa.UUID(),
               nullable=True)


def downgrade() -> None:
    # Revert submission_id to NOT NULL
    op.alter_column('files', 'submission_id',
               existing_type=sa.UUID(),
               nullable=False)
