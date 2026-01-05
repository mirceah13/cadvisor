"""
CAD Parser Service - Extract metadata from CAD/BIM files
Supports IFC, DXF, DWG (via conversion), and generates SubmissionProfile
"""

import logging
from typing import Dict, Any, Optional
from pathlib import Path
import json
import subprocess
import tempfile
import shutil

logger = logging.getLogger(__name__)


class IFCParser:
    """Parser for IFC (Industry Foundation Classes) files using IfcOpenShell"""
    
    def __init__(self):
        try:
            import ifcopenshell
            import ifcopenshell.util.element as element_util
            import ifcopenshell.util.shape as shape_util
            self.ifcopenshell = ifcopenshell
            self.element_util = element_util
            self.shape_util = shape_util
        except ImportError:
            logger.error("IfcOpenShell not installed. Install with: pip install ifcopenshell")
            raise
    
    def parse(self, file_path: str) -> Dict[str, Any]:
        """
        Parse IFC file and extract building metadata
        
        Args:
            file_path: Path to IFC file
            
        Returns:
            Dictionary with extracted metadata
        """
        try:
            ifc_file = self.ifcopenshell.open(file_path)
            
            # Extract basic info
            project = ifc_file.by_type("IfcProject")[0] if ifc_file.by_type("IfcProject") else None
            
            metadata = {
                "file_schema": ifc_file.schema,
                "project_name": project.Name if project else "Unknown",
                "building": self._extract_building_info(ifc_file),
                "storeys": self._extract_storeys(ifc_file),
                "spaces": self._extract_spaces(ifc_file),
                "elements": self._extract_elements(ifc_file),
                "systems": self._detect_systems(ifc_file),
                "properties": self._extract_properties(ifc_file),
                "quantities": self._calculate_quantities(ifc_file),
            }
            
            logger.info(f"Successfully parsed IFC file: {file_path}")
            return metadata
            
        except Exception as e:
            logger.error(f"Error parsing IFC file: {e}")
            raise
    
    def _extract_building_info(self, ifc_file) -> Dict[str, Any]:
        """Extract building-level information"""
        buildings = ifc_file.by_type("IfcBuilding")
        
        if not buildings:
            return {"found": False}
        
        building = buildings[0]
        
        return {
            "found": True,
            "name": building.Name or "Unnamed",
            "description": building.Description or "",
            "elevation": building.ElevationOfRefHeight if hasattr(building, "ElevationOfRefHeight") else None,
            "address": self._extract_address(building),
        }
    
    def _extract_address(self, building) -> Optional[Dict[str, str]]:
        """Extract building address if available"""
        try:
            if hasattr(building, "BuildingAddress") and building.BuildingAddress:
                addr = building.BuildingAddress
                return {
                    "street": addr.AddressLines[0] if addr.AddressLines else None,
                    "city": addr.Town,
                    "region": addr.Region,
                    "postal_code": addr.PostalCode,
                    "country": addr.Country,
                }
        except Exception:
            pass
        return None
    
    def _extract_storeys(self, ifc_file) -> Dict[str, Any]:
        """Extract building storeys/floors"""
        storeys = ifc_file.by_type("IfcBuildingStorey")
        
        storey_list = []
        for storey in storeys:
            storey_list.append({
                "name": storey.Name or "Unnamed",
                "elevation": storey.Elevation if hasattr(storey, "Elevation") else None,
                "description": storey.Description or "",
            })
        
        return {
            "count": len(storeys),
            "storeys": sorted(storey_list, key=lambda x: x.get("elevation") or 0),
        }
    
    def _extract_spaces(self, ifc_file) -> Dict[str, Any]:
        """Extract spaces/rooms"""
        spaces = ifc_file.by_type("IfcSpace")
        
        space_list = []
        for space in spaces:
            space_list.append({
                "name": space.Name or "Unnamed",
                "long_name": space.LongName if hasattr(space, "LongName") else None,
                "description": space.Description or "",
            })
        
        return {
            "count": len(spaces),
            "spaces": space_list[:50],  # Limit to first 50 for summary
        }
    
    def _extract_elements(self, ifc_file) -> Dict[str, int]:
        """Count different element types"""
        element_types = [
            "IfcWall", "IfcDoor", "IfcWindow", "IfcSlab", "IfcRoof",
            "IfcStair", "IfcRailing", "IfcColumn", "IfcBeam",
            "IfcCovering", "IfcFurnishingElement"
        ]
        
        counts = {}
        for elem_type in element_types:
            elements = ifc_file.by_type(elem_type)
            if elements:
                counts[elem_type.replace("Ifc", "").lower()] = len(elements)
        
        return counts
    
    def _detect_systems(self, ifc_file) -> Dict[str, bool]:
        """Detect building systems presence"""
        systems = {
            "electrical": bool(ifc_file.by_type("IfcElectricAppliance") or 
                             ifc_file.by_type("IfcElectricDistributionBoard")),
            "plumbing": bool(ifc_file.by_type("IfcSanitaryTerminal") or
                           ifc_file.by_type("IfcPipeFitting")),
            "hvac": bool(ifc_file.by_type("IfcAirTerminal") or
                       ifc_file.by_type("IfcDuctFitting")),
            "fire_protection": bool(ifc_file.by_type("IfcFireSuppressionTerminal")),
        }
        
        return systems
    
    def _extract_properties(self, ifc_file) -> Dict[str, Any]:
        """Extract property sets"""
        property_sets = ifc_file.by_type("IfcPropertySet")
        
        properties = {}
        for pset in property_sets[:20]:  # Limit for performance
            pset_name = pset.Name
            if pset_name and pset.HasProperties:
                properties[pset_name] = len(pset.HasProperties)
        
        return {
            "property_sets_count": len(property_sets),
            "sample_property_sets": properties,
        }
    
    def _calculate_quantities(self, ifc_file) -> Dict[str, Any]:
        """Calculate basic quantities"""
        try:
            walls = ifc_file.by_type("IfcWall")
            slabs = ifc_file.by_type("IfcSlab")
            
            # Basic area estimation (simplified)
            total_wall_area = 0
            total_floor_area = 0
            
            # Note: Full quantity calculation requires shape processing
            # This is a simplified version
            
            return {
                "wall_count": len(walls),
                "slab_count": len(slabs),
                "estimated_wall_area_sqm": "requires_shape_processing",
                "estimated_floor_area_sqm": "requires_shape_processing",
            }
        except Exception as e:
            logger.warning(f"Quantity calculation failed: {e}")
            return {}


