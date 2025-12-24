"""
Database Models for BuildGuard Advisor
"""
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Float, 
    ForeignKey, Enum, JSON, Index, BigInteger, LargeBinary
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector
import uuid
import enum

from app.core.database import Base


class TimestampMixin:
    """Mixin for created_at and updated_at timestamps"""
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class SoftDeleteMixin:
    """Mixin for soft delete functionality"""
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


# Enums
class UserRole(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    REVIEWER = "reviewer"
    CONTRIBUTOR = "contributor"
    VIEWER = "viewer"


class OrgMemberStatus(str, enum.Enum):
    ACTIVE = "active"
    INVITED = "invited"
    SUSPENDED = "suspended"


class SubmissionStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    ANALYZING = "analyzing"
    REVIEWED = "reviewed"
    APPROVED = "approved"
    REJECTED = "rejected"


class AnalysisRunStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class FindingSeverity(str, enum.Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class FindingStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    MODIFIED = "modified"
    NEEDS_INFO = "needs_info"


class FeedbackAction(str, enum.Enum):
    ACCEPT = "accept"
    REJECT = "reject"
    MODIFY = "modify"
    NEEDS_INFO = "needs_info"


class RulesetStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class SubscriptionStatus(str, enum.Enum):
    TRIAL = "trial"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class KBSourceStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    INDEXED = "indexed"
    FAILED = "failed"


# Models
class User(Base, TimestampMixin):
    """User model"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    org_memberships = relationship("OrgMember", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")
    
    __table_args__ = (
        Index('ix_users_email_active', email, is_active),
    )


class Organization(Base, TimestampMixin, SoftDeleteMixin):
    """Organization/Tenant model"""
    __tablename__ = "organizations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Relationships
    members = relationship("OrgMember", back_populates="organization", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="organization", cascade="all, delete-orphan")
    knowledge_sources = relationship("KnowledgeSource", back_populates="organization", cascade="all, delete-orphan")
    rulesets = relationship("Ruleset", back_populates="organization", cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="organization", uselist=False, cascade="all, delete-orphan")
    usage_events = relationship("UsageEvent", back_populates="organization", cascade="all, delete-orphan")


class OrgMember(Base, TimestampMixin):
    """Organization membership"""
    __tablename__ = "org_members"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    
    role = Column(Enum(UserRole, values_callable=lambda x: [e.value for e in x]), nullable=False, default=UserRole.VIEWER)
    status = Column(Enum(OrgMemberStatus, values_callable=lambda x: [e.value for e in x]), nullable=False, default=OrgMemberStatus.INVITED)
    
    # For invitations
    invited_email = Column(String(255), nullable=True)
    invite_token = Column(String(255), unique=True, nullable=True, index=True)
    invite_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="org_memberships")
    
    __table_args__ = (
        Index('ix_orgmember_org_user', org_id, user_id, unique=True),
    )


class Project(Base, TimestampMixin, SoftDeleteMixin):
    """Project model"""
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    building_type = Column(String(100), nullable=True)  # residential, commercial, industrial, etc.
    jurisdiction_profile_id = Column(UUID(as_uuid=True), nullable=True)  # Link to jurisdiction config
    
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Relationships
    organization = relationship("Organization", back_populates="projects")
    submissions = relationship("Submission", back_populates="project", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_project_org_created', 'org_id', 'created_at'),
    )


class Submission(Base, TimestampMixin, SoftDeleteMixin):
    """Submission model"""
    __tablename__ = "submissions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    version = Column(String(50), nullable=True)
    status = Column(Enum(SubmissionStatus, values_callable=lambda x: [e.value for e in x]), nullable=False, default=SubmissionStatus.DRAFT)
    
    # Extracted profile (populated by analysis)
    profile = Column(JSONB, nullable=True)  # SubmissionProfile JSON
    
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Relationships
    project = relationship("Project", back_populates="submissions")
    files = relationship("File", back_populates="submission", cascade="all, delete-orphan")
    analysis_runs = relationship("AnalysisRun", back_populates="submission", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_submission_project_created', project_id, 'created_at'),
    )


class File(Base, TimestampMixin, SoftDeleteMixin):
    """File model"""
    __tablename__ = "files"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id = Column(UUID(as_uuid=True), ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    
    storage_key = Column(String(500), nullable=False, unique=True)
    filename = Column(String(500), nullable=False)
    mime_type = Column(String(100), nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    sha256 = Column(String(64), nullable=False, index=True)
    
    # File scanning
    scan_status = Column(String(50), nullable=True)
    scan_result = Column(JSONB, nullable=True)
    
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Relationships
    submission = relationship("Submission", back_populates="files")
    
    __table_args__ = (
        Index('ix_file_submission_created', submission_id, 'created_at'),
    )


class KnowledgeSource(Base, TimestampMixin, SoftDeleteMixin):
    """Knowledge base source document"""
    __tablename__ = "knowledge_sources"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    
    title = Column(String(500), nullable=False)
    jurisdiction = Column(String(100), nullable=True, index=True)
    standard_code = Column(String(100), nullable=True, index=True)
    edition_date = Column(DateTime(timezone=True), nullable=True)
    language = Column(String(10), default="en", nullable=False)
    tags = Column(JSONB, nullable=True)
    
    storage_key = Column(String(500), nullable=False)
    source_url = Column(String(1000), nullable=True)
    
    status = Column(Enum(KBSourceStatus, values_callable=lambda x: [e.value for e in x]), nullable=False, default=KBSourceStatus.UPLOADED)
    
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Relationships
    organization = relationship("Organization", back_populates="knowledge_sources")
    chunks = relationship("KBChunk", back_populates="source", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_kb_source_jurisdiction', jurisdiction, standard_code),
    )


class KBChunk(Base, TimestampMixin):
    """Knowledge base text chunk with embedding"""
    __tablename__ = "kb_chunks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    knowledge_source_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_sources.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    
    chunk_text = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    
    # Embedding vector (dimension configured via settings, default 768 for nomic-embed-text)
    embedding = Column(Vector(768), nullable=True)
    
    chunk_metadata = Column(JSONB, nullable=True)  # page number, section, etc.
    
    # Relationships
    source = relationship("KnowledgeSource", back_populates="chunks")
    
    __table_args__ = (
        Index('ix_kb_chunk_source_index', knowledge_source_id, chunk_index),
    )


class AnalysisRun(Base, TimestampMixin):
    """Analysis run"""
    __tablename__ = "analysis_runs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id = Column(UUID(as_uuid=True), ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    
    status = Column(Enum(AnalysisRunStatus, values_callable=lambda x: [e.value for e in x]), nullable=False, default=AnalysisRunStatus.PENDING)
    
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    
    # AI model info
    model_name = Column(String(100), nullable=True)
    embedding_model = Column(String(100), nullable=True)
    
    # Configuration
    config = Column(JSONB, nullable=True)
    
    # Results summary
    total_findings = Column(Integer, default=0)
    critical_findings = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    
    # Relationships
    submission = relationship("Submission", back_populates="analysis_runs")
    findings = relationship("Finding", back_populates="analysis_run", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_analysis_run_submission_created', submission_id, 'created_at'),
    )


class Finding(Base, TimestampMixin):
    """Analysis finding"""
    __tablename__ = "findings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_run_id = Column(UUID(as_uuid=True), ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    
    category = Column(String(100), nullable=False, index=True)
    severity = Column(Enum(FindingSeverity, values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    status = Column(Enum(FindingStatus, values_callable=lambda x: [e.value for e in x]), nullable=False, default=FindingStatus.PENDING, index=True)
    
    statement = Column(Text, nullable=False)
    confidence = Column(Float, nullable=False)
    
    evidence = Column(JSONB, nullable=True)  # file refs, KB citations, extracted data
    
    # Relationships
    analysis_run = relationship("AnalysisRun", back_populates="findings")
    feedback = relationship("FindingFeedback", back_populates="finding", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_finding_run_severity', analysis_run_id, severity),
        Index('ix_finding_run_status', analysis_run_id, status),
    )


class FindingFeedback(Base, TimestampMixin):
    """Human reviewer feedback on findings"""
    __tablename__ = "finding_feedback"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    finding_id = Column(UUID(as_uuid=True), ForeignKey("findings.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    action = Column(Enum(FeedbackAction, values_callable=lambda x: [e.value for e in x]), nullable=False)
    final_statement = Column(Text, nullable=True)
    reason_code = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    
    # Relationships
    finding = relationship("Finding", back_populates="feedback")
    
    __table_args__ = (
        Index('ix_feedback_finding_created', finding_id, 'created_at'),
    )


class Ruleset(Base, TimestampMixin):
    """Rules engine ruleset"""
    __tablename__ = "rulesets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    
    name = Column(String(255), nullable=False)
    jurisdiction = Column(String(100), nullable=True, index=True)
    version = Column(String(50), nullable=False)
    status = Column(Enum(RulesetStatus, values_callable=lambda x: [e.value for e in x]), nullable=False, default=RulesetStatus.DRAFT)
    
    rules = Column(JSONB, nullable=False)
    
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Relationships
    organization = relationship("Organization", back_populates="rulesets")
    
    __table_args__ = (
        Index('ix_ruleset_org_jurisdiction', org_id, jurisdiction, status),
    )


class UsageEvent(Base, TimestampMixin):
    """Usage tracking for billing"""
    __tablename__ = "usage_events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    event_type = Column(String(100), nullable=False, index=True)
    quantity = Column(Integer, default=1, nullable=False)
    event_metadata = Column(JSONB, nullable=True)
    
    # Relationships
    organization = relationship("Organization", back_populates="usage_events")
    
    __table_args__ = (
        Index('ix_usage_org_type_created', org_id, event_type, 'created_at'),
    )


class Subscription(Base, TimestampMixin):
    """Organization subscription"""
    __tablename__ = "subscriptions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    provider = Column(String(50), nullable=False, default="mock")
    plan = Column(String(50), nullable=False, default="trial")
    status = Column(Enum(SubscriptionStatus, values_callable=lambda x: [e.value for e in x]), nullable=False, default=SubscriptionStatus.TRIAL)
    
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    current_period_start = Column(DateTime(timezone=True), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    
    limits = Column(JSONB, nullable=False)
    
    provider_customer_id = Column(String(255), nullable=True)
    provider_subscription_id = Column(String(255), nullable=True)
    
    # Relationships
    organization = relationship("Organization", back_populates="subscription")


class AuditLog(Base, TimestampMixin):
    """Audit log for security and compliance"""
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(100), nullable=True)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    details = Column(JSONB, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")
    
    __table_args__ = (
        Index('ix_audit_org_action_created', org_id, action, 'created_at'),
        Index('ix_audit_user_created', user_id, 'created_at'),
    )
