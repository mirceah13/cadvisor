from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import io

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, AnalysisRun, Submission, Project
from app.services.report import ReportService
from app.services.storage import StorageService
from app.tasks.report import generate_compliance_report

router = APIRouter()


# Request/Response Models
class ReportOptions(BaseModel):
    include_summary: bool = Field(default=True, description="Include executive summary")
    include_findings: bool = Field(default=True, description="Include detailed findings")
    include_recommendations: bool = Field(default=True, description="Include recommendations")
    include_metadata: bool = Field(default=True, description="Include submission metadata")
    include_statistics: bool = Field(default=True, description="Include statistics")
    finding_statuses: Optional[List[str]] = Field(default=None, description="Filter by finding statuses")
    severity_levels: Optional[List[str]] = Field(default=None, description="Filter by severity levels")
    page_size: str = Field(default="letter", description="Page size: 'letter' or 'a4'")


class ReportGenerateRequest(BaseModel):
    analysis_run_id: int
    options: Optional[ReportOptions] = None
    async_generation: bool = Field(default=True, description="Generate asynchronously")


class ReportGenerateResponse(BaseModel):
    task_id: Optional[str] = None
    status: str
    message: str
    download_url: Optional[str] = None


class BatchReportRequest(BaseModel):
    analysis_run_ids: List[int] = Field(..., min_items=1)
    options: Optional[ReportOptions] = None


