from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User
from app.services.subscription import SubscriptionService, SUBSCRIPTION_TIERS

router = APIRouter()


# Request/Response Models
class SubscriptionResponse(BaseModel):
    tier: str
    status: str
    trial_end: Optional[str] = None
    current_period_end: Optional[str] = None
    cancel_at_period_end: bool
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None


class UsageStatsResponse(BaseModel):
    subscription: dict
    usage: dict
    limits: dict


class UpgradeRequest(BaseModel):
    tier: str = Field(..., description="Target tier: trial, pro, enterprise")
    payment_method_id: Optional[str] = Field(None, description="Stripe payment method ID")


class UsageEventCreate(BaseModel):
    event_type: str = Field(..., description="Event type: submission_created, analysis_run, file_uploaded, api_call, report_generated")
    metadata: Optional[dict] = None


class TierInfo(BaseModel):
    id: str
    name: str
    price_monthly: int
    limits: dict
    features: list


@router.get("/subscription", response_model=SubscriptionResponse)
def get_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current subscription details for organization.
    
    Automatically creates trial subscription if none exists.
    """
    service = SubscriptionService(db)
    subscription = service.get_subscription(current_user.organization_id)
    
    return SubscriptionResponse(
        tier=subscription.tier,
        status=subscription.status,
        trial_end=subscription.trial_end.isoformat() if subscription.trial_end else None,
        current_period_end=subscription.current_period_end.isoformat() if subscription.current_period_end else None,
        cancel_at_period_end=subscription.cancel_at_period_end,
        stripe_customer_id=subscription.stripe_customer_id,
        stripe_subscription_id=subscription.stripe_subscription_id
    )


@router.get("/usage", response_model=UsageStatsResponse)
def get_usage_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive usage statistics for organization.
    
    Shows current usage vs limits for all metrics:
    - Projects count
    - Submissions per month
    - Analysis runs per day
    - Storage usage (GB)
    - Team members
    - Knowledge base sources
    """
    service = SubscriptionService(db)
    stats = service.get_usage_stats(current_user.organization_id)
    
    return UsageStatsResponse(**stats)


