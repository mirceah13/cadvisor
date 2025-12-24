"""
Projects endpoints - CRUD operations for projects
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from uuid import UUID
from datetime import datetime

from app.core.database import get_db
from app.models import Project, Submission, User, OrgMember
from app.core.security import get_current_user
from pydantic import BaseModel

router = APIRouter()


# Pydantic models for request/response
class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    type: str | None = "building"


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    type: str | None = None


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    building_type: str | None = None
    org_id: UUID
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all projects for the current user's organization"""
    # Get user's organization through OrgMember
    org_member = db.query(OrgMember).filter(
        OrgMember.user_id == current_user.id
    ).first()
    
    if not org_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of any organization"
        )
    
    projects = db.query(Project).filter(
        Project.org_id == org_member.org_id
    ).offset(skip).limit(limit).all()
    
    return projects


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new project"""
    # Get user's organization
    org_member = db.query(OrgMember).filter(
        OrgMember.user_id == current_user.id
    ).first()
    
    if not org_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of any organization"
        )
    
    project = Project(
        name=project_data.name,
        description=project_data.description,
        building_type=project_data.type if hasattr(project_data, 'type') else None,
        org_id=org_member.org_id,
        created_by=current_user.id
    )
    
    db.add(project)
    db.commit()
    db.refresh(project)
    
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific project"""
    # Get user's organization
    org_member = db.query(OrgMember).filter(
        OrgMember.user_id == current_user.id
    ).first()
    
    if not org_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of any organization"
        )
    
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.org_id == org_member.org_id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a project"""
    # Get user's organization
    org_member = db.query(OrgMember).filter(
        OrgMember.user_id == current_user.id
    ).first()
    
    if not org_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of any organization"
        )
    
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.org_id == org_member.org_id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Update fields
    if project_data.name is not None:
        project.name = project_data.name
    if project_data.description is not None:
        project.description = project_data.description
    if project_data.type is not None:
        project.type = project_data.type
    if project_data.status is not None:
        project.status = project_data.status
    
    db.commit()
    db.refresh(project)
    
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a project"""
    # Get user's organization
    org_member = db.query(OrgMember).filter(
        OrgMember.user_id == current_user.id
    ).first()
    
    if not org_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of any organization"
        )
    
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.org_id == org_member.org_id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    db.delete(project)
    db.commit()
    
    return None


@router.get("/{project_id}/submissions")
async def get_project_submissions(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all submissions for a project"""
    # Get user's organization
    org_member = db.query(OrgMember).filter(
        OrgMember.user_id == current_user.id
    ).first()
    
    if not org_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of any organization"
        )
    
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.org_id == org_member.org_id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    submissions = db.query(Submission).filter(
        Submission.project_id == project_id
    ).all()
    
    return submissions
