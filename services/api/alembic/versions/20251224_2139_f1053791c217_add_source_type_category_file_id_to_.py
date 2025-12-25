"""
add_source_type_category_file_id_to_knowledge_sources

Revision ID: f1053791c217
Revises: d057365e708b
Create Date: 2025-12-24 21:39:35.128112+00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1053791c217'
down_revision = 'd057365e708b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to knowledge_sources
    op.add_column('knowledge_sources', sa.Column('source_type', sa.String(50), nullable=True))
    op.add_column('knowledge_sources', sa.Column('category', sa.String(100), nullable=True))
    op.add_column('knowledge_sources', sa.Column('file_id', sa.UUID(), nullable=True))
    op.add_column('knowledge_sources', sa.Column('url', sa.String(1000), nullable=True))
    op.add_column('knowledge_sources', sa.Column('metadata', sa.JSON(), nullable=True))
    
    # Make storage_key nullable (since URL/text sources don't have files)
    op.alter_column('knowledge_sources', 'storage_key',
               existing_type=sa.String(500),
               nullable=True)
    
    # Add foreign key constraint
    op.create_foreign_key('fk_knowledge_sources_file_id', 'knowledge_sources', 'files', ['file_id'], ['id'], ondelete='SET NULL')
    
    # Add index on category
    op.create_index('ix_kb_source_category', 'knowledge_sources', ['category'])


def downgrade() -> None:
    # Remove index and constraints
    op.drop_index('ix_kb_source_category', 'knowledge_sources')
    op.drop_constraint('fk_knowledge_sources_file_id', 'knowledge_sources', type_='foreignkey')
    
    # Remove columns
    op.drop_column('knowledge_sources', 'metadata')
    op.drop_column('knowledge_sources', 'url')
    op.drop_column('knowledge_sources', 'file_id')
    op.drop_column('knowledge_sources', 'category')
    op.drop_column('knowledge_sources', 'source_type')
    
    # Make storage_key NOT NULL again
    op.alter_column('knowledge_sources', 'storage_key',
               existing_type=sa.String(500),
               nullable=False)
