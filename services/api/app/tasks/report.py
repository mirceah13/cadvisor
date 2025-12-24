"""
Report Generation Tasks - Background tasks for generating PDF reports
"""
from celery import shared_task
from celery.utils.log import get_task_logger
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.services.report import ReportService
from app.services.storage import StorageService
from app.models import AnalysisRun, Submission, Project

logger = get_task_logger(__name__)


@shared_task(name="generate_compliance_report", bind=True, max_retries=3)
def generate_compliance_report(
    self,
    analysis_run_id: int,
    organization_id: int,
    report_options: dict = None
):
    """
    Generate compliance report PDF and store in MinIO
    
    Args:
        analysis_run_id: ID of analysis run to report on
        organization_id: Organization ID for access control
        report_options: Report customization options
    
    Returns:
        dict with report details (file_key, url, size)
    """
    db: Session = SessionLocal()
    
    try:
        logger.info(f"Generating report for analysis run {analysis_run_id}")
        
        # Verify analysis run exists and is complete
        analysis_run = db.query(AnalysisRun).filter(
            AnalysisRun.id == analysis_run_id
        ).first()
        
        if not analysis_run:
            raise ValueError(f"Analysis run {analysis_run_id} not found")
        
        if analysis_run.status != 'completed':
            raise ValueError(f"Analysis run {analysis_run_id} is not completed (status: {analysis_run.status})")
        
        # Verify organization access
        submission = db.query(Submission).filter(
            Submission.id == analysis_run.submission_id
        ).first()
        
        project = db.query(Project).filter(
            Project.id == submission.project_id
        ).first()
        
        if project.organization_id != organization_id:
            raise ValueError("Organization access denied")
        
        # Generate report PDF
        report_service = ReportService(db)
        pdf_bytes = report_service.generate_compliance_report(
            analysis_run_id=analysis_run_id,
            organization_id=organization_id,
            options=report_options or {}
        )
        
        logger.info(f"Report PDF generated, size: {len(pdf_bytes)} bytes")
        
        # Store in MinIO
        storage_service = StorageService()
        
        # Generate file key
        timestamp = analysis_run.created_at.strftime("%Y%m%d_%H%M%S")
        file_key = f"org_{organization_id}/reports/analysis_{analysis_run_id}_{timestamp}.pdf"
        
        # Upload to storage
        storage_service.upload_file(
            bucket_name="reports",
            file_key=file_key,
            file_data=pdf_bytes,
            content_type="application/pdf"
        )
        
        logger.info(f"Report uploaded to MinIO: {file_key}")
        
        # Generate presigned URL (valid for 7 days)
        download_url = storage_service.generate_presigned_url(
            bucket_name="reports",
            file_key=file_key,
            expiration=7 * 24 * 60 * 60  # 7 days
        )
        
        return {
            "file_key": file_key,
            "download_url": download_url,
            "size": len(pdf_bytes),
            "status": "completed"
        }
        
    except Exception as e:
        logger.error(f"Error generating report: {str(e)}", exc_info=True)
        
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
        
    finally:
        db.close()


@shared_task(name="generate_batch_reports")
def generate_batch_reports(
    analysis_run_ids: list,
    organization_id: int,
    report_options: dict = None
):
    """
    Generate multiple reports in batch
    
    Args:
        analysis_run_ids: List of analysis run IDs
        organization_id: Organization ID
        report_options: Shared report options
    
    Returns:
        dict with results for each report
    """
    results = {}
    
    for analysis_run_id in analysis_run_ids:
        try:
            result = generate_compliance_report.delay(
                analysis_run_id=analysis_run_id,
                organization_id=organization_id,
                report_options=report_options
            )
            results[analysis_run_id] = {
                "task_id": result.id,
                "status": "queued"
            }
        except Exception as e:
            logger.error(f"Error queuing report for analysis {analysis_run_id}: {str(e)}")
            results[analysis_run_id] = {
                "status": "error",
                "error": str(e)
            }
    
    return results
