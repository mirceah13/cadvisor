"""
Analysis Celery Tasks
Handles async compliance analysis
"""

import logging
from uuid import UUID
from typing import Dict, Any, Optional, List
import asyncio

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models import Submission, AnalysisRun
from app.services.analysis import AnalysisEngine
from app.tasks.cad import DatabaseTask

logger = logging.getLogger(__name__)


@celery_app.task(
    name="run_compliance_analysis",
    base=DatabaseTask,
    bind=True,
    max_retries=1,
    default_retry_delay=300,
    time_limit=600  # 10 minutes
)
def run_compliance_analysis(
    self,
    submission_id: str,
    ruleset_ids: Optional[List[str]] = None,
    check_types: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Run compliance analysis on submission
    
    Args:
        submission_id: Submission UUID as string
        ruleset_ids: Optional ruleset UUIDs
        check_types: Optional specific checks to run
        
    Returns:
        Dict with analysis results
    """
    submission_uuid = UUID(submission_id)
    db = self.db
    
    logger.info(f"Starting compliance analysis for submission_id={submission_id}")
    
    try:
        # Get submission
        submission = db.query(Submission).filter(
            Submission.id == submission_uuid
        ).first()
        
        if not submission:
            raise ValueError(f"Submission {submission_id} not found")
        
        # Convert ruleset_ids if provided
        ruleset_uuids = None
        if ruleset_ids:
            ruleset_uuids = [UUID(rid) for rid in ruleset_ids]
        
        # Run analysis
        engine = AnalysisEngine(db)
        
        # Run async analysis in sync context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            analysis_run = loop.run_until_complete(
                engine.analyze_submission(
                    submission_id=submission_uuid,
                    ruleset_ids=ruleset_uuids,
                    check_types=check_types
                )
            )
        finally:
            loop.close()
        
        # Get findings count by severity
        findings = engine.get_findings(submission_uuid, analysis_run.id)
        
        findings_by_severity = {
            "critical": sum(1 for f in findings if f.severity == "critical"),
            "warning": sum(1 for f in findings if f.severity == "warning"),
            "info": sum(1 for f in findings if f.severity == "info")
        }
        
        logger.info(
            f"Analysis completed for submission {submission_id}: "
            f"{findings_by_severity['critical']} critical, "
            f"{findings_by_severity['warning']} warnings, "
            f"{findings_by_severity['info']} info"
        )
        
        return {
            "success": True,
            "submission_id": submission_id,
            "analysis_run_id": str(analysis_run.id),
            "status": analysis_run.status,
            "findings_count": len(findings),
            "findings_by_severity": findings_by_severity,
            "checks_completed": analysis_run.config.get("checks_completed", []) if analysis_run.config else []
        }
    
    except Exception as e:
        logger.error(f"Error analyzing submission {submission_id}: {e}", exc_info=True)
        try:
            db.rollback()
        except Exception:
            pass

        # Retry on transient errors
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)

        return {
            "success": False,
            "submission_id": submission_id,
            "error": str(e)
        }


@celery_app.task(name="reanalyze_submission")
def reanalyze_submission(submission_id: str) -> Dict[str, Any]:
    """
    Rerun analysis on submission
    
    Args:
        submission_id: Submission UUID as string
        
    Returns:
        Task info
    """
    # Queue new analysis
    task = run_compliance_analysis.delay(submission_id)
    
    logger.info(f"Queued reanalysis for submission {submission_id}, task_id={task.id}")
    
    return {
        "success": True,
        "submission_id": submission_id,
        "task_id": task.id
    }