@router.post("/upgrade")
def upgrade_subscription(
    request: UpgradeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upgrade subscription to a new tier.
    
    For production: Requires payment_method_id for Stripe integration.
    For development: Works with mock payment processing.
    """
    # Verify tier exists
    if request.tier not in SUBSCRIPTION_TIERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tier. Available: {', '.join(SUBSCRIPTION_TIERS.keys())}"
        )
    
    # Get current subscription
    service = SubscriptionService(db)
    current_sub = service.get_subscription(current_user.organization_id)
    
    # Prevent downgrade (would need special handling)
    tier_order = ["trial", "pro", "enterprise"]
    current_idx = tier_order.index(current_sub.tier)
    new_idx = tier_order.index(request.tier)
    
    if new_idx < current_idx:
        raise HTTPException(
            status_code=400,
            detail="Downgrades not supported. Please contact support."
        )
    
    # Check if already on this tier
    if current_sub.tier == request.tier and current_sub.status == "active":
        raise HTTPException(
            status_code=400,
            detail=f"Already subscribed to {request.tier} tier"
        )
    
    # Perform upgrade
    try:
        subscription = service.upgrade_subscription(
            organization_id=current_user.organization_id,
            new_tier=request.tier,
            payment_method_id=request.payment_method_id
        )
        
        # Track upgrade event
        service.track_usage_event(
            organization_id=current_user.organization_id,
            event_type="subscription_upgraded",
            metadata={
                "from_tier": current_sub.tier,
                "to_tier": request.tier,
                "user_id": current_user.id
            }
        )
        
        return {
            "message": f"Successfully upgraded to {request.tier} tier",
            "subscription": SubscriptionResponse(
                tier=subscription.tier,
                status=subscription.status,
                trial_end=subscription.trial_end.isoformat() if subscription.trial_end else None,
                current_period_end=subscription.current_period_end.isoformat() if subscription.current_period_end else None,
                cancel_at_period_end=subscription.cancel_at_period_end,
                stripe_customer_id=subscription.stripe_customer_id,
                stripe_subscription_id=subscription.stripe_subscription_id
            )
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upgrade failed: {str(e)}")


@router.post("/cancel")
def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel subscription at end of current period.
    
    Subscription remains active until period end, then reverts to trial.
    """
    service = SubscriptionService(db)
    subscription = service.cancel_subscription(current_user.organization_id)
    
    # Track cancellation
    service.track_usage_event(
        organization_id=current_user.organization_id,
        event_type="subscription_canceled",
        metadata={"user_id": current_user.id}
    )
    
    return {
        "message": "Subscription will be canceled at period end",
        "subscription": SubscriptionResponse(
            tier=subscription.tier,
            status=subscription.status,
            trial_end=subscription.trial_end.isoformat() if subscription.trial_end else None,
            current_period_end=subscription.current_period_end.isoformat() if subscription.current_period_end else None,
            cancel_at_period_end=subscription.cancel_at_period_end,
            stripe_customer_id=subscription.stripe_customer_id,
            stripe_subscription_id=subscription.stripe_subscription_id
        )
    }


@router.get("/tiers", response_model=list[TierInfo])
def list_tiers():
    """
    Get all available subscription tiers with pricing and features.
    """
    tiers = []
    for tier_id, tier_data in SUBSCRIPTION_TIERS.items():
        tiers.append(TierInfo(
            id=tier_id,
            name=tier_data["name"],
            price_monthly=tier_data["price_monthly"],
            limits=tier_data["limits"],
            features=tier_data["features"]
        ))
    
    return tiers


@router.post("/usage-events")
def track_usage_event(
    event: UsageEventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Track a usage event for analytics and billing.
    
    Event types:
    - submission_created
    - analysis_run
    - file_uploaded
    - api_call
    - report_generated
    """
    service = SubscriptionService(db)
    usage_event = service.track_usage_event(
        organization_id=current_user.organization_id,
        event_type=event.event_type,
        metadata=event.metadata
    )
    
    return {
        "id": usage_event.id,
        "event_type": usage_event.event_type,
        "created_at": usage_event.created_at.isoformat(),
        "message": "Usage event tracked"
    }


@router.get("/usage-history")
def get_usage_history(
    event_type: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(default=100, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get usage event history with optional filters.
    """
    service = SubscriptionService(db)
    events = service.get_usage_history(
        organization_id=current_user.organization_id,
        event_type=event_type,
        start_date=start_date,
        end_date=end_date,
        limit=limit
    )
    
    return {
        "events": [
            {
                "id": e.id,
                "event_type": e.event_type,
                "metadata": e.metadata,
                "created_at": e.created_at.isoformat()
            }
            for e in events
        ],
        "count": len(events)
    }


@router.get("/usage-summary")
def get_usage_summary(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get aggregated usage summary by event type.
    
    Returns counts for each event type in the specified time range.
    """
    service = SubscriptionService(db)
    summary = service.get_usage_summary(
        organization_id=current_user.organization_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return {
        "summary": summary,
        "total_events": sum(summary.values())
    }


@router.get("/check-limit/{limit_type}")
def check_limit(
    limit_type: str,
    amount: int = Query(default=1, ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check if organization is within usage limits.
    
    Limit types:
    - projects
    - submissions_per_month
    - analysis_per_day
    - storage_gb
    - team_members
    - kb_sources
    """
    service = SubscriptionService(db)
    allowed, error_message = service.check_limit(
        organization_id=current_user.organization_id,
        limit_type=limit_type,
        requested_amount=amount
    )
    
    if not allowed:
        return {
            "allowed": False,
            "error": error_message
        }
    
    return {
        "allowed": True,
        "message": f"Within limits for {limit_type}"
    }

