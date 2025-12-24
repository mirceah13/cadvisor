"""
Subscription & Billing Service - Manages subscriptions, usage tracking, and limits
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models import (
    Organization, Subscription, UsageEvent, User,
    Project, Submission, AnalysisRun, File
)


# Subscription tier definitions
SUBSCRIPTION_TIERS = {
    "trial": {
        "name": "Trial",
        "price_monthly": 0,
        "limits": {
            "max_projects": 3,
            "max_submissions_per_month": 10,
            "max_file_size_mb": 50,
            "max_analysis_per_day": 5,
            "max_storage_gb": 1,
            "max_team_members": 3,
            "max_kb_sources": 5
        },
        "features": [
            "Basic compliance checks",
            "PDF report generation",
            "Email support"
        ]
    },
    "pro": {
        "name": "Professional",
        "price_monthly": 99,
        "limits": {
            "max_projects": 20,
            "max_submissions_per_month": 100,
            "max_file_size_mb": 500,
            "max_analysis_per_day": 50,
            "max_storage_gb": 50,
            "max_team_members": 10,
            "max_kb_sources": 50
        },
        "features": [
            "All compliance checks",
            "Advanced AI analysis",
            "Custom templates",
            "Priority support",
            "API access"
        ]
    },
    "enterprise": {
        "name": "Enterprise",
        "price_monthly": 499,
        "limits": {
            "max_projects": -1,  # unlimited
            "max_submissions_per_month": -1,
            "max_file_size_mb": 2000,
            "max_analysis_per_day": -1,
            "max_storage_gb": 500,
            "max_team_members": -1,
            "max_kb_sources": -1
        },
        "features": [
            "Unlimited everything",
            "Custom integrations",
            "Dedicated support",
            "SLA guarantee",
            "On-premise option"
        ]
    }
}


class SubscriptionService:
    """Service for managing subscriptions and usage limits"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_subscription(self, organization_id: int) -> Subscription:
        """
        Get active subscription for organization
        
        Creates a trial subscription if none exists
        """
        subscription = self.db.query(Subscription).filter(
            Subscription.organization_id == organization_id,
            Subscription.status.in_(['active', 'trialing'])
        ).first()
        
        if not subscription:
            # Create trial subscription
            subscription = self._create_trial_subscription(organization_id)
        
        return subscription
    
    def _create_trial_subscription(self, organization_id: int) -> Subscription:
        """Create a trial subscription for new organization"""
        trial_end = datetime.utcnow() + timedelta(days=14)  # 14-day trial
        
        subscription = Subscription(
            organization_id=organization_id,
            tier="trial",
            status="trialing",
            trial_end=trial_end,
            current_period_start=datetime.utcnow(),
            current_period_end=trial_end
        )
        
        self.db.add(subscription)
        self.db.commit()
        self.db.refresh(subscription)
        
        return subscription
    
    def upgrade_subscription(
        self,
        organization_id: int,
        new_tier: str,
        payment_method_id: Optional[str] = None
    ) -> Subscription:
        """
        Upgrade subscription to new tier
        
        In production, this would integrate with Stripe
        """
        if new_tier not in SUBSCRIPTION_TIERS:
            raise ValueError(f"Invalid tier: {new_tier}")
        
        subscription = self.get_subscription(organization_id)
        
        # Update subscription
        subscription.tier = new_tier
        subscription.status = "active"
        subscription.trial_end = None
        subscription.current_period_start = datetime.utcnow()
        subscription.current_period_end = datetime.utcnow() + timedelta(days=30)
        
        # In production, would process payment here
        if payment_method_id:
            subscription.stripe_customer_id = f"mock_cus_{organization_id}"
            subscription.stripe_subscription_id = f"mock_sub_{organization_id}"
        
        self.db.commit()
        self.db.refresh(subscription)
        
        return subscription
    
    def cancel_subscription(self, organization_id: int) -> Subscription:
        """
        Cancel subscription at period end
        """
        subscription = self.get_subscription(organization_id)
        
        subscription.cancel_at_period_end = True
        
        self.db.commit()
        self.db.refresh(subscription)
        
        return subscription
    
    def get_tier_limits(self, tier: str) -> Dict[str, Any]:
        """Get usage limits for a tier"""
        if tier not in SUBSCRIPTION_TIERS:
            return SUBSCRIPTION_TIERS["trial"]["limits"]
        
        return SUBSCRIPTION_TIERS[tier]["limits"]
    
    def get_tier_info(self, tier: str) -> Dict[str, Any]:
        """Get full tier information"""
        if tier not in SUBSCRIPTION_TIERS:
            return SUBSCRIPTION_TIERS["trial"]
        
        return SUBSCRIPTION_TIERS[tier]
    
    def check_limit(
        self,
        organization_id: int,
        limit_type: str,
        requested_amount: int = 1
    ) -> tuple[bool, Optional[str]]:
        """
        Check if organization is within usage limits
        
        Returns (allowed, error_message)
        """
        subscription = self.get_subscription(organization_id)
        limits = self.get_tier_limits(subscription.tier)
        
        # Check if trial expired
        if subscription.status == "trialing" and subscription.trial_end:
            if datetime.utcnow() > subscription.trial_end:
                return False, "Trial period has expired. Please upgrade to continue."
        
        # Check subscription status
        if subscription.status in ["canceled", "past_due"]:
            return False, f"Subscription is {subscription.status}. Please update billing."
        
        # Get current usage
        current_usage = self._get_current_usage(organization_id, limit_type)
        limit_value = limits.get(f"max_{limit_type}")
        
        if limit_value == -1:  # unlimited
            return True, None
        
        if current_usage + requested_amount > limit_value:
            return False, f"Limit exceeded: {limit_type} (current: {current_usage}, limit: {limit_value})"
        
        return True, None
    
    def _get_current_usage(self, organization_id: int, usage_type: str) -> int:
        """Get current usage count for a specific type"""
        if usage_type == "projects":
            return self.db.query(func.count(Project.id)).filter(
                Project.organization_id == organization_id
            ).scalar()
        
        elif usage_type == "submissions_per_month":
            start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            return self.db.query(func.count(Submission.id)).join(
                Project, Submission.project_id == Project.id
            ).filter(
                Project.organization_id == organization_id,
                Submission.created_at >= start_of_month
            ).scalar()
        
        elif usage_type == "analysis_per_day":
            start_of_day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            return self.db.query(func.count(AnalysisRun.id)).join(
                Submission, AnalysisRun.submission_id == Submission.id
            ).join(
                Project, Submission.project_id == Project.id
            ).filter(
                Project.organization_id == organization_id,
                AnalysisRun.created_at >= start_of_day
            ).scalar()
        
        elif usage_type == "storage_gb":
            total_bytes = self.db.query(func.sum(File.size)).join(
                Submission, File.submission_id == Submission.id
            ).join(
                Project, Submission.project_id == Project.id
            ).filter(
                Project.organization_id == organization_id
            ).scalar() or 0
            
            return int(total_bytes / (1024 ** 3))  # Convert to GB
        
        elif usage_type == "team_members":
            from app.models import OrganizationMember
            return self.db.query(func.count(OrganizationMember.id)).filter(
                OrganizationMember.organization_id == organization_id
            ).scalar()
        
        elif usage_type == "kb_sources":
            from app.models import KnowledgeSource
            return self.db.query(func.count(KnowledgeSource.id)).filter(
                KnowledgeSource.organization_id == organization_id
            ).scalar()
        
        return 0
    
    def get_usage_stats(self, organization_id: int) -> Dict[str, Any]:
        """
        Get comprehensive usage statistics for organization
        """
        subscription = self.get_subscription(organization_id)
        limits = self.get_tier_limits(subscription.tier)
        
        stats = {
            "subscription": {
                "tier": subscription.tier,
                "status": subscription.status,
                "trial_end": subscription.trial_end.isoformat() if subscription.trial_end else None,
                "current_period_end": subscription.current_period_end.isoformat() if subscription.current_period_end else None,
                "cancel_at_period_end": subscription.cancel_at_period_end
            },
            "usage": {},
            "limits": limits
        }
        
        # Calculate usage for each metric
        for limit_key in limits.keys():
            if limit_key.startswith("max_"):
                usage_type = limit_key[4:]  # Remove "max_" prefix
                current = self._get_current_usage(organization_id, usage_type)
                limit = limits[limit_key]
                
                stats["usage"][usage_type] = {
                    "current": current,
                    "limit": limit,
                    "percentage": (current / limit * 100) if limit > 0 else 0,
                    "remaining": (limit - current) if limit > 0 else -1
                }
        
        return stats
    
    def track_usage_event(
        self,
        organization_id: int,
        event_type: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> UsageEvent:
        """
        Track a usage event for analytics and billing
        
        Event types: submission_created, analysis_run, file_uploaded, api_call, report_generated
        """
        event = UsageEvent(
            organization_id=organization_id,
            event_type=event_type,
            metadata=metadata or {}
        )
        
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        
        return event
    
    def get_usage_history(
        self,
        organization_id: int,
        event_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[UsageEvent]:
        """
        Get usage event history with filters
        """
        query = self.db.query(UsageEvent).filter(
            UsageEvent.organization_id == organization_id
        )
        
        if event_type:
            query = query.filter(UsageEvent.event_type == event_type)
        
        if start_date:
            query = query.filter(UsageEvent.created_at >= start_date)
        
        if end_date:
            query = query.filter(UsageEvent.created_at <= end_date)
        
        return query.order_by(UsageEvent.created_at.desc()).limit(limit).all()
    
    def get_usage_summary(
        self,
        organization_id: int,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, int]:
        """
        Get aggregated usage summary by event type
        """
        query = self.db.query(
            UsageEvent.event_type,
            func.count(UsageEvent.id).label('count')
        ).filter(
            UsageEvent.organization_id == organization_id
        )
        
        if start_date:
            query = query.filter(UsageEvent.created_at >= start_date)
        
        if end_date:
            query = query.filter(UsageEvent.created_at <= end_date)
        
        results = query.group_by(UsageEvent.event_type).all()
        
        return {event_type: count for event_type, count in results}
    
    def check_file_size_limit(
        self,
        organization_id: int,
        file_size_bytes: int
    ) -> tuple[bool, Optional[str]]:
        """
        Check if file size is within tier limits
        """
        subscription = self.get_subscription(organization_id)
        limits = self.get_tier_limits(subscription.tier)
        
        max_size_mb = limits.get("max_file_size_mb", 50)
        file_size_mb = file_size_bytes / (1024 * 1024)
        
        if file_size_mb > max_size_mb:
            return False, f"File size exceeds limit: {file_size_mb:.1f}MB (max: {max_size_mb}MB)"
        
        return True, None
    
    def get_available_tiers(self) -> List[Dict[str, Any]]:
        """
        Get all available subscription tiers with info
        """
        return [
            {
                "id": tier_id,
                **tier_info
            }
            for tier_id, tier_info in SUBSCRIPTION_TIERS.items()
        ]