class DXFParser:
    """Parser for DXF and DWG (AutoCAD Drawing) files using ezdxf"""
    
    def __init__(self):
        try:
            import ezdxf
            self.ezdxf = ezdxf
        except ImportError:
            logger.error("ezdxf not installed. Install with: pip install ezdxf")
            raise
    
    def _convert_dwg_to_dxf(self, dwg_path: str) -> Optional[str]:
        """
        Convert DWG to DXF using LibreDWG's dwg2dxf utility
        
        Args:
            dwg_path: Path to DWG file
            
        Returns:
            Path to converted DXF file, or None if conversion fails
        """
        try:
            # Create temporary DXF file
            temp_dir = tempfile.gettempdir()
            dxf_path = Path(temp_dir) / f"{Path(dwg_path).stem}_converted.dxf"
            
            # Run dwg2dxf conversion
            result = subprocess.run(
                ["dwg2dxf", "-o", str(dxf_path), dwg_path],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0 and dxf_path.exists():
                logger.info(f"Successfully converted DWG to DXF: {dxf_path}")
                return str(dxf_path)
            else:
                logger.error(f"DWG conversion failed: {result.stderr}")
                return None
                
        except subprocess.TimeoutExpired:
            logger.error("DWG conversion timed out after 60 seconds")
            return None
        except FileNotFoundError:
            logger.error("dwg2dxf command not found. Ensure LibreDWG is installed.")
            return None
        except Exception as e:
            logger.error(f"Error converting DWG to DXF: {e}")
            return None
    
    def parse(self, file_path: str) -> Dict[str, Any]:
        """
        Parse DXF or DWG file and extract drawing metadata
        
        Args:
            file_path: Path to DXF or DWG file
            
        Returns:
            Dictionary with extracted metadata
        """
        converted_path = None
        try:
            # Check if file is DWG and needs conversion
            file_ext = Path(file_path).suffix.lower()
            
            if file_ext == '.dwg':
                logger.info(f"DWG file detected, converting to DXF: {file_path}")
                converted_path = self._convert_dwg_to_dxf(file_path)
                
                if not converted_path:
                    return {
                        "error": "DWG conversion failed",
                        "processing_status": "failed",
                        "message": "Could not convert DWG to DXF. File may be corrupt or use unsupported version."
                    }
                
                # Use converted DXF file
                file_path = converted_path
            
            # Parse DXF file with ezdxf (use recovery mode for robustness)
            try:
                doc = self.ezdxf.readfile(file_path)
            except Exception as read_error:
                logger.warning(f"Standard read failed, trying recovery mode: {read_error}")
                # Try recovery mode for malformed DXF files
                from ezdxf import recover
                doc, auditor = recover.readfile(file_path)
                if auditor.has_errors:
                    logger.warning(f"DXF file has {len(auditor.errors)} errors (recovered)")
                # Note: auditor object may not have 'issues' attribute in all ezdxf versions
                logger.info("Successfully recovered DXF file using recovery mode")
            
            metadata = {
                "processing_status": "completed",
                "source_format": "dwg" if file_ext == '.dwg' else "dxf",
                "dxf_version": doc.dxfversion,
                "layers": self._extract_layers(doc),
                "blocks": self._extract_blocks(doc),
                "entities": self._count_entities(doc),
                "text_annotations": self._extract_text(doc),
                "dimensions": self._extract_dimensions(doc),
                "viewport_info": self._extract_viewport_info(doc),
            }
            
            logger.info(f"Successfully parsed CAD file: {file_path}")
            return metadata
            
        except Exception as e:
            logger.error(f"Error parsing CAD file: {e}")
            return {
                "error": str(e),
                "processing_status": "failed"
            }
        finally:
            # Clean up temporary converted file
            if converted_path and Path(converted_path).exists():
                try:
                    Path(converted_path).unlink()
                    logger.debug(f"Cleaned up temporary DXF file: {converted_path}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temporary file: {e}")
    
    def _extract_layers(self, doc) -> Dict[str, Any]:
        """Extract layer information"""
        layers = []
        
        for layer in doc.layers:
            layers.append({
                "name": layer.dxf.name,
                "color": layer.dxf.color,
                "linetype": layer.dxf.linetype,
                "is_locked": layer.is_locked(),
                "is_off": layer.is_off(),
            })
        
        return {
            "count": len(layers),
            "layers": layers,
        }
    
    def _extract_blocks(self, doc) -> Dict[str, Any]:
        """Extract block definitions"""
        blocks = []
        
        for block in doc.blocks:
            if not block.name.startswith("*"):  # Skip anonymous blocks
                blocks.append({
                    "name": block.name,
                    "entity_count": len(block),
                })
        
        return {
            "count": len(blocks),
            "blocks": blocks[:50],  # Limit for summary
        }
    
    def _count_entities(self, doc) -> Dict[str, int]:
        """Count different entity types"""
        msp = doc.modelspace()
        
        entity_counts = {}
        for entity in msp:
            entity_type = entity.dxftype()
            entity_counts[entity_type] = entity_counts.get(entity_type, 0) + 1
        
        return entity_counts
    
    def _extract_text(self, doc) -> Dict[str, Any]:
        """Extract text annotations"""
        msp = doc.modelspace()
        
        texts = []
        for entity in msp.query("TEXT MTEXT"):
            text_content = entity.dxf.text if hasattr(entity.dxf, "text") else str(entity)
            if text_content:
                texts.append({
                    "content": text_content[:100],  # Truncate long text
                    "layer": entity.dxf.layer,
                })
        
        return {
            "count": len(texts),
            "sample_texts": texts[:20],  # First 20 for analysis
        }
    
    def _extract_dimensions(self, doc) -> Dict[str, Any]:
        """Extract dimension entities"""
        msp = doc.modelspace()
        
        dimensions = list(msp.query("DIMENSION"))
        
        return {
            "count": len(dimensions),
            "has_dimensions": len(dimensions) > 0,
        }
    
    def _extract_viewport_info(self, doc) -> Dict[str, Any]:
        """Extract viewport and layout information"""
        layouts = []
        
        for layout in doc.layouts:
            layouts.append({
                "name": layout.name,
                "entity_count": len(layout),
            })
        
        return {
            "layout_count": len(layouts),
            "layouts": layouts,
        }


class DocumentParser:
    """Parser for PDF, DOCX, and other document formats"""
    
    def __init__(self):
        self.pdf_parser = PDFParser()
        self.docx_parser = DOCXParser()
    
    def parse(self, file_path: str, mime_type: str) -> Dict[str, Any]:
        """
        Parse document based on MIME type
        
        Args:
            file_path: Path to document
            mime_type: MIME type of document
            
        Returns:
            Dictionary with extracted content
        """
        if mime_type == "application/pdf":
            return self.pdf_parser.parse(file_path)
        elif "wordprocessing" in mime_type or mime_type == "application/msword":
            return self.docx_parser.parse(file_path)
        elif mime_type == "text/plain":
            return self._parse_text(file_path)
        else:
            return {"error": f"Unsupported document type: {mime_type}"}
    
    def _parse_text(self, file_path: str) -> Dict[str, Any]:
        """Parse plain text file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            return {
                "type": "text",
                "content": content,
                "length": len(content),
                "lines": len(content.split('\n')),
            }
        except Exception as e:
            logger.error(f"Error parsing text file: {e}")
            return {"error": str(e)}


class PDFParser:
    """PDF text extraction"""
    
    def parse(self, file_path: str) -> Dict[str, Any]:
        """Extract text from PDF"""
        try:
            import PyPDF2
            
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                
                # Extract full text from all pages
                full_text = []
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        full_text.append(text)
                
                combined_text = "\n\n".join(full_text)
                
                return {
                    "type": "pdf",
                    "page_count": len(reader.pages),
                    "text": combined_text,
                    "char_count": len(combined_text)
                }
        except Exception as e:
            logger.error(f"Error parsing PDF: {e}")
            return {"error": str(e), "type": "pdf", "text": ""}


class DOCXParser:
    """DOCX document extraction"""
    
    def parse(self, file_path: str) -> Dict[str, Any]:
        """Extract text from DOCX"""
        try:
            import docx
            
            doc = docx.Document(file_path)
            
            # Extract full text from all paragraphs
            paragraphs = []
            for para in doc.paragraphs:
                if para.text.strip():
                    paragraphs.append(para.text)
            
            combined_text = "\n\n".join(paragraphs)
            
            return {
                "type": "docx",
                "paragraph_count": len(doc.paragraphs),
                "text": combined_text,
                "char_count": len(combined_text)
            }
        except Exception as e:
            logger.error(f"Error parsing DOCX: {e}")
            return {"error": str(e), "type": "docx", "text": ""}


class CADParserService:
    """Main service for parsing CAD and document files"""
    
    def __init__(self):
        self.ifc_parser = None
        self.dxf_parser = None
        self.doc_parser = DocumentParser()
    
    def parse_file(self, file_path: str, mime_type: str) -> Dict[str, Any]:
        """
        Parse file based on type
        
        Args:
            file_path: Path to file
            mime_type: MIME type
            
        Returns:
            Parsed metadata
        """
        try:
            # IFC files
            if "ifc" in mime_type.lower() or file_path.endswith('.ifc'):
                if not self.ifc_parser:
                    self.ifc_parser = IFCParser()
                return {"type": "ifc", "data": self.ifc_parser.parse(file_path)}
            
            # DXF and DWG files
            elif "dxf" in mime_type.lower() or file_path.endswith('.dxf'):
                if not self.dxf_parser:
                    self.dxf_parser = DXFParser()
                return {"type": "dxf", "data": self.dxf_parser.parse(file_path)}
            
            elif "dwg" in mime_type.lower() or "acad" in mime_type.lower() or file_path.endswith('.dwg'):
                if not self.dxf_parser:
                    self.dxf_parser = DXFParser()
                return {"type": "dwg", "data": self.dxf_parser.parse(file_path)}
            
            # Documents
            elif mime_type in ["application/pdf", "application/msword", "text/plain"] or \
                 "wordprocessing" in mime_type:
                return {"type": "document", "data": self.doc_parser.parse(file_path, mime_type)}
            
            else:
                return {"type": "unsupported", "mime_type": mime_type}
                
        except Exception as e:
            logger.error(f"Error parsing file {file_path}: {e}")
            return {"type": "error", "error": str(e)}
