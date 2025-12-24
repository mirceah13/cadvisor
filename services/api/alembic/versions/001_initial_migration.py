"""Initial migration - create all tables

Revision ID: 001
Revises: 
Create Date: 2025-12-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector
import uuid

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enums
    user_role_enum = postgresql.ENUM('owner', 'admin', 'reviewer', 'contributor', 'viewer', name='userrole', create_type=False)
    user_role_enum.create(op.get_bind(), checkfirst=True)
    
    org_member_status_enum = postgresql.ENUM('active', 'invited', 'suspended', name='orgmemberstatus', create_type=False)
    org_member_status_enum.create(op.get_bind(), checkfirst=True)
    
    submission_status_enum = postgresql.ENUM('draft', 'submitted', 'analyzing', 'reviewed', 'approved', 'rejected', name='submissionstatus', create_type=False)
    submission_status_enum.create(op.get_bind(), checkfirst=True)
    
    analysis_run_status_enum = postgresql.ENUM('pending', 'running', 'completed', 'failed', 'cancelled', name='analysisrunstatus', create_type=False)
    analysis_run_status_enum.create(op.get_bind(), checkfirst=True)
    
    finding_severity_enum = postgresql.ENUM('info', 'low', 'medium', 'high', 'critical', name='findingseverity', create_type=False)
    finding_severity_enum.create(op.get_bind(), checkfirst=True)
    
    finding_status_enum = postgresql.ENUM('pending', 'accepted', 'rejected', 'modified', 'needs_info', name='findingstatus', create_type=False)
    finding_status_enum.create(op.get_bind(), checkfirst=True)
    
    feedback_action_enum = postgresql.ENUM('accept', 'reject', 'modify', 'needs_info', name='feedbackaction', create_type=False)
    feedback_action_enum.create(op.get_bind(), checkfirst=True)
    
    ruleset_status_enum = postgresql.ENUM('draft', 'active', 'archived', name='rulesetstatus', create_type=False)
    ruleset_status_enum.create(op.get_bind(), checkfirst=True)
    
    subscription_status_enum = postgresql.ENUM('trial', 'active', 'past_due', 'cancelled', 'expired', name='subscriptionstatus', create_type=False)
    subscription_status_enum.create(op.get_bind(), checkfirst=True)
    
    kb_source_status_enum = postgresql.ENUM('uploaded', 'processing', 'indexed', 'failed', name='kbsourcestatus', create_type=False)
    kb_source_status_enum.create(op.get_bind(), checkfirst=True)
    
    # Enable pgvector extension
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')
    
    # Users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean, nullable=False, default=True),
        sa.Column('is_superuser', sa.Boolean, nullable=False, default=False),
        sa.Column('email_verified', sa.Boolean, nullable=False, default=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_index('ix_users_email_active', 'users', ['email', 'is_active'])
    
    # Organizations table
    op.create_table(
        'organizations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False, unique=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean, nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_organizations_slug', 'organizations', ['slug'])
    op.create_index('ix_organizations_is_deleted', 'organizations', ['is_deleted'])
    
    # Org members table
    op.create_table(
        'org_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('role', user_role_enum, nullable=False),
        sa.Column('status', org_member_status_enum, nullable=False),
        sa.Column('invited_email', sa.String(255), nullable=True),
        sa.Column('invite_token', sa.String(255), nullable=True, unique=True),
        sa.Column('invite_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_org_members_org_id', 'org_members', ['org_id'])
    op.create_index('ix_org_members_user_id', 'org_members', ['user_id'])
    op.create_index('ix_orgmember_org_user', 'org_members', ['org_id', 'user_id'], unique=True)
    op.create_index('ix_org_members_invite_token', 'org_members', ['invite_token'])
    
    # Projects table
    op.create_table(
        'projects',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('building_type', sa.String(100), nullable=True),
        sa.Column('jurisdiction_profile_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean, nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_projects_org_id', 'projects', ['org_id'])
    op.create_index('ix_projects_is_deleted', 'projects', ['is_deleted'])
    op.create_index('ix_project_org_created', 'projects', ['org_id', sa.text('created_at DESC')])
    
    # Submissions table
    op.create_table(
        'submissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('version', sa.String(50), nullable=True),
        sa.Column('status', submission_status_enum, nullable=False),
        sa.Column('profile', postgresql.JSONB, nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean, nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_submissions_project_id', 'submissions', ['project_id'])
    op.create_index('ix_submissions_is_deleted', 'submissions', ['is_deleted'])
    op.create_index('ix_submission_project_created', 'submissions', ['project_id', sa.text('created_at DESC')])
    
    # Files table
    op.create_table(
        'files',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('submission_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storage_key', sa.String(500), nullable=False, unique=True),
        sa.Column('filename', sa.String(500), nullable=False),
        sa.Column('mime_type', sa.String(100), nullable=False),
        sa.Column('size_bytes', sa.BigInteger, nullable=False),
        sa.Column('sha256', sa.String(64), nullable=False),
        sa.Column('scan_status', sa.String(50), nullable=True),
        sa.Column('scan_result', postgresql.JSONB, nullable=True),
        sa.Column('uploaded_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean, nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id']),
    )
    op.create_index('ix_files_submission_id', 'files', ['submission_id'])
    op.create_index('ix_files_org_id', 'files', ['org_id'])
    op.create_index('ix_files_sha256', 'files', ['sha256'])
    op.create_index('ix_files_is_deleted', 'files', ['is_deleted'])
    op.create_index('ix_file_submission_created', 'files', ['submission_id', sa.text('created_at DESC')])
    
    # Knowledge sources table
    op.create_table(
        'knowledge_sources',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('jurisdiction', sa.String(100), nullable=True),
        sa.Column('standard_code', sa.String(100), nullable=True),
        sa.Column('edition_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('language', sa.String(10), nullable=False, default='en'),
        sa.Column('tags', postgresql.JSONB, nullable=True),
        sa.Column('storage_key', sa.String(500), nullable=False),
        sa.Column('source_url', sa.String(1000), nullable=True),
        sa.Column('status', kb_source_status_enum, nullable=False),
        sa.Column('uploaded_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean, nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id']),
    )
    op.create_index('ix_knowledge_sources_org_id', 'knowledge_sources', ['org_id'])
    op.create_index('ix_knowledge_sources_jurisdiction', 'knowledge_sources', ['jurisdiction'])
    op.create_index('ix_knowledge_sources_standard_code', 'knowledge_sources', ['standard_code'])
    op.create_index('ix_knowledge_sources_is_deleted', 'knowledge_sources', ['is_deleted'])
    op.create_index('ix_kb_source_jurisdiction', 'knowledge_sources', ['jurisdiction', 'standard_code'])
    
    # KB chunks table
    op.create_table(
        'kb_chunks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('knowledge_source_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('chunk_text', sa.Text, nullable=False),
        sa.Column('chunk_index', sa.Integer, nullable=False),
        sa.Column('embedding', Vector(768), nullable=True),
        sa.Column('metadata', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['knowledge_source_id'], ['knowledge_sources.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_kb_chunks_knowledge_source_id', 'kb_chunks', ['knowledge_source_id'])
    op.create_index('ix_kb_chunks_org_id', 'kb_chunks', ['org_id'])
    op.create_index('ix_kb_chunk_source_index', 'kb_chunks', ['knowledge_source_id', 'chunk_index'])
    
    # Analysis runs table
    op.create_table(
        'analysis_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('submission_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', analysis_run_status_enum, nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('model_name', sa.String(100), nullable=True),
        sa.Column('embedding_model', sa.String(100), nullable=True),
        sa.Column('config', postgresql.JSONB, nullable=True),
        sa.Column('total_findings', sa.Integer, default=0),
        sa.Column('critical_findings', sa.Integer, default=0),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_analysis_runs_submission_id', 'analysis_runs', ['submission_id'])
    op.create_index('ix_analysis_runs_org_id', 'analysis_runs', ['org_id'])
    op.create_index('ix_analysis_run_submission_created', 'analysis_runs', ['submission_id', sa.text('created_at DESC')])
    
    # Findings table
    op.create_table(
        'findings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('analysis_run_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('severity', finding_severity_enum, nullable=False),
        sa.Column('status', finding_status_enum, nullable=False),
        sa.Column('statement', sa.Text, nullable=False),
        sa.Column('confidence', sa.Float, nullable=False),
        sa.Column('evidence', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['analysis_run_id'], ['analysis_runs.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_findings_analysis_run_id', 'findings', ['analysis_run_id'])
    op.create_index('ix_findings_category', 'findings', ['category'])
    op.create_index('ix_findings_severity', 'findings', ['severity'])
    op.create_index('ix_findings_status', 'findings', ['status'])
    op.create_index('ix_finding_run_severity', 'findings', ['analysis_run_id', 'severity'])
    op.create_index('ix_finding_run_status', 'findings', ['analysis_run_id', 'status'])
    
    # Finding feedback table
    op.create_table(
        'finding_feedback',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('finding_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reviewer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('action', feedback_action_enum, nullable=False),
        sa.Column('final_statement', sa.Text, nullable=True),
        sa.Column('reason_code', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['finding_id'], ['findings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reviewer_id'], ['users.id']),
    )
    op.create_index('ix_finding_feedback_finding_id', 'finding_feedback', ['finding_id'])
    op.create_index('ix_feedback_finding_created', 'finding_feedback', ['finding_id', sa.text('created_at DESC')])
    
    # Rulesets table
    op.create_table(
        'rulesets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('jurisdiction', sa.String(100), nullable=True),
        sa.Column('version', sa.String(50), nullable=False),
        sa.Column('status', ruleset_status_enum, nullable=False),
        sa.Column('rules', postgresql.JSONB, nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_rulesets_org_id', 'rulesets', ['org_id'])
    op.create_index('ix_rulesets_jurisdiction', 'rulesets', ['jurisdiction'])
    op.create_index('ix_ruleset_org_jurisdiction', 'rulesets', ['org_id', 'jurisdiction', 'status'])
    
    # Usage events table
    op.create_table(
        'usage_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('event_type', sa.String(100), nullable=False),
        sa.Column('quantity', sa.Integer, nullable=False, default=1),
        sa.Column('metadata', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
    )
    op.create_index('ix_usage_events_org_id', 'usage_events', ['org_id'])
    op.create_index('ix_usage_events_event_type', 'usage_events', ['event_type'])
    op.create_index('ix_usage_org_type_created', 'usage_events', ['org_id', 'event_type', sa.text('created_at DESC')])
    
    # Subscriptions table
    op.create_table(
        'subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('provider', sa.String(50), nullable=False, default='mock'),
        sa.Column('plan', sa.String(50), nullable=False, default='trial'),
        sa.Column('status', subscription_status_enum, nullable=False),
        sa.Column('trial_ends_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('current_period_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('current_period_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('limits', postgresql.JSONB, nullable=False),
        sa.Column('provider_customer_id', sa.String(255), nullable=True),
        sa.Column('provider_subscription_id', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_subscriptions_org_id', 'subscriptions', ['org_id'])
    
    # Audit logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('resource_type', sa.String(100), nullable=True),
        sa.Column('resource_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('details', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
    )
    op.create_index('ix_audit_logs_org_id', 'audit_logs', ['org_id'])
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
    op.create_index('ix_audit_org_action_created', 'audit_logs', ['org_id', 'action', sa.text('created_at DESC')])
    op.create_index('ix_audit_user_created', 'audit_logs', ['user_id', sa.text('created_at DESC')])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('audit_logs')
    op.drop_table('subscriptions')
    op.drop_table('usage_events')
    op.drop_table('rulesets')
    op.drop_table('finding_feedback')
    op.drop_table('findings')
    op.drop_table('analysis_runs')
    op.drop_table('kb_chunks')
    op.drop_table('knowledge_sources')
    op.drop_table('files')
    op.drop_table('submissions')
    op.drop_table('projects')
    op.drop_table('org_members')
    op.drop_table('organizations')
    op.drop_table('users')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS userrole')
    op.execute('DROP TYPE IF EXISTS orgmemberstatus')
    op.execute('DROP TYPE IF EXISTS submissionstatus')
    op.execute('DROP TYPE IF EXISTS analysisrunstatus')
    op.execute('DROP TYPE IF EXISTS findingseverity')
    op.execute('DROP TYPE IF EXISTS findingstatus')
    op.execute('DROP TYPE IF EXISTS feedbackaction')
    op.execute('DROP TYPE IF EXISTS rulesetstatus')
    op.execute('DROP TYPE IF EXISTS subscriptionstatus')
    op.execute('DROP TYPE IF EXISTS kbsourcestatus')
