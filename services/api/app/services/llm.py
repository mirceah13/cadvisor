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
        self.base_url = settings.AI_SERVICE_BASE_URL
        self.model = "llama3.2"  # Default model
        self.timeout = 120.0  # 2 minutes for complex queries
    
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
        temperature: float = 0.1
    ) -> Optional[str]:
        """
        Generate completion with RAG context
        
        Args:
            query: User query
            context_chunks: Retrieved knowledge chunks
            system_prompt: System instructions
            temperature: Sampling temperature
            
        Returns:
            Generated text with citations
        """
        # Build context string
        context_parts = []
        for i, chunk in enumerate(context_chunks, 1):
            source = chunk.get("source", {})
            content = chunk.get("content", "")
            
            context_parts.append(
                f"[Source {i}: {source.get('title', 'Unknown')}]\n{content}\n"
            )
        
        context_str = "\n".join(context_parts)
        
        # Build prompt with context
        prompt = f"""Context from building standards and regulations:

{context_str}

Query: {query}

Based on the context provided above, please answer the query. Include specific references to the source documents in your answer."""
        
        return await self.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=1500
        )
    
    async def analyze_compliance(
        self,
        submission_profile: Dict[str, Any],
        check_type: str,
        context_chunks: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyze submission for compliance
        
        Args:
            submission_profile: Building submission data
            check_type: Type of check (fire_safety, accessibility, etc.)
            context_chunks: Relevant regulation chunks
            
        Returns:
            Analysis result with findings
        """
        system_prompt = """You are an expert building code compliance analyst. Your task is to review building submissions against applicable regulations and identify compliance issues.

Be specific, cite relevant code sections, and classify findings by severity:
- CRITICAL: Life safety issues, code violations
- WARNING: Best practice deviations, unclear compliance
- INFO: Recommendations, observations

Format your response as structured findings."""
        
        # Extract key metrics from profile
        building = submission_profile.get("building", {})
        elements = submission_profile.get("elements", {})
        systems = submission_profile.get("systems", {})
        
        query = f"""Analyze this building submission for {check_type} compliance:

Building Type: {building.get('type', 'Unknown')}
Number of Floors: {building.get('floors', 'N/A')}
Total Area: {building.get('total_area_sqm', 'N/A')} sqm
Fire Compartments: {building.get('fire_compartments', 'N/A')}
Exits: {building.get('exits', 'N/A')}

Elements:
- Walls: {elements.get('walls', 0)}
- Doors: {elements.get('doors', 0)}
- Windows: {elements.get('windows', 0)}
- Stairs: {elements.get('stairs', 0)}

Systems:
- Electrical: {systems.get('electrical', False)}
- Plumbing: {systems.get('plumbing', False)}
- HVAC: {systems.get('hvac', False)}
- Fire Protection: {systems.get('fire_protection', False)}

Identify any compliance issues or concerns based on applicable regulations."""
        
        response = await self.generate_with_context(
            query=query,
            context_chunks=context_chunks,
            system_prompt=system_prompt,
            temperature=0.1
        )
        
        if not response:
            return {
                "success": False,
                "error": "Failed to generate analysis"
            }
        
        # Parse response into structured findings
        findings = self._parse_findings(response, check_type)
        
        return {
            "success": True,
            "check_type": check_type,
            "findings": findings,
            "raw_response": response,
            "context_sources": [c.get("source", {}) for c in context_chunks]
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
