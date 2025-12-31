"""add metadata to files

Revision ID: add_metadata_to_files
Revises: 17b1c0916088
Create Date: 2025-12-31

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_metadata_to_files'
down_revision = '17b1c0916088'
branch_labels = None
depends_on = None


def upgrade():
    # Add file_metadata column to files table (accessible as parsed_metadata in the model)
    op.add_column('files', sa.Column('file_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade():
    # Remove file_metadata column from files table
    op.drop_column('files', 'file_metadata')
