"""
Database seeding script - Creates initial demo data
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import logging

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models import (
    User, Organization, OrgMember, Project, Subscription,
    UserRole, OrgMemberStatus, SubscriptionStatus
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def seed_database():
    """Seed database with initial data"""
    db: Session = SessionLocal()
    
    try:
        logger.info("Starting database seeding...")
        
        # Check if demo user exists
        existing_user = db.query(User).filter(User.email == "admin@cadvisor.local").first()
        if existing_user:
            logger.info("Demo data already exists. Skipping seed.")
            return
        
        # Create demo user
        demo_user = User(
            email="admin@cadvisor.local",
            password_hash=get_password_hash("CADVisor2025!"),
            name="Demo Admin",
            is_active=True,
            is_superuser=False,
            email_verified=True,
        )
        db.add(demo_user)
        db.flush()
        logger.info(f"Created demo user: {demo_user.email}")
        
        # Create demo organization
        demo_org = Organization(
            name="Demo Construction Company",
            slug="demo-construction",
            description="Demo organization for testing CADVisor",
        )
        db.add(demo_org)
        db.flush()
        logger.info(f"Created demo organization: {demo_org.name}")
        
        # Add user as owner of org
        membership = OrgMember(
            org_id=demo_org.id,
            user_id=demo_user.id,
            role=UserRole.OWNER,
            status=OrgMemberStatus.ACTIVE,
        )
        db.add(membership)
        logger.info("Added user as owner of demo organization")
        
        # Create subscription (trial)
        subscription = Subscription(
            org_id=demo_org.id,
            provider="mock",
            plan="trial",
            status=SubscriptionStatus.TRIAL,
            trial_ends_at=datetime.utcnow() + timedelta(days=14),
            limits={
                "max_projects": 3,
                "max_submissions_per_month": 10,
                "max_file_size_mb": 50,
                "max_analysis_per_day": 5,
            },
        )
        db.add(subscription)
        logger.info("Created trial subscription")
        
        # Create demo project
        demo_project = Project(
            org_id=demo_org.id,
            name="Sample Residential Project",
            description="Demo project for testing submission analysis",
            building_type="residential",
            created_by=demo_user.id,
        )
        db.add(demo_project)
        logger.info(f"Created demo project: {demo_project.name}")
        
        # Commit all changes
        db.commit()
        
        logger.info("=" * 60)
        logger.info("Database seeding completed successfully!")
        logger.info("=" * 60)
        logger.info("Demo credentials:")
        logger.info("  Email: admin@buildguard.local")
        logger.info("  Password: BuildGuard2025!")
        logger.info("=" * 60)
        logger.info("Access the application at: http://localhost:3000")
        logger.info("API documentation at: http://localhost:8000/docs")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
