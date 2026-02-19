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
        dwg_files = [f for f in files if self._is_dwg(f.mime_type, f.filename)]
        pdf_files = [f for f in files if f.mime_type == "application/pdf"]
        doc_files = [f for f in files if self._is_document(f.mime_type)]
        
        # Build profile
        profile = {
            "submission_id": str(submission_id),
            "submission_name": submission.name,
            "building_type": "unknown",  # Will be extracted from files or user input
            "file_composition": {
                "total_files": len(files),
                "ifc_count": len(ifc_files),
                "dxf_count": len(dxf_files),
                "dwg_count": len(dwg_files),
                "pdf_count": len(pdf_files),
                "doc_count": len(doc_files),
                "has_3d_model": len(ifc_files) > 0,
                "has_2d_drawings": len(dxf_files) > 0 or len(dwg_files) > 0,
            },
            "building": self._extract_building_info(ifc_files, dxf_files + dwg_files),
            "systems": self._detect_systems(ifc_files),
            "elements": self._count_elements(ifc_files),
            "documents": self._categorize_documents(pdf_files, doc_files),
            "completeness": self._assess_completeness(ifc_files, dxf_files + dwg_files, pdf_files, doc_files),
        }
        
        return profile
    
    def _is_ifc(self, mime_type: str, filename: str) -> bool:
        """Check if file is IFC"""
        return "ifc" in mime_type.lower() or filename.lower().endswith('.ifc')
    
    def _is_dxf(self, mime_type: str, filename: str) -> bool:
        """Check if file is DXF"""
        return "dxf" in mime_type.lower() or filename.lower().endswith('.dxf')
    
    def _is_dwg(self, mime_type: str, filename: str) -> bool:
        """Check if file is DWG"""
        return ("dwg" in mime_type.lower() or "acad" in mime_type.lower() or 
                filename.lower().endswith('.dwg'))
    
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
        # Aggregate from parsed file metadata
        building_info = {
            "type": "unknown",
            "floors": 0,
            "total_area_sqm": None,
            "fire_compartments": 0,
            "exits": 0,
            "staircases": 0,
        }
        
        # Extract from IFC files
        for file in ifc_files:
            if file.parsed_metadata and "parsed_data" in file.parsed_metadata:
                parsed = file.parsed_metadata["parsed_data"]
                if parsed.get("type") == "ifc" and "data" in parsed:
                    ifc_data = parsed["data"]
                    
                    # Get building info
                    if "building" in ifc_data:
                        building = ifc_data["building"]
                        if building.get("found"):
                            building_info["name"] = building.get("name")
                            building_info["elevation"] = building.get("elevation")
                    
                    # Get floor count
                    if "storeys" in ifc_data:
                        storeys = ifc_data["storeys"]
                        building_info["floors"] = max(building_info["floors"], storeys.get("count", 0))
                    
                    # Get elements
                    if "elements" in ifc_data:
                        elements = ifc_data["elements"]
                        building_info["exits"] = elements.get("doors", 0)
                        building_info["staircases"] = elements.get("stairs", 0)
        
        # Extract from DXF/DWG files
        for file in dxf_files:
            meta = file.parsed_metadata or {}
            # New flat APS format (no "parsed_data" wrapper)
            if meta.get("aps_extraction") or meta.get("extraction_method"):
                if "layers" in meta:
                    building_info["layers_count"] = meta["layers"].get("count", 0)
                if "entities" in meta:
                    building_info["entities"] = meta["entities"]
                # Structural element counts from new format
                struct = meta.get("structural_elements", {})
                if struct.get("beams"):
                    building_info["beams"] = struct["beams"]
                if struct.get("slabs"):
                    building_info["slabs"] = struct["slabs"]
                # Room count
                rooms = meta.get("rooms", {})
                if rooms.get("count"):
                    building_info["room_count"] = rooms["count"]
                # Fire info
                fire_el = meta.get("fire_elements", {})
                if fire_el.get("count"):
                    building_info["fire_resistance_specs"] = fire_el["count"]
                evac = meta.get("evacuation", [])
                if evac:
                    building_info["evacuation_distances"] = [
                        f"{e['value']} {e['unit']}" for e in evac
                    ]
            # Old nested format
            elif "parsed_data" in meta:
                parsed = meta["parsed_data"]
                if parsed.get("type") in ["dxf", "dwg"] and "data" in parsed:
                    dxf_data = parsed["data"]
                    if "layers" in dxf_data:
                        building_info["layers_count"] = dxf_data["layers"].get("count", 0)
                    if "entities" in dxf_data:
                        building_info["entities"] = dxf_data["entities"]
        
        return building_info
    
    def _detect_systems(self, ifc_files: List[File]) -> Dict[str, bool]:
        """Detect building systems from IFC"""
        systems = {
            "electrical": False,
            "plumbing": False,
            "hvac": False,
            "fire_protection": False,
        }
        
        # Extract from parsed IFC files
        for file in ifc_files:
            if file.parsed_metadata and "parsed_data" in file.parsed_metadata:
                parsed = file.parsed_metadata["parsed_data"]
                if parsed.get("type") == "ifc" and "data" in parsed:
                    ifc_data = parsed["data"]
                    if "systems" in ifc_data:
                        file_systems = ifc_data["systems"]
                        # Merge detected systems
                        for sys_name in systems.keys():
                            if file_systems.get(sys_name):
                                systems[sys_name] = True
        
        return systems
    
    def _count_elements(self, ifc_files: List[File]) -> Dict[str, int]:
        """Count building elements from IFC"""
        elements = {
            "walls": 0,
            "doors": 0,
            "windows": 0,
            "stairs": 0,
            "slabs": 0,
            "beams": 0,
            "columns": 0,
        }
        
        # Extract from parsed IFC files
        for file in ifc_files:
            if file.parsed_metadata and "parsed_data" in file.parsed_metadata:
                parsed = file.parsed_metadata["parsed_data"]
                if parsed.get("type") == "ifc" and "data" in parsed:
                    ifc_data = parsed["data"]
                    if "elements" in ifc_data:
                        file_elements = ifc_data["elements"]
                        # Aggregate counts
                        for elem_name in elements.keys():
                            if elem_name in file_elements:
                                elements[elem_name] += file_elements[elem_name]
        
        return elements
    
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
