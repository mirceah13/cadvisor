"""
Fire Safety Analysis Service
Specialized analyzer for fire safety compliance in CAD files
"""

import logging
import re
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)


class FireSafetyLegendDetector:
    """Detects and parses fire resistance legends in CAD files"""
    
    # Romanian fire resistance legend patterns - flexible matching
    LEGEND_PATTERNS = [
        # Romanian variations - very flexible
        r"legenda.*rezisten[țt]",
        r"rezisten[țt].*legenda",
        r"tabel.*rezisten[țt]",
        r"rezisten[țt].*tabel",
        r"nota.*rezisten[țt]",
        r"rezisten[țt].*nota",
        r"simbol.*rezisten[țt]",
        r"rezisten[țt].*simbol",
        r"legenda.*foc",
        r"foc.*legenda",
        # English variations
        r"legend.*fire.*resistance",
        r"fire.*resistance.*legend",
        r"legend.*fire.*rating",
        r"fire.*rating.*legend",
        r"fire.*protection.*legend",
        # Specific patterns for fire resistance notations
        r"REI\s*[-:=]?\s*\d+",  # REI 120, REI: 120, REI-120, REI=120
        r"R\s*[-:=]?\s*\d+",     # R 60, R: 60, R-60
        r"E\s*[-:=]?\s*\d+",     # E 60
        r"I\s*[-:=]?\s*\d+",     # I 60
        r"EI\s*[-:=]?\s*\d+",    # EI 90, EI-90
        # Romanian specific terms
        r"clasificare.*foc",
        r"protec[țt]ie.*incendiu",
        r"comportare.*la\s*foc",
    ]
    
    # Fire resistance class patterns (Romanian standard)
    RESISTANCE_CLASSES = {
        "REI 120": {"minutes": 120, "type": "Load-bearing + Integrity + Insulation"},
        "REI 90": {"minutes": 90, "type": "Load-bearing + Integrity + Insulation"},
        "REI 60": {"minutes": 60, "type": "Load-bearing + Integrity + Insulation"},
        "REI 45": {"minutes": 45, "type": "Load-bearing + Integrity + Insulation"},
        "REI 30": {"minutes": 30, "type": "Load-bearing + Integrity + Insulation"},
        "REI 15": {"minutes": 15, "type": "Load-bearing + Integrity + Insulation"},
        "EI 120": {"minutes": 120, "type": "Integrity + Insulation"},
        "EI 90": {"minutes": 90, "type": "Integrity + Insulation"},
        "EI 60": {"minutes": 60, "type": "Integrity + Insulation"},
        "EI 45": {"minutes": 45, "type": "Integrity + Insulation"},
        "EI 30": {"minutes": 30, "type": "Integrity + Insulation"},
        "EI 15": {"minutes": 15, "type": "Integrity + Insulation"},
        "R 120": {"minutes": 120, "type": "Load-bearing only"},
        "R 90": {"minutes": 90, "type": "Load-bearing only"},
        "R 60": {"minutes": 60, "type": "Load-bearing only"},
        "R 30": {"minutes": 30, "type": "Load-bearing only"},
    }
    
    def detect_legend(self, cad_metadata: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Detect fire resistance legend in CAD file (DXF, DWG, PDF)
        
        Args:
            cad_metadata: Parsed CAD file metadata
            
        Returns:
            Legend information if found, None otherwise
        """
        logger.info("Starting fire resistance legend detection")
        
        legend_info = {
            "found": False,
            "location": None,
            "elements": [],
            "color_codes": {},
            "text_content": [],
        }
        
        # Check if this is PDF data (has text_content, text_blocks, tables)
        is_pdf = cad_metadata.get("type") == "pdf" or "text_content" in cad_metadata
        
        texts_to_search = []
        
        if is_pdf:
            logger.info("Detected PDF format - searching text_content, text_blocks, and tables")
            
            # Search in main text content
            text_content = cad_metadata.get("text_content", "")
            if text_content:
                texts_to_search.append({"content": text_content, "source": "text_content"})
            
            # Search in text blocks
            text_blocks = cad_metadata.get("text_blocks", [])
            for block in text_blocks:
                if isinstance(block, dict) and "text" in block:
                    texts_to_search.append({
                        "content": block["text"],
                        "source": f"text_block_page_{block.get('page', 'unknown')}"
                    })
            
            # Search in tables
            tables = cad_metadata.get("tables", [])
            for table_idx, table in enumerate(tables):
                if isinstance(table, dict) and "data" in table:
                    # Flatten table data to text
                    for row in table["data"]:
                        if isinstance(row, list):
                            for cell in row:
                                if isinstance(cell, str):
                                    texts_to_search.append({
                                        "content": cell,
                                        "source": f"table_{table_idx}_page_{table.get('page', 'unknown')}"
                                    })
            
            # Also check legends field specifically for PDF
            legends = cad_metadata.get("legends", [])
            for legend in legends:
                if isinstance(legend, dict) and "content" in legend:
                    texts_to_search.append({
                        "content": legend["content"],
                        "source": f"legend_page_{legend.get('page', 'unknown')}"
                    })
        else:
            # DXF/DWG format - use text_annotations
            logger.info("Detected DXF/DWG format - searching text_annotations")
            text_annotations = cad_metadata.get("text_annotations", {})
            sample_texts = text_annotations.get("sample_texts", [])
            
            for idx, text_item in enumerate(sample_texts):
                texts_to_search.append({
                    "content": text_item.get("content", ""),
                    "layer": text_item.get("layer", "unknown"),
                    "source": f"text_annotation_{idx}"
                })
        
        # Search for legend in all collected texts
        for text_item in texts_to_search:
            content = text_item.get("content", "").lower()
            
            # Check if this text matches legend patterns
            for pattern in self.LEGEND_PATTERNS:
                if re.search(pattern, content, re.IGNORECASE):
                    legend_info["found"] = True
                    legend_info["location"] = {
                        "source": text_item.get("source", "unknown"),
                        "layer": text_item.get("layer", "unknown")
                    }
                    legend_info["text_content"].append(text_item.get("content", ""))
                    logger.info(f"Found fire resistance legend in: {text_item.get('source', 'unknown')}")
                    break
            
            if legend_info["found"]:
                break
        
        # Parse fire resistance elements from all text
        legend_info["elements"] = self._parse_resistance_elements_from_texts(texts_to_search)
        
        # Extract color codes from layers (DXF) or color_codes field (PDF)
        if is_pdf:
            color_codes = cad_metadata.get("color_codes", [])
            legend_info["color_codes"] = self._extract_color_codes_from_pdf(color_codes)
        else:
            layers = cad_metadata.get("layers", {}).get("layers", [])
            legend_info["color_codes"] = self._extract_color_codes(layers, legend_info["elements"])
        
        return legend_info if legend_info["found"] or legend_info["elements"] else None
    
    def _parse_resistance_elements_from_texts(self, text_items: List[Dict]) -> List[Dict[str, Any]]:
        """Parse fire resistance elements from texts (unified for PDF and DXF)"""
        elements = []
        
        for text_item in text_items:
            content = text_item.get("content", "")
            
            # Check for each resistance class with flexible patterns
            for class_name, class_info in self.RESISTANCE_CLASSES.items():
                # Create flexible pattern: REI 120, REI-120, REI:120, REI=120, REI120, etc.
                base_class = class_name.split()[0]  # Get REI, EI, or R
                minutes = class_name.split()[1]      # Get the number
                
                # Multiple pattern variations
                patterns = [
                    f"{base_class}\\s*{minutes}",           # REI 120
                    f"{base_class}\\s*[-:=]\\s*{minutes}",  # REI-120, REI:120, REI=120
                    f"{base_class}{minutes}",                # REI120
                    f"{base_class}\\s*\\({minutes}\\)",      # REI(120)
                ]
                
                for pattern in patterns:
                    if re.search(pattern, content, re.IGNORECASE):
                        elements.append({
                            "class": class_name,
                            "minutes": class_info["minutes"],
                            "type": class_info["type"],
                            "found_in": content[:100],
                            "source": text_item.get("source", text_item.get("layer", "unknown"))
                        })
                        break  # Found this class, move to next
        
        # Remove duplicates
        seen = set()
        unique_elements = []
        for elem in elements:
            key = elem["class"]
            if key not in seen:
                seen.add(key)
                unique_elements.append(elem)
        
        return unique_elements
    
    def _parse_resistance_elements(self, text_items: List[Dict]) -> List[Dict[str, Any]]:
        """Parse fire resistance elements from text - flexible matching (legacy DXF method)"""
        elements = []
        
        for text_item in text_items:
            content = text_item.get("content", "")
            
            # Check for each resistance class with flexible patterns
            for class_name, class_info in self.RESISTANCE_CLASSES.items():
                # Create flexible pattern: REI 120, REI-120, REI:120, REI=120, REI120, etc.
                base_class = class_name.split()[0]  # Get REI, EI, or R
                minutes = class_name.split()[1]      # Get the number
                
                # Multiple pattern variations
                patterns = [
                    f"{base_class}\\s*{minutes}",           # REI 120
                    f"{base_class}\\s*[-:=]\\s*{minutes}",  # REI-120, REI:120, REI=120
                    f"{base_class}{minutes}",                # REI120
                    f"{base_class}\\s*\\({minutes}\\)",      # REI(120)
                ]
                
                for pattern in patterns:
                    if re.search(pattern, content, re.IGNORECASE):
                        elements.append({
                            "class": class_name,
                            "minutes": class_info["minutes"],
                            "type": class_info["type"],
                            "found_in": content[:100],
                            "layer": text_item.get("layer", "unknown")
                        })
                        break  # Found this class, move to next
        
        # Remove duplicates
        seen = set()
        unique_elements = []
        for elem in elements:
            key = elem["class"]
            if key not in seen:
                seen.add(key)
                unique_elements.append(elem)
        
        return unique_elements
    
    def _extract_color_codes(self, layers: List[Dict], elements: List[Dict]) -> Dict[str, Any]:
        """Extract color codes associated with fire resistance classes"""
        color_codes = {}
        
        for layer in layers:
            layer_name = layer.get("name", "").lower()
            color = layer.get("color", None)
            
            # Try to match layer name with resistance class
            for elem in elements:
                class_name = elem["class"].replace(" ", "").lower()
                if class_name in layer_name or layer_name in class_name:
                    color_codes[elem["class"]] = {
                        "layer": layer.get("name"),
                        "color": color,
                        "color_name": self._get_color_name(color)
                    }
        
        return color_codes
    
    def _get_color_name(self, color_code: Optional[int]) -> str:
        """Convert AutoCAD color code to name"""
        if color_code is None:
            return "default"
        
        # AutoCAD standard colors
        color_map = {
            1: "red",
            2: "yellow",
            3: "green",
            4: "cyan",
            5: "blue",
            6: "magenta",
            7: "white",
            8: "dark_gray",
            9: "light_gray"
        }
        
        return color_map.get(color_code, f"color_{color_code}")
    
    def _rgb_to_color_name(self, rgb: tuple) -> str:
        """Convert RGB values to a color name (basic mapping)"""
        r, g, b = rgb[0], rgb[1], rgb[2]
        
        # Basic color mapping
        if r > 200 and g < 100 and b < 100:
            return "red"
        elif r > 200 and g > 200 and b < 100:
            return "yellow"
        elif r < 100 and g > 200 and b < 100:
            return "green"
        elif r < 100 and g > 150 and b > 200:
            return "cyan"
        elif r < 100 and g < 100 and b > 200:
            return "blue"
        elif r > 200 and g < 100 and b > 200:
            return "magenta"
        elif r > 200 and g > 200 and b > 200:
            return "white"
        elif r < 100 and g < 100 and b < 100:
            return "black"
        elif r > 150 and g > 100 and b < 100:
            return "orange"
        elif r > 150 and g < 100 and b < 100:
            return "brown"
        else:
            return f"rgb({r},{g},{b})"
    
    def _extract_color_codes_from_pdf(self, color_codes: List[Dict]) -> Dict[str, Any]:
        """Extract color codes from PDF metadata"""
        extracted_colors = {}
        
        # Group colors by frequency
        if color_codes:
            # Sort by percentage (most common first)
            sorted_colors = sorted(color_codes, key=lambda x: x.get('percentage', 0), reverse=True)
            
            # Take top 10 most common colors
            for i, color_info in enumerate(sorted_colors[:10]):
                rgb = color_info.get('rgb', (0, 0, 0))
                percentage = color_info.get('percentage', 0)
                page = color_info.get('page', 'unknown')
                
                color_name = self._rgb_to_color_name(rgb)
                extracted_colors[f"color_{i+1}"] = {
                    "rgb": rgb,
                    "percentage": f"{percentage*100:.1f}%",
                    "color_name": color_name,
                    "page": page
                }
        
        return extracted_colors


class FireSafetyAnalyzer:
    """Comprehensive fire safety analyzer for building submissions"""
    
    def __init__(self):
        self.legend_detector = FireSafetyLegendDetector()
    
    def analyze_fire_safety(
        self,
        submission_profile: Dict[str, Any],
        cad_files_metadata: List[Dict[str, Any]],
        kb_context: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Perform comprehensive fire safety analysis
        
        Args:
            submission_profile: Building submission profile
            cad_files_metadata: List of parsed CAD file metadata
            kb_context: Knowledge base context chunks
            
        Returns:
            Analysis results with findings
        """
        logger.info("Starting comprehensive fire safety analysis")
        
        analysis = {
            "status": "completed",
            "checks_performed": [],
            "findings": [],
            "legend_analysis": [],
            "compliance_summary": {},
        }
        
        # 1. Detect and analyze fire resistance legends
        legend_findings = self._analyze_legends(cad_files_metadata)
        analysis["legend_analysis"] = legend_findings
        analysis["checks_performed"].append("fire_resistance_legend_detection")
        
        # 2. Check compartmentation
        compartment_findings = self._check_fire_compartments(submission_profile, cad_files_metadata)
        analysis["findings"].extend(compartment_findings)
        analysis["checks_performed"].append("fire_compartmentation")
        
        # 3. Check means of egress
        egress_findings = self._check_means_of_egress(submission_profile, cad_files_metadata)
        analysis["findings"].extend(egress_findings)
        analysis["checks_performed"].append("means_of_egress")
        
        # 4. Check fire resistance consistency
        consistency_findings = self._check_resistance_consistency(
            legend_findings,
            cad_files_metadata,
            kb_context
        )
        analysis["findings"].extend(consistency_findings)
        analysis["checks_performed"].append("resistance_consistency")
        
        # 5. Check structural elements fire rating
        structural_findings = self._check_structural_fire_rating(
            submission_profile,
            legend_findings,
            kb_context
        )
        analysis["findings"].extend(structural_findings)
        analysis["checks_performed"].append("structural_fire_rating")
        
        # 6. Check fire separation distances
        separation_findings = self._check_fire_separations(submission_profile, cad_files_metadata)
        analysis["findings"].extend(separation_findings)
        analysis["checks_performed"].append("fire_separations")
        
        # Generate compliance summary
        analysis["compliance_summary"] = self._generate_compliance_summary(analysis["findings"])
        
        logger.info(f"Fire safety analysis completed with {len(analysis['findings'])} findings")
        
        return analysis
    
    def _analyze_legends(self, cad_files_metadata: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Analyze fire resistance legends in all CAD files"""
        legend_findings = []
        
        for file_meta in cad_files_metadata:
            file_name = file_meta.get("file_name", "unknown")
            cad_data = file_meta.get("data", {})
            
            legend_info = self.legend_detector.detect_legend(cad_data)
            
            if legend_info:
                legend_findings.append({
                    "file_name": file_name,
                    "legend_found": legend_info["found"],
                    "location": legend_info.get("location"),
                    "elements": legend_info.get("elements", []),
                    "color_codes": legend_info.get("color_codes", {}),
                    "text_content": legend_info.get("text_content", [])
                })
                
                logger.info(f"Legend analysis for {file_name}: Found {len(legend_info.get('elements', []))} elements")
            else:
                # Create finding for missing legend
                legend_findings.append({
                    "file_name": file_name,
                    "legend_found": False,
                    "issue": "Fire resistance legend not found or incomplete"
                })
        
        return legend_findings
    
    def _check_fire_compartments(
        self,
        profile: Dict[str, Any],
        cad_files: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Check fire compartmentation requirements"""
        findings = []
        
        building = profile.get("building", {})
        floors = building.get("floors", 0)
        area = building.get("area", 0)
        building_type = building.get("type", "unknown")
        
        # Check if compartmentation is required
        if floors > 2 or area > 1000:  # Typical thresholds
            # Look for compartment indicators in CAD
            has_compartmentation = self._detect_compartmentation(cad_files)
            
            if not has_compartmentation:
                findings.append({
                    "severity": "critical",
                    "title": "Missing Fire Compartmentation",
                    "description": f"Building with {floors} floors and {area}m² requires fire compartmentation but none detected in plans.",
                    "location": "Floor plans",
                    "recommendation": "Add fire-rated walls to divide building into compartments according to P118-2025 requirements.",
                    "references": ["P118-2025 Section 2.3", "Fire compartmentation requirements"],
                    "confidence": 0.85
                })
        
        return findings
    
    def _check_means_of_egress(
        self,
        profile: Dict[str, Any],
        cad_files: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Check means of egress and escape routes"""
        findings = []
        
        building = profile.get("building", {})
        floors = building.get("floors", 0)
        
        # Check for stairways in multi-story buildings
        if floors > 1:
            stairs_found = False
            for file_meta in cad_files:
                # Look for stair indicators with multiple Romanian and English variations
                text_annotations = file_meta.get("data", {}).get("text_annotations", {})
                sample_texts = text_annotations.get("sample_texts", [])
                
                # Romanian and English stairway keywords (case-insensitive, flexible)
                stair_keywords = [
                    "scara", "scari", "scarа",  # Romanian (including cyrillic 'а')
                    "stair", "stairs", "stairway", "staircase",  # English
                    "trappa", "treppe",  # Swedish/German
                    "escalier", "escaliers",  # French
                    "scala", "scale",  # Italian
                    "casa da escada",  # Portuguese
                    "caja de escalera",  # Spanish
                    "evac",  # Evacuation (common abbreviation)
                ]
                
                for text in sample_texts:
                    content = text.get("content", "").lower()
                    # Flexible matching - any keyword appearing in content
                    if any(keyword in content for keyword in stair_keywords):
                        stairs_found = True
                        break
                
                if stairs_found:
                    break
            
            if not stairs_found:
                findings.append({
                    "severity": "critical",
                    "title": "Missing Stairways",
                    "description": f"Multi-story building ({floors} floors) must have designated stairways for egress.",
                    "location": "Floor plans",
                    "recommendation": "Add required stairways with proper fire rating according to P118-2025.",
                    "references": ["P118-2025 Section 2.4", "Means of egress requirements"],
                    "confidence": 0.90
                })
        
        return findings
    
    def _check_resistance_consistency(
        self,
        legend_analysis: List[Dict[str, Any]],
        cad_files: List[Dict[str, Any]],
        kb_context: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Check consistency of fire resistance ratings"""
        findings = []
        
        # Check if legend was found
        legends_with_info = [l for l in legend_analysis if l.get("legend_found")]
        
        if not legends_with_info:
            findings.append({
                "severity": "critical",
                "title": "Fire Resistance Legend Missing",
                "description": "No fire resistance legend (\"Legenda rezistenta la foc\") found in any plan. This is required by Romanian fire safety regulations.",
                "location": "All drawings",
                "recommendation": "Add a clear fire resistance legend showing color codes and REI classifications for all building elements.",
                "references": ["P118-2025 Fire Safety Requirements", "Drawing standards for fire safety"],
                "confidence": 0.95
            })
        else:
            # Check for completeness of legend
            for legend in legends_with_info:
                elements = legend.get("elements", [])
                color_codes = legend.get("color_codes", {})
                
                if len(elements) < 3:
                    findings.append({
                        "severity": "warning",
                        "title": "Incomplete Fire Resistance Legend",
                        "description": f"Legend in {legend.get('file_name')} has only {len(elements)} resistance classes. Typical buildings require 3-5 different ratings.",
                        "location": legend.get("file_name"),
                        "recommendation": "Ensure legend includes all fire resistance classes used in the building (REI 120, REI 90, REI 60, etc.).",
                        "references": ["P118-2025 Section 2.3"],
                        "confidence": 0.75
                    })
                
                if not color_codes or len(color_codes) == 0:
                    findings.append({
                        "severity": "warning",
                        "title": "Missing Color Coding in Legend",
                        "description": f"Fire resistance legend in {legend.get('file_name')} does not show color codes for different resistance classes.",
                        "location": legend.get("file_name"),
                        "recommendation": "Add color coding to legend to clearly distinguish between different fire resistance ratings on the plan.",
                        "references": ["Drawing standards"],
                        "confidence": 0.80
                    })
        
        return findings
    
    def _check_structural_fire_rating(
        self,
        profile: Dict[str, Any],
        legend_analysis: List[Dict[str, Any]],
        kb_context: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Check if structural elements have adequate fire rating"""
        findings = []
        
        building = profile.get("building", {})
        floors = building.get("floors", 0)
        building_type = building.get("type", "unknown")
        
        # Determine required fire resistance based on building height/type
        required_rei = self._get_required_fire_resistance(floors, building_type)
        
        # Check if detected elements meet requirements
        for legend in legend_analysis:
            if legend.get("legend_found"):
                elements = legend.get("elements", [])
                
                # Check if any element meets the requirement
                max_resistance = max([e.get("minutes", 0) for e in elements], default=0)
                
                if max_resistance < required_rei:
                    findings.append({
                        "severity": "critical",
                        "title": "Insufficient Fire Resistance Rating",
                        "description": f"Building with {floors} floors requires minimum REI {required_rei} but maximum found is {max_resistance} minutes.",
                        "location": legend.get("file_name"),
                        "recommendation": f"Structural elements must have at least REI {required_rei} fire resistance rating.",
                        "references": ["P118-2025 Table 2.3.1 - Fire resistance requirements"],
                        "confidence": 0.88
                    })
        
        return findings
    
    def _check_fire_separations(
        self,
        profile: Dict[str, Any],
        cad_files: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Check fire separation distances and walls"""
        findings = []
        
        # This would require more sophisticated geometry analysis
        # For now, provide a general check
        
        building = profile.get("building", {})
        if building.get("floors", 0) > 1:
            findings.append({
                "severity": "info",
                "title": "Fire Separation Verification Required",
                "description": "Multi-story building requires verification of fire separation between floors.",
                "location": "Floor plans",
                "recommendation": "Verify that floor slabs and penetrations have proper fire rating according to P118-2025.",
                "references": ["P118-2025 Section 2.3.6"],
                "confidence": 0.70
            })
        
        return findings
    
    def _detect_compartmentation(self, cad_files: List[Dict[str, Any]]) -> bool:
        """Detect if fire compartmentation is present in CAD files"""
        # Romanian and English fire-related keywords for layers and text
        fire_keywords = [
            # Romanian
            "foc", "incendiu", "compartiment", "separare", "protectie",
            # English
            "fire", "compartment", "firewall", "separation", "fire-rated",
            # Resistance notations
            "rei", "ei-", "r-", "fireproof",
        ]
        
        for file_meta in cad_files:
            # Check layers
            layers = file_meta.get("data", {}).get("layers", {}).get("layers", [])
            for layer in layers:
                layer_name = layer.get("name", "").lower()
                if any(keyword in layer_name for keyword in fire_keywords):
                    return True
            
            # Also check text annotations for compartment mentions
            text_annotations = file_meta.get("data", {}).get("text_annotations", {})
            sample_texts = text_annotations.get("sample_texts", [])
            
            compartment_keywords = [
                "compartiment", "compartimentare", "separare", "delimitare"
            ]
            
            for text in sample_texts:
                content = text.get("content", "").lower()
                if any(keyword in content for keyword in compartment_keywords):
                    return True
        
        return False
    
    def _get_required_fire_resistance(self, floors: int, building_type: str) -> int:
        """Determine required fire resistance based on building characteristics"""
        # Based on P118-2025 typical requirements
        if floors >= 10:
            return 120  # REI 120 for high-rise
        elif floors >= 5:
            return 90   # REI 90 for mid-rise
        elif floors >= 3:
            return 60   # REI 60
        elif floors >= 2:
            return 45   # REI 45
        else:
            return 30   # REI 30 for single story
    
    def _generate_compliance_summary(self, findings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate summary of compliance status"""
        critical_count = sum(1 for f in findings if f.get("severity") == "critical")
        warning_count = sum(1 for f in findings if f.get("severity") == "warning")
        info_count = sum(1 for f in findings if f.get("severity") == "info")
        
        status = "compliant" if critical_count == 0 else "non-compliant"
        if warning_count > 0 and critical_count == 0:
            status = "partially_compliant"
        
        return {
            "status": status,
            "total_findings": len(findings),
            "critical": critical_count,
            "warnings": warning_count,
            "info": info_count,
            "compliance_score": max(0, 100 - (critical_count * 30) - (warning_count * 10))
        }
