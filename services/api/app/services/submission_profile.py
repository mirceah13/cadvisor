"""
Submission Profile Generator
Creates normalized JSON profile from parsed CAD and document files
"""

import logging
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy.orm import Session

from app.models import Submission, File
from app.services.cad_parser import CADParserService

logger = logging.getLogger(__name__)


class SubmissionProfileGenerator:
    """Generates comprehensive submission profile from files"""
    
    def __init__(self, db: Session):
        self.db = db
        self.parser = CADParserService()
    
    def generate_profile(self, submission_id: UUID) -> Dict[str, Any]:
        """
        Generate complete submission profile
        
        Args:
            submission_id: Submission UUID
            
        Returns:
            SubmissionProfile dictionary
        """
        submission = self.db.query(Submission).filter(
            Submission.id == submission_id
        ).first()
        
        if not submission:
            raise ValueError(f"Submission {submission_id} not found")
        
        # Get all files for this submission
        files = self.db.query(File).filter(
            File.submission_id == submission_id,
            File.deleted_at.is_(None)
        ).all()
        
        # Categorize files
        ifc_files = [f for f in files if self._is_ifc(f.mime_type, f.filename)]
        dxf_files = [f for f in files if self._is_dxf(f.mime_type, f.filename)]
        pdf_files = [f for f in files if f.mime_type == "application/pdf"]
        doc_files = [f for f in files if self._is_document(f.mime_type)]
        
        # Build profile
        profile = {
            "submission_id": str(submission_id),
            "submission_name": submission.name,
            "building_type": submission.building_type,
            "file_composition": {
                "total_files": len(files),
                "ifc_count": len(ifc_files),
                "dxf_count": len(dxf_files),
                "pdf_count": len(pdf_files),
                "doc_count": len(doc_files),
                "has_3d_model": len(ifc_files) > 0,
                "has_2d_drawings": len(dxf_files) > 0,
            },
            "building": self._extract_building_info(ifc_files, dxf_files),
            "systems": self._detect_systems(ifc_files),
            "elements": self._count_elements(ifc_files),
            "documents": self._categorize_documents(pdf_files, doc_files),
            "completeness": self._assess_completeness(ifc_files, dxf_files, pdf_files, doc_files),
        }
        
        return profile
    
    def _is_ifc(self, mime_type: str, filename: str) -> bool:
        """Check if file is IFC"""
        return "ifc" in mime_type.lower() or filename.lower().endswith('.ifc')
    
    def _is_dxf(self, mime_type: str, filename: str) -> bool:
        """Check if file is DXF"""
        return "dxf" in mime_type.lower() or filename.lower().endswith('.dxf')
    
    def _is_document(self, mime_type: str) -> bool:
        """Check if file is a document"""
        return mime_type in [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain"
        ]
    
    def _extract_building_info(self, ifc_files: List[File], dxf_files: List[File]) -> Dict[str, Any]:
        """Extract building information from CAD files"""
        # Prefer IFC data
        if ifc_files:
            # TODO: Parse IFC files from storage
            # For now, return placeholder
            return {
                "source": "ifc",
                "type": "unknown",
                "floors": 0,
                "total_area_sqm": None,
                "fire_compartments": 0,
                "exits": 0,
                "staircases": 0,
                "status": "parsing_required"
            }
        elif dxf_files:
            return {
                "source": "dxf",
                "type": "unknown",
                "layers_count": 0,
                "status": "parsing_required"
            }
        else:
            return {
                "source": "none",
                "status": "no_cad_files"
            }
    
    def _detect_systems(self, ifc_files: List[File]) -> Dict[str, bool]:
        """Detect building systems from IFC"""
        if not ifc_files:
            return {
                "electrical": False,
                "plumbing": False,
                "hvac": False,
                "fire_protection": False,
                "status": "no_ifc_files"
            }
        
        return {
            "electrical": False,
            "plumbing": False,
            "hvac": False,
            "fire_protection": False,
            "status": "parsing_required"
        }
    
    def _count_elements(self, ifc_files: List[File]) -> Dict[str, int]:
        """Count building elements from IFC"""
        if not ifc_files:
            return {}
        
        return {
            "walls": 0,
            "doors": 0,
            "windows": 0,
            "stairs": 0,
            "status": "parsing_required"
        }
    
    def _categorize_documents(self, pdf_files: List[File], doc_files: List[File]) -> Dict[str, Any]:
        """Categorize supporting documents"""
        document_categories = {
            "permits": [],
            "structural": [],
            "mep": [],
            "fire_safety": [],
            "accessibility": [],
            "other": []
        }
        
        # Categorize based on filename keywords
        for file in pdf_files + doc_files:
            filename_lower = file.filename.lower()
            
            if any(kw in filename_lower for kw in ["permit", "application", "approval"]):
                document_categories["permits"].append(file.filename)
            elif any(kw in filename_lower for kw in ["structural", "engineer", "beam", "column"]):
                document_categories["structural"].append(file.filename)
            elif any(kw in filename_lower for kw in ["mep", "mechanical", "electrical", "plumbing"]):
                document_categories["mep"].append(file.filename)
            elif any(kw in filename_lower for kw in ["fire", "safety", "sprinkler", "alarm"]):
                document_categories["fire_safety"].append(file.filename)
            elif any(kw in filename_lower for kw in ["accessibility", "ada", "barrier"]):
                document_categories["accessibility"].append(file.filename)
            else:
                document_categories["other"].append(file.filename)
        
        return document_categories
    
    def _assess_completeness(
        self,
        ifc_files: List[File],
        dxf_files: List[File],
        pdf_files: List[File],
        doc_files: List[File]
    ) -> Dict[str, Any]:
        """Assess submission completeness"""
        checks = {
            "has_3d_model": len(ifc_files) > 0,
            "has_2d_drawings": len(dxf_files) > 0,
            "has_documents": len(pdf_files) + len(doc_files) > 0,
            "has_permit_docs": False,  # Will be set by document categorization
            "has_structural_docs": False,
        }
        
        # Calculate completeness score
        score = sum(1 for v in checks.values() if v) / len(checks) * 100
        
        return {
            "score": round(score, 1),
            "checks": checks,
            "missing": [k for k, v in checks.items() if not v],
        }
