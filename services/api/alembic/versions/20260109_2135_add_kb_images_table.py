"""add kb_images table for multimodal knowledge base

Revision ID: 20260109_2135
Revises: f1053791c217
Create Date: 2026-01-09 21:35:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector
import uuid

# revision identifiers, used by Alembic.
revision = '20260109_2135'
down_revision = 'f1053791c217'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add kb_images table for storing extracted images with visual embeddings"""
    
    # Create kb_images table
    op.create_table(
        'kb_images',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('knowledge_source_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=True),
        
        # Image storage
        sa.Column('storage_key', sa.String(500), nullable=False),
        sa.Column('image_hash', sa.String(32), nullable=False),
        sa.Column('image_index', sa.Integer, nullable=False),
        
        # Image metadata
        sa.Column('format', sa.String(10), nullable=False),
        sa.Column('content_type', sa.String(50), nullable=False),
        sa.Column('size_bytes', sa.BigInteger, nullable=False),
        sa.Column('width', sa.Integer, nullable=True),
        sa.Column('height', sa.Integer, nullable=True),
        
        # OCR data
        sa.Column('ocr_text', sa.Text, nullable=True),
        sa.Column('ocr_confidence', sa.Float, nullable=True),
        sa.Column('ocr_language', sa.String(20), nullable=True),
        
        # Visual embedding (CLIP: 512 dimensions)
        sa.Column('visual_embedding', Vector(512), nullable=True),
        
        # Additional metadata
        sa.Column('metadata', postgresql.JSONB, nullable=True),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Foreign keys
        sa.ForeignKeyConstraint(['knowledge_source_id'], ['knowledge_sources.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
    )
    
    # Create indexes
    op.create_index('ix_kb_images_knowledge_source_id', 'kb_images', ['knowledge_source_id'])
    op.create_index('ix_kb_images_org_id', 'kb_images', ['org_id'])
    op.create_index('ix_kb_image_source_index', 'kb_images', ['knowledge_source_id', 'image_index'])
    op.create_index('ix_kb_image_hash', 'kb_images', ['image_hash'])
    
    # Create vector index for similarity search (using IVFFlat for efficiency)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_kb_images_visual_embedding 
        ON kb_images 
        USING ivfflat (visual_embedding vector_cosine_ops)
        WITH (lists = 100);
    """)


def downgrade() -> None:
    """Remove kb_images table"""
    op.drop_table('kb_images')
