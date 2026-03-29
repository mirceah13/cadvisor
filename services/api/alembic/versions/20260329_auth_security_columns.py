"""Add email verification and password reset token columns to users

Revision ID: 20260329_auth_security
Revises: 20260329_warning_severity
Create Date: 2026-03-29
"""
from alembic import op
import sqlalchemy as sa

revision = '20260329_auth_security'
down_revision = '20260329_warning_severity'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('email_verify_token', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('email_verify_token_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('password_reset_token', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('password_reset_token_expires_at', sa.DateTime(timezone=True), nullable=True))

    op.create_index('ix_users_email_verify_token', 'users', ['email_verify_token'], unique=True)
    op.create_index('ix_users_password_reset_token', 'users', ['password_reset_token'], unique=True)


def downgrade():
    op.drop_index('ix_users_password_reset_token', table_name='users')
    op.drop_index('ix_users_email_verify_token', table_name='users')
    op.drop_column('users', 'password_reset_token_expires_at')
    op.drop_column('users', 'password_reset_token')
    op.drop_column('users', 'email_verify_token_expires_at')
    op.drop_column('users', 'email_verify_token')