@router.post("/generate", response_model=ReportGenerateResponse)
def generate_report(
    request: ReportGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate compliance report for an analysis run.
    
    Can generate synchronously (immediate download) or asynchronously (task-based).
    For large reports with many findings, async generation is recommended.
    """
    # Verify analysis run exists and user has access
    analysis_run = db.query(AnalysisRun).filter(
        AnalysisRun.id == request.analysis_run_id
    ).first()
    
    if not analysis_run:
        raise HTTPException(status_code=404, detail="Analysis run not found")
    
    if analysis_run.status != 'completed':
        raise HTTPException(
            status_code=400,
            detail=f"Analysis run is not completed (status: {analysis_run.status})"
        )
    
    # Check organization access
    submission = db.query(Submission).filter(
        Submission.id == analysis_run.submission_id
    ).first()
    
    project = db.query(Project).filter(Project.id == submission.project_id).first()
    if not project or project.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Prepare report options
    options_dict = request.options.dict() if request.options else {}
    
    if request.async_generation:
        # Generate asynchronously using Celery
        task = generate_compliance_report.delay(
            analysis_run_id=request.analysis_run_id,
            organization_id=current_user.organization_id,
            report_options=options_dict
        )
        
        return ReportGenerateResponse(
            task_id=task.id,
            status="queued",
            message="Report generation started. Check task status for completion."
        )
    else:
        # Generate synchronously (for small reports)
        try:
            report_service = ReportService(db)
            pdf_bytes = report_service.generate_compliance_report(
                analysis_run_id=request.analysis_run_id,
                organization_id=current_user.organization_id,
                options=options_dict
            )
            
            # Return PDF directly
            filename = f"compliance_report_{request.analysis_run_id}.pdf"
            
            return StreamingResponse(
                io.BytesIO(pdf_bytes),
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@router.get("/task/{task_id}")
def get_report_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get status of a report generation task.
    
    Returns task status and download URL when complete.
    """
    from celery.result import AsyncResult
    
    task = AsyncResult(task_id)
    
    if task.state == 'PENDING':
        return {
            "task_id": task_id,
            "status": "pending",
            "message": "Task is queued or not found"
        }
    elif task.state == 'STARTED':
        return {
            "task_id": task_id,
            "status": "processing",
            "message": "Report generation in progress"
        }
    elif task.state == 'SUCCESS':
        result = task.result
        return {
            "task_id": task_id,
            "status": "completed",
            "download_url": result.get("download_url"),
            "file_key": result.get("file_key"),
            "size": result.get("size"),
            "message": "Report generated successfully"
        }
    elif task.state == 'FAILURE':
        return {
            "task_id": task_id,
            "status": "failed",
            "error": str(task.info),
            "message": "Report generation failed"
        }
    else:
        return {
            "task_id": task_id,
            "status": task.state.lower(),
            "message": f"Task state: {task.state}"
        }


@router.get("/download/{analysis_run_id}")
def download_report(
    analysis_run_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Download the most recent report for an analysis run.
    
    Searches MinIO for existing report and returns download URL.
    If no report exists, returns 404.
    """
    # Verify analysis run exists and user has access
    analysis_run = db.query(AnalysisRun).filter(
        AnalysisRun.id == analysis_run_id
    ).first()
    
    if not analysis_run:
        raise HTTPException(status_code=404, detail="Analysis run not found")
    
    # Check organization access
    submission = db.query(Submission).filter(
        Submission.id == analysis_run.submission_id
    ).first()
    
    project = db.query(Project).filter(Project.id == submission.project_id).first()
    if not project or project.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Look for report in MinIO
    storage_service = StorageService()
    
    # Check standard location
    timestamp = analysis_run.created_at.strftime("%Y%m%d_%H%M%S")
    file_key = f"org_{current_user.organization_id}/reports/analysis_{analysis_run_id}_{timestamp}.pdf"
    
    try:
        # Generate presigned download URL
        download_url = storage_service.generate_presigned_url(
            bucket_name="reports",
            file_key=file_key,
            expiration=3600  # 1 hour
        )
        
        return {
            "download_url": download_url,
            "file_key": file_key,
            "message": "Report available for download"
        }
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail="Report not found. Generate a new report first."
        )


@router.post("/batch-generate")
def batch_generate_reports(
    request: BatchReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate multiple reports in batch.
    
    Queues report generation tasks for multiple analysis runs.
    """
    if len(request.analysis_run_ids) > 50:
        raise HTTPException(
            status_code=400,
            detail="Maximum 50 reports per batch"
        )
    
    # Verify all analysis runs exist and user has access
    for analysis_run_id in request.analysis_run_ids:
        analysis_run = db.query(AnalysisRun).filter(
            AnalysisRun.id == analysis_run_id
        ).first()
        
        if not analysis_run:
            raise HTTPException(
                status_code=404,
                detail=f"Analysis run {analysis_run_id} not found"
            )
        
        submission = db.query(Submission).filter(
            Submission.id == analysis_run.submission_id
        ).first()
        
        project = db.query(Project).filter(Project.id == submission.project_id).first()
        if not project or project.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Queue batch generation
    from app.tasks.report import generate_batch_reports
    
    options_dict = request.options.dict() if request.options else {}
    
    result = generate_batch_reports.delay(
        analysis_run_ids=request.analysis_run_ids,
        organization_id=current_user.organization_id,
        report_options=options_dict
    )
    
    return {
        "batch_task_id": result.id,
        "report_count": len(request.analysis_run_ids),
        "status": "queued",
        "message": f"Queued {len(request.analysis_run_ids)} reports for generation"
    }


@router.get("/list")
def list_reports(
    project_id: Optional[int] = Query(None),
    limit: int = Query(default=20, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List available reports for the organization.
    
    Optionally filter by project.
    """
    # Build query
    query = db.query(AnalysisRun).join(
        Submission, AnalysisRun.submission_id == Submission.id
    ).join(
        Project, Submission.project_id == Project.id
    ).filter(
        Project.organization_id == current_user.organization_id,
        AnalysisRun.status == 'completed'
    )
    
    if project_id:
        # Verify project access
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project or project.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        query = query.filter(Project.id == project_id)
    
    # Get analysis runs
    analysis_runs = query.order_by(AnalysisRun.created_at.desc()).limit(limit).all()
    
    # Build response
    reports = []
    storage_service = StorageService()
    
    for run in analysis_runs:
        submission = db.query(Submission).filter(Submission.id == run.submission_id).first()
        project = db.query(Project).filter(Project.id == submission.project_id).first()
        
        # Check if report exists
        timestamp = run.created_at.strftime("%Y%m%d_%H%M%S")
        file_key = f"org_{current_user.organization_id}/reports/analysis_{run.id}_{timestamp}.pdf"
        
        report_exists = False
        try:
            storage_service.generate_presigned_url("reports", file_key, 60)
            report_exists = True
        except:
            pass
        
        reports.append({
            "analysis_run_id": run.id,
            "submission_name": submission.name,
            "project_name": project.name,
            "analysis_date": run.created_at.isoformat(),
            "report_exists": report_exists,
            "file_key": file_key if report_exists else None
        })
    
    return {
        "reports": reports,
        "count": len(reports)
    }
