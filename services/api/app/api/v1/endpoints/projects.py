"""
Projects endpoints - CRUD operations for projects
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.core.database import get_db
from app.models import Project, Submission, User, OrgMember, Finding, AnalysisRun
from app.core.security import get_current_user
from pydantic import BaseModel

router = APIRouter()


# ── Pydantic models ───────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    type: Optional[str] = "building"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    building_type: Optional[str] = None
    org_id: UUID
    created_at: datetime
    updated_at: datetime
    _count: Optional[dict] = None

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────

def _build_project_dict(project: Project, db: Session) -> dict:
    """Serialize a project with submission count and last analysis timestamp."""
    submission_count = db.query(func.count(Submission.id)).filter(
        Submission.project_id == project.id,
        Submission.is_deleted == False,
    ).scalar() or 0

    # Most recent analysis run for any submission in this project
    last_analysis = (
        db.query(AnalysisRun.created_at)
        .join(Submission, AnalysisRun.submission_id == Submission.id)
        .filter(
            Submission.project_id == project.id,
            Submission.is_deleted == False,
            AnalysisRun.status == "completed",
        )
        .order_by(desc(AnalysisRun.created_at))
        .limit(1)
        .scalar()
    )

    # Analyzed submission count
    analyzed_count = db.query(func.count(Submission.id)).filter(
        Submission.project_id == project.id,
        Submission.is_deleted == False,
        Submission.status.in_(["reviewed", "approved"]),
    ).scalar() or 0

    # Also count those that have completed analysis runs even if status not updated
    analyzed_via_runs = db.query(func.count(func.distinct(Submission.id))).join(
        AnalysisRun, AnalysisRun.submission_id == Submission.id
    ).filter(
        Submission.project_id == project.id,
        Submission.is_deleted == False,
        AnalysisRun.status == "completed",
    ).scalar() or 0

    analyzed_count = max(analyzed_count, analyzed_via_runs)

    return {
        "id": str(project.id),
        "name": project.name,
        "description": project.description,
        "building_type": project.building_type,
        "org_id": str(project.org_id),
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat(),
        "last_analysis_at": last_analysis.isoformat() if last_analysis else None,
        "_count": {
            "submissions": submission_count,
            "analyzed": analyzed_count,
        },
    }


def _get_org_or_404(current_user: User, db: Session):
    org_member = db.query(OrgMember).filter(OrgMember.user_id == current_user.id).first()
    if not org_member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User is not a member of any organization")
    return org_member.org_id


# ── Endpoints ─────────────────────────────────────────────────

@router.get("")
async def list_projects(
    skip: int = 0,
    limit: int = Query(default=50, le=100),
    search: Optional[str] = Query(default=None),
    building_type: Optional[str] = Query(default=None),
    sort: str = Query(default="updated_at", regex="^(updated_at|created_at|name|submissions)$"),
    order: str = Query(default="desc", regex="^(asc|desc)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all projects for the current user's organization, with search/filter/sort."""
    org_id = _get_org_or_404(current_user, db)

    q = db.query(Project).filter(
        Project.org_id == org_id,
        Project.is_deleted == False,
    )

    if search:
        q = q.filter(Project.name.ilike(f"%{search}%"))
    if building_type:
        q = q.filter(Project.building_type == building_type)

    if sort == "name":
        col = Project.name
    elif sort == "created_at":
        col = Project.created_at
    else:
        col = Project.updated_at

    if sort != "submissions":
        q = q.order_by(desc(col) if order == "desc" else asc(col))

    projects = q.offset(skip).limit(limit).all()

    result = [_build_project_dict(p, db) for p in projects]

    # Sort by submission count in Python (avoid subquery complexity)
    if sort == "submissions":
        result.sort(key=lambda x: x["_count"]["submissions"], reverse=(order == "desc"))

    return result


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new project"""
    org_id = _get_org_or_404(current_user, db)

    project = Project(
        name=project_data.name,
        description=project_data.description,
        building_type=project_data.type,
        org_id=org_id,
        created_by=current_user.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}")
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific project with counts"""
    org_id = _get_org_or_404(current_user, db)

    project = db.query(Project).filter(
        Project.id == project_id,
        Project.org_id == org_id,
        Project.is_deleted == False,
    ).first()

    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    return _build_project_dict(project, db)


@router.put("/{project_id}")
async def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a project"""
    org_id = _get_org_or_404(current_user, db)

    project = db.query(Project).filter(
        Project.id == project_id,
        Project.org_id == org_id,
        Project.is_deleted == False,
    ).first()

    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if project_data.name is not None:
        project.name = project_data.name
    if project_data.description is not None:
        project.description = project_data.description
    if project_data.type is not None:
        project.building_type = project_data.type  # fixed: was project.type

    db.commit()
    db.refresh(project)
    return _build_project_dict(project, db)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft-delete a project"""
    org_id = _get_org_or_404(current_user, db)

    project = db.query(Project).filter(
        Project.id == project_id,
        Project.org_id == org_id,
        Project.is_deleted == False,
    ).first()

    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    project.is_deleted = True
    project.deleted_at = datetime.utcnow()
    db.commit()
    return None


@router.get("/{project_id}/submissions")
async def get_project_submissions(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all non-deleted submissions for a project with finding counts"""
    org_id = _get_org_or_404(current_user, db)

    project = db.query(Project).filter(
        Project.id == project_id,
        Project.org_id == org_id,
        Project.is_deleted == False,
    ).first()

    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    submissions = db.query(Submission).filter(
        Submission.project_id == project_id,
        Submission.is_deleted == False,
    ).order_by(desc(Submission.created_at)).all()

    result = []
    for sub in submissions:
        finding_count = db.query(func.count(Finding.id)).join(
            AnalysisRun, Finding.analysis_run_id == AnalysisRun.id
        ).filter(AnalysisRun.submission_id == sub.id).scalar() or 0

        result.append({
            "id": str(sub.id),
            "name": sub.name,
            "status": sub.status,
            "created_at": sub.created_at.isoformat(),
            "findings_count": finding_count,
        })

    return result


@router.get("/{project_id}/findings-summary")
async def get_project_findings_summary(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get aggregated finding severity counts across all submissions in a project"""
    org_id = _get_org_or_404(current_user, db)

    project = db.query(Project).filter(
        Project.id == project_id,
        Project.org_id == org_id,
        Project.is_deleted == False,
    ).first()

    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    submission_ids = [
        s.id for s in db.query(Submission.id).filter(
            Submission.project_id == project_id,
            Submission.is_deleted == False,
        ).all()
    ]

    if not submission_ids:
        return {"critical": 0, "high": 0, "medium": 0, "low": 0, "total": 0}

    run_ids = [
        ar.id for ar in db.query(AnalysisRun.id).filter(
            AnalysisRun.submission_id.in_(submission_ids),
            AnalysisRun.status == "completed",
        ).all()
    ]

    if not run_ids:
        return {"critical": 0, "high": 0, "medium": 0, "low": 0, "total": 0}

    def _count(severities):
        return db.query(func.count(Finding.id)).filter(
            Finding.analysis_run_id.in_(run_ids),
            Finding.severity.in_(severities),
        ).scalar() or 0

    critical = _count(["critical"])
    high = _count(["high"])
    medium = _count(["medium", "warning"])
    low = _count(["low", "info"])

    return {
        "critical": critical,
        "high": high,
        "medium": medium,
        "low": low,
        "total": critical + high + medium + low,
    }
