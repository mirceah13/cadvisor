"""
Feedback Service
Manages finding feedback and review workflow
"""

import logging
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from datetime import datetime

from app.models import Finding, FindingFeedback, User

logger = logging.getLogger(__name__)


class FeedbackService:
    """Service for managing finding feedback and reviews"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_feedback(
        self,
        finding_id: UUID,
        user_id: UUID,
        feedback_type: str,
        comment: Optional[str] = None,
        is_correct: Optional[bool] = None,
        suggested_severity: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> FindingFeedback:
        """
        Create feedback on a finding
        
        Args:
            finding_id: Finding ID
            user_id: User providing feedback
            feedback_type: "review", "comment", "correction", "approval"
            comment: Optional text comment
            is_correct: Whether finding is accurate
            suggested_severity: Suggested severity change
            metadata: Additional metadata
            
        Returns:
            Created FindingFeedback
        """
        # Verify finding exists
        finding = self.db.query(Finding).filter(Finding.id == finding_id).first()
        
        if not finding:
            raise ValueError(f"Finding {finding_id} not found")
        
        # Create feedback
        feedback = FindingFeedback(
            finding_id=finding_id,
            user_id=user_id,
            feedback_type=feedback_type,
            comment=comment,
            is_correct=is_correct,
            suggested_severity=suggested_severity,
            metadata=metadata or {}
        )
        
        self.db.add(feedback)
        
        # Update finding based on feedback
        if feedback_type == "approval" and is_correct:
            finding.status = "verified"
        elif feedback_type == "correction":
            finding.status = "needs_review"
            if suggested_severity:
                finding.metadata = finding.metadata or {}
                finding.metadata["suggested_severity"] = suggested_severity
        
        self.db.commit()
        self.db.refresh(feedback)
        
        logger.info(f"Created {feedback_type} feedback for finding {finding_id} by user {user_id}")
        
        return feedback
    
    def get_feedback(
        self,
        finding_id: UUID,
        feedback_type: Optional[str] = None
    ) -> List[FindingFeedback]:
        """Get all feedback for a finding"""
        
        query = self.db.query(FindingFeedback).filter(
            FindingFeedback.finding_id == finding_id
        )
        
        if feedback_type:
            query = query.filter(FindingFeedback.feedback_type == feedback_type)
        
        return query.order_by(FindingFeedback.created_at.desc()).all()
    
    def get_user_feedback(
        self,
        user_id: UUID,
        limit: int = 50
    ) -> List[FindingFeedback]:
        """Get all feedback by a user"""
        
        return self.db.query(FindingFeedback).filter(
            FindingFeedback.user_id == user_id
        ).order_by(
            FindingFeedback.created_at.desc()
        ).limit(limit).all()
    
    def update_finding_status(
        self,
        finding_id: UUID,
        status: str,
        user_id: UUID,
        comment: Optional[str] = None
    ) -> Finding:
        """
        Update finding status with audit trail
        
        Args:
            finding_id: Finding ID
            status: New status (open, verified, resolved, dismissed)
            user_id: User making the change
            comment: Optional comment
            
        Returns:
            Updated Finding
        """
        finding = self.db.query(Finding).filter(Finding.id == finding_id).first()
        
        if not finding:
            raise ValueError(f"Finding {finding_id} not found")
        
        old_status = finding.status
        finding.status = status
        
        # Create audit trail feedback
        self.create_feedback(
            finding_id=finding_id,
            user_id=user_id,
            feedback_type="status_change",
            comment=comment,
            metadata={
                "old_status": old_status,
                "new_status": status
            }
        )
        
        logger.info(f"Updated finding {finding_id} status: {old_status} → {status}")
        
        return finding
    
    def assign_finding(
        self,
        finding_id: UUID,
        assignee_id: UUID,
        assigned_by: UUID
    ) -> Finding:
        """
        Assign finding to a reviewer
        
        Args:
            finding_id: Finding ID
            assignee_id: User to assign to
            assigned_by: User making assignment
            
        Returns:
            Updated Finding
        """
        finding = self.db.query(Finding).filter(Finding.id == finding_id).first()
        
        if not finding:
            raise ValueError(f"Finding {finding_id} not found")
        
        old_assignee = finding.assignee_id
        finding.assignee_id = assignee_id
        
        # Create feedback for assignment
        self.create_feedback(
            finding_id=finding_id,
            user_id=assigned_by,
            feedback_type="assignment",
            metadata={
                "old_assignee_id": str(old_assignee) if old_assignee else None,
                "new_assignee_id": str(assignee_id)
            }
        )
        
        self.db.commit()
        self.db.refresh(finding)
        
        logger.info(f"Assigned finding {finding_id} to user {assignee_id}")
        
        return finding
    
    def bulk_update_findings(
        self,
        finding_ids: List[UUID],
        updates: Dict[str, Any],
        user_id: UUID
    ) -> int:
        """
        Bulk update multiple findings
        
        Args:
            finding_ids: List of finding IDs
            updates: Dict with fields to update (status, assignee_id, severity)
            user_id: User making changes
            
        Returns:
            Number of findings updated
        """
        updated_count = 0
        
        for finding_id in finding_ids:
            finding = self.db.query(Finding).filter(Finding.id == finding_id).first()
            
            if not finding:
                continue
            
            # Track changes for audit
            changes = {}
            
            if "status" in updates:
                old_status = finding.status
                finding.status = updates["status"]
                changes["status"] = {"old": old_status, "new": updates["status"]}
            
            if "assignee_id" in updates:
                old_assignee = finding.assignee_id
                finding.assignee_id = updates["assignee_id"]
                changes["assignee_id"] = {"old": str(old_assignee) if old_assignee else None, "new": str(updates["assignee_id"])}
            
            if "severity" in updates:
                old_severity = finding.severity
                finding.severity = updates["severity"]
                changes["severity"] = {"old": old_severity, "new": updates["severity"]}
            
            # Create audit feedback
            self.create_feedback(
                finding_id=finding_id,
                user_id=user_id,
                feedback_type="bulk_update",
                metadata={"changes": changes}
            )
            
            updated_count += 1
        
        self.db.commit()
        
        logger.info(f"Bulk updated {updated_count} findings")
        
        return updated_count
    
    def get_findings_needing_review(
        self,
        org_id: UUID,
        assignee_id: Optional[UUID] = None,
        limit: int = 50
    ) -> List[Finding]:
        """
        Get findings that need review
        
        Args:
            org_id: Organization ID
            assignee_id: Optional filter by assignee
            limit: Maximum results
            
        Returns:
            List of findings
        """
        from app.models import Submission
        
        query = self.db.query(Finding).join(
            Submission, Finding.submission_id == Submission.id
        ).filter(
            Submission.org_id == org_id,
            Finding.status.in_(["open", "needs_review"])
        )
        
        if assignee_id:
            query = query.filter(Finding.assignee_id == assignee_id)
        
        return query.order_by(
            Finding.severity.desc(),
            Finding.created_at.desc()
        ).limit(limit).all()
    
    def get_review_statistics(self, org_id: UUID) -> Dict[str, Any]:
        """
        Get review statistics for organization
        
        Args:
            org_id: Organization ID
            
        Returns:
            Dict with statistics
        """
        from app.models import Submission
        from sqlalchemy import func
        
        # Total findings by status
        status_counts = self.db.query(
            Finding.status,
            func.count(Finding.id).label('count')
        ).join(
            Submission, Finding.submission_id == Submission.id
        ).filter(
            Submission.org_id == org_id
        ).group_by(Finding.status).all()
        
        # Findings by severity
        severity_counts = self.db.query(
            Finding.severity,
            func.count(Finding.id).label('count')
        ).join(
            Submission, Finding.submission_id == Submission.id
        ).filter(
            Submission.org_id == org_id
        ).group_by(Finding.severity).all()
        
        # Feedback statistics
        feedback_counts = self.db.query(
            FindingFeedback.feedback_type,
            func.count(FindingFeedback.id).label('count')
        ).join(
            Finding, FindingFeedback.finding_id == Finding.id
        ).join(
            Submission, Finding.submission_id == Submission.id
        ).filter(
            Submission.org_id == org_id
        ).group_by(FindingFeedback.feedback_type).all()
        
        return {
            "by_status": {s.status: s.count for s in status_counts},
            "by_severity": {s.severity: s.count for s in severity_counts},
            "by_feedback_type": {f.feedback_type: f.count for f in feedback_counts},
            "total_findings": sum(s.count for s in status_counts),
            "needs_review": sum(s.count for s in status_counts if s.status in ["open", "needs_review"])
        }
