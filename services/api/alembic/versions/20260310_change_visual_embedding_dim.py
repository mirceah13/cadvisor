"""Change visual_embedding from Vector(512) to Vector(768) for Jina CLIP API

Replaces local CLIP (ViT-B/32, 512d) with Jina jina-clip-v1 API (768d).

Revision ID: 20260310_visual_embed_768
Revises: ee5db540f801
Create Date: 2026-03-10
"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision = '20260310_visual_embed_768'
down_revision = 'ee5db540f801'
branch_labels = None
depends_on = None


def upgrade():
    # Drop the old ivfflat index first (it is dimension-specific)
    op.execute("DROP INDEX IF EXISTS ix_kb_images_visual_embedding")

    # Alter the column type; existing NULL values stay NULL, any 512d vectors
    # are dropped (column was nullable and had 0 rows with embeddings so far).
    op.execute(
        "ALTER TABLE kb_images "
        "ALTER COLUMN visual_embedding TYPE vector(768) "
        "USING NULL"
    )

    # Recreate the index for the new dimension.
    # Use hnsw instead of ivfflat — hnsw doesn't require a minimum row count.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_kb_images_visual_embedding "
        "ON kb_images "
        "USING hnsw (visual_embedding vector_cosine_ops)"
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_kb_images_visual_embedding")
    op.execute(
        "ALTER TABLE kb_images "
        "ALTER COLUMN visual_embedding TYPE vector(512) "
        "USING NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_kb_images_visual_embedding "
        "ON kb_images "
        "USING ivfflat (visual_embedding vector_cosine_ops) "
        "WITH (lists = 100)"
    )
