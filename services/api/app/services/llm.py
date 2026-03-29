"""
LLM Service
Handles LLM interactions via Ollama
"""

import logging
import httpx
from typing import List, Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMService:
    """Service for interacting with Ollama LLM"""
    
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = "llama3.2:3b"  # Default model
        self.timeout = 300.0  # 5 minutes for complex queries
    
    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 2000,
        system_prompt: Optional[str] = None
    ) -> Optional[str]:
        """
        Generate text completion from LLM
        
        Args:
            prompt: User prompt
            model: Model name (default: llama3.2)
            temperature: Sampling temperature (0.0-1.0)
            max_tokens: Maximum tokens to generate
            system_prompt: System instructions
            
        Returns:
            Generated text or None on error
        """
        model = model or self.model
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                payload = {
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens
                    }
                }
                
                if system_prompt:
                    payload["system"] = system_prompt
                
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json=payload
                )
                response.raise_for_status()
                
                data = response.json()
                generated_text = data.get("response", "")
                
                logger.info(f"Generated {len(generated_text)} chars from {model}")
                return generated_text
                
        except httpx.TimeoutException:
            logger.error(f"Timeout generating completion (model={model})")
            return None
        except httpx.HTTPError as e:
            logger.error(f"HTTP error during generation: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during generation: {e}", exc_info=True)
            return None
    
    async def generate_with_context(
        self,
        query: str,
        context_chunks: List[Dict[str, Any]],
        system_prompt: str,
        temperature: float = 0.1,
        image_context: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[str]:
        """
        Generate completion with RAG context (text chunks + optional image evidence).
        """
        # Build text context
        context_parts = []
        for i, chunk in enumerate(context_chunks, 1):
            source = chunk.get("source", {})
            content = chunk.get("content", "")
            context_parts.append(
                f"[Regulation {i} — {source.get('title', 'Unknown')}]\n{content}\n"
            )

        context_str = "\n".join(context_parts)

        # Build image context section (OCR text from relevant diagrams)
        image_section = ""
        if image_context:
            img_parts = []
            for j, img in enumerate(image_context, 1):
                ocr = (img.get("ocr_text") or "").strip()
                source_title = img.get("source", {}).get("title", "Unknown")
                similarity = img.get("similarity", 0)
                if ocr:
                    img_parts.append(
                        f"[Figure {j} from '{source_title}' (relevance {similarity:.0%})]\n"
                        f"Text extracted from diagram: {ocr}"
                    )
                else:
                    img_parts.append(
                        f"[Figure {j} from '{source_title}' (relevance {similarity:.0%})]\n"
                        f"(Diagram present but no readable text extracted)"
                    )
            if img_parts:
                image_section = (
                    "\n\nRelevant technical diagrams and figures from the regulations:\n\n"
                    + "\n\n".join(img_parts)
                )

        # Build prompt with context
        prompt = f"""Regulatory text context:

{context_str}{image_section}

Query: {query}

Based on the regulatory text and diagram evidence above, provide a detailed compliance analysis. Reference specific regulation sections and figures where applicable."""

        return await self.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=2000,
        )
    
    async def analyze_compliance(
        self,
        submission_profile: Dict[str, Any],
        check_type: str,
        context_chunks: List[Dict[str, Any]],
        image_context: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Analyze submission for compliance using text + visual RAG context.
        """
        system_prompt = (
            "You are a senior building code compliance engineer specialising in Romanian and European "
            "construction regulations. Analyse building submissions against the provided regulatory "
            "excerpts and technical diagrams.\n\n"
            "Be precise and cite specific articles, sections, or figures from the context. "
            "Classify each finding by severity:\n"
            "- CRITICAL: Life safety violations or mandatory code requirements not met\n"
            "- WARNING: Probable non-compliance or items requiring confirmation\n"
            "- INFO: Best-practice recommendations and observations\n\n"
            "When relevant diagrams are provided, reference them (e.g. 'as shown in Figure 2'). "
            "Format your response as a numbered list of findings, each starting with its severity."
        )

        # Extract key metrics from profile
        building = submission_profile.get("building", {})
        elements = submission_profile.get("elements", {})
        systems = submission_profile.get("systems", {})

        query = (
            f"Perform a detailed {check_type} compliance review for this building submission:\n\n"
            f"Building Type: {building.get('type', 'Unknown')}\n"
            f"Number of Floors: {building.get('floors', 'N/A')}\n"
            f"Total Area: {building.get('total_area_sqm', 'N/A')} m²\n"
            f"Fire Compartments: {building.get('fire_compartments', 'N/A')}\n"
            f"Exits / Egress points: {building.get('exits', 'N/A')}\n\n"
            f"Structural Elements:\n"
            f"  - Walls: {elements.get('walls', 0)}\n"
            f"  - Doors: {elements.get('doors', 0)}\n"
            f"  - Windows: {elements.get('windows', 0)}\n"
            f"  - Stairs / Staircases: {elements.get('stairs', 0)}\n\n"
            f"Building Systems:\n"
            f"  - Electrical: {systems.get('electrical', False)}\n"
            f"  - Plumbing: {systems.get('plumbing', False)}\n"
            f"  - HVAC: {systems.get('hvac', False)}\n"
            f"  - Fire Protection (sprinklers/detection): {systems.get('fire_protection', False)}\n\n"
            f"List every compliance issue found, with severity, specific regulation reference, "
            f"affected element, and recommended corrective action."
        )

        response = await self.generate_with_context(
            query=query,
            context_chunks=context_chunks,
            system_prompt=system_prompt,
            temperature=0.1,
            image_context=image_context,
        )

        if not response:
            return {"success": False, "error": "Failed to generate analysis"}

        findings = self._parse_findings(response, check_type)

        return {
            "success": True,
            "check_type": check_type,
            "findings": findings,
            "raw_response": response,
            "context_sources": [c.get("source", {}) for c in context_chunks],
            "image_sources": [
                {"source": img.get("source", {}), "image_index": img.get("image_index")}
                for img in (image_context or [])
            ],
        }
    
    def _parse_findings(self, response: str, check_type: str) -> List[Dict[str, Any]]:
        """Parse LLM response into structured findings"""
        findings = []
        
        # Simple parsing - look for severity keywords
        lines = response.split('\n')
        current_finding = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Detect severity markers
            severity = None
            if 'CRITICAL' in line.upper():
                severity = 'critical'
            elif 'WARNING' in line.upper():
                severity = 'warning'
            elif 'INFO' in line.upper() or 'RECOMMENDATION' in line.upper():
                severity = 'info'
            
            if severity:
                # Start new finding
                if current_finding:
                    findings.append(current_finding)
                
                current_finding = {
                    "severity": severity,
                    "check_type": check_type,
                    "title": line,
                    "description": "",
                    "references": []
                }
            elif current_finding:
                # Add to description
                current_finding["description"] += line + " "
                
                # Extract references (e.g., "IBC 1011.1")
                if any(code in line for code in ['IBC', 'IRC', 'NFPA', 'ADA', 'Section']):
                    current_finding["references"].append(line)
        
        # Add last finding
        if current_finding:
            findings.append(current_finding)
        
        # If no structured findings found, create generic one
        if not findings:
            findings.append({
                "severity": "info",
                "check_type": check_type,
                "title": f"{check_type} Analysis Complete",
                "description": response[:500],
                "references": []
            })
        
        return findings
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7
    ) -> Optional[str]:
        """
        Chat completion with message history
        
        Args:
            messages: List of {"role": "user/assistant", "content": "..."}
            model: Model name
            temperature: Sampling temperature
            
        Returns:
            Assistant response
        """
        model = model or self.model
        
        # Build prompt from messages
        prompt_parts = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            
            if role == "user":
                prompt_parts.append(f"User: {content}")
            elif role == "assistant":
                prompt_parts.append(f"Assistant: {content}")
            elif role == "system":
                # System messages become part of prompt
                prompt_parts.append(content)
        
        prompt = "\n\n".join(prompt_parts) + "\n\nAssistant:"
        
        return await self.generate(
            prompt=prompt,
            model=model,
            temperature=temperature
        )
