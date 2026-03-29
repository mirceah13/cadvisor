"""Add 'warning' value to findingseverity enum

Revision ID: 20260329_warning_severity
Revises: 20260310_visual_embed_768
Create Date: 2026-03-29
"""
from alembic import op

revision = '20260329_warning_severity'
down_revision = '20260310_visual_embed_768'
branch_labels = None
depends_on = None


def upgrade():
    # ADD VALUE cannot run inside a transaction block in Postgres < 12,
    # but is safe in Postgres 12+ without explicit transaction.
    op.execute("ALTER TYPE findingseverity ADD VALUE IF NOT EXISTS 'warning' AFTER 'low'")


def downgrade():
    # Postgres does not support removing enum values; a full recreate is needed.
    # For safety we leave this as a no-op — removing 'warning' requires a data migration.
    pass
