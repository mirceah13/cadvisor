"""
Analysis Engine Service
Orchestrates compliance analysis using LLM + RAG
"""

import logging
from typing import List, Dict, Any, Optional
from uuid import UUID
from sqlalchemy.orm import Session

from app.models import Submission, AnalysisRun, Finding, Ruleset
from app.services.knowledge_base import KnowledgeBaseService
from app.services.llm import LLMService
from app.services.submission_profile import SubmissionProfileGenerator

logger = logging.getLogger(__name__)


class AnalysisEngine:
    """Engine for analyzing building submissions for compliance"""
    
    def __init__(self, db: Session):
        self.db = db
        self.kb_service = KnowledgeBaseService(db)
        self.llm_service = LLMService()
        self.profile_generator = SubmissionProfileGenerator(db)
    
    async def analyze_submission(
        self,
        submission_id: UUID,
        ruleset_ids: Optional[List[UUID]] = None,
        check_types: Optional[List[str]] = None
    ) -> AnalysisRun:
        """
        Analyze submission for compliance
        
        Args:
            submission_id: Submission to analyze
            ruleset_ids: Optional specific rulesets to apply
            check_types: Optional specific checks (fire_safety, accessibility, etc.)
            
        Returns:
            AnalysisRun record with findings
        """
        # Get submission
        submission = self.db.query(Submission).filter(
            Submission.id == submission_id
        ).first()
        
        if not submission:
            raise ValueError(f"Submission {submission_id} not found")
        
        # Get org_id from project
        from app.models import Project
        project = self.db.query(Project).filter(Project.id == submission.project_id).first()
        if not project:
            raise ValueError(f"Project not found for submission {submission_id}")
        
        # Check for existing running/failed analysis run to reuse (for retries)
        analysis_run = self.db.query(AnalysisRun).filter(
            AnalysisRun.submission_id == submission_id,
            AnalysisRun.status.in_(["running", "failed"])
        ).order_by(AnalysisRun.created_at.desc()).first()
        
        if analysis_run:
            # Reuse existing run for retry
            logger.info(f"Reusing existing analysis run {analysis_run.id} for submission {submission_id}")
            analysis_run.status = "running"
            analysis_run.error_message = None
        else:
            # Create new analysis run
            analysis_run = AnalysisRun(
                submission_id=submission_id,
                org_id=project.org_id,
                status="running",
                config={
                    "check_types": check_types or [],
                    "ruleset_ids": [str(r) for r in (ruleset_ids or [])]
                }
            )
            self.db.add(analysis_run)
        
        self.db.commit()
        self.db.refresh(analysis_run)
        
        logger.info(f"Starting analysis run {analysis_run.id} for submission {submission_id}")
        
        try:
            # Generate/get submission profile
            profile = submission.profile if submission.profile else None
            
            if not profile:
                logger.info("Generating submission profile...")
                profile = self.profile_generator.generate_profile(submission_id)
            
            # Determine check types
            if not check_types:
                check_types = self._determine_check_types(submission, profile)
            
            logger.info(f"Running checks: {check_types}")
            
            # Initialize progress tracking
            total_checks = len(check_types)
            analysis_run.config = {
                "check_types": check_types,
                "ruleset_ids": [str(r) for r in (ruleset_ids or [])],
                "total_checks": total_checks,
                "checks_completed": [],
                "progress": 0,
                "current_step": None
            }
            self.db.commit()
            self.db.refresh(analysis_run)
            
            # Run each check
            all_findings = []
            
            for idx, check_type in enumerate(check_types):
                # Calculate progress range for this check
                check_start_progress = int((idx / total_checks) * 100)
                check_end_progress = int(((idx + 1) / total_checks) * 100)
                progress_range = check_end_progress - check_start_progress
                
                # Update progress before starting check (0% of check)
                config = analysis_run.config.copy()
                config["current_step"] = check_type
                config["progress"] = check_start_progress
                analysis_run.config = config
                self.db.commit()
                self.db.refresh(analysis_run)
                
                logger.info(f"Running check {idx + 1}/{total_checks}: {check_type} (Progress: {analysis_run.config['progress']}%)")
                
                findings = await self._run_check(
                    submission_id=submission_id,
                    profile=profile,
                    check_type=check_type,
                    analysis_run_id=analysis_run.id,
                    progress_callback=lambda sub_progress: self._update_check_progress(
                        analysis_run, check_start_progress, progress_range, sub_progress
                    )
                )
                all_findings.extend(findings)
                
                # Update progress after completing check (100% of check)
                config = analysis_run.config.copy()
                completed_checks = config.get("checks_completed", [])
                if isinstance(completed_checks, int):  # Backwards compatibility
                    completed_checks = []
                completed_checks.append(check_type)
                config["checks_completed"] = completed_checks
                config["progress"] = check_end_progress
                analysis_run.config = config
                self.db.commit()
                self.db.refresh(analysis_run)
            
            config = analysis_run.config.copy()
            config["current_step"] = "completed"
            config["progress"] = 100
            analysis_run.config = config
            analysis_run.total_findings = len(all_findings)
            analysis_run.status = "completed"
            
            self.db.commit()
            self.db.refresh(analysis_run)
            
            logger.info(f"Analysis run {analysis_run.id} completed with {len(all_findings)} findings")
            
            return analysis_run
        
        except Exception as e:
            logger.error(f"Analysis run {analysis_run.id} failed: {e}", exc_info=True)
            
            analysis_run.status = "failed"
            analysis_run.error_message = str(e)
            self.db.commit()
            
            raise
    
    def _update_check_progress(
        self,
        analysis_run: AnalysisRun,
        check_start_progress: int,
        progress_range: int,
        sub_progress: int
    ):
        """Update progress within a single check"""
        # Calculate overall progress: start + (sub_progress% of range)
        overall_progress = check_start_progress + int((sub_progress / 100) * progress_range)
        
        config = analysis_run.config.copy()
        config["progress"] = overall_progress
        analysis_run.config = config
        self.db.commit()
        self.db.refresh(analysis_run)
        
        logger.info(f"Check progress updated to {overall_progress}% (sub: {sub_progress}%)")
    
    async def _run_check(
        self,
        submission_id: UUID,
        profile: Dict[str, Any],
        check_type: str,
        analysis_run_id: UUID,
        progress_callback: Optional[callable] = None
    ) -> List[Finding]:
        """Run a specific compliance check"""
        
        # Get submission with project to access org_id
        submission = self.db.query(Submission).join(
            Submission.project
        ).filter(
            Submission.id == submission_id
        ).first()
        
        if not submission or not submission.project:
            return []
        
        org_id = submission.project.org_id
        
        # Build search query based on check type
        query = self._build_check_query(check_type, profile)
        
        # Retrieve relevant context from knowledge base
        context_chunks = await self.kb_service.semantic_search(
            query=query,
            org_id=org_id,
            limit=5,
            category=self._get_category_for_check(check_type),
            min_similarity=0.5
        )
        
        logger.info(f"Retrieved {len(context_chunks)} context chunks for {check_type}")
        
        # Update progress: KB retrieval complete (30% of this check)
        if progress_callback:
            progress_callback(30)
        
        # Run LLM analysis
        analysis_result = await self.llm_service.analyze_compliance(
            submission_profile=profile,
            check_type=check_type,
            context_chunks=context_chunks
        )
        
        if not analysis_result.get("success"):
            logger.error(f"Check {check_type} failed: {analysis_result.get('error')}")
            return []
        
        # Update progress: LLM analysis complete (80% of this check)
        if progress_callback:
            progress_callback(80)
        
        # Create finding records
        findings = []
        
        for finding_data in analysis_result.get("findings", []):
            finding = Finding(
                analysis_run_id=analysis_run_id,
                severity=finding_data.get("severity", "info"),
                category=check_type,
                statement=finding_data.get("title", "") + ": " + finding_data.get("description", ""),
                confidence=finding_data.get("confidence", 0.8),
                evidence={
                    "title": finding_data.get("title", ""),
                    "description": finding_data.get("description", ""),
                    "location": finding_data.get("location"),
                    "recommendation": finding_data.get("recommendation"),
                    "references": finding_data.get("references", []),
                    "context_sources": [
                        c.get("source", {}).get("title", "Unknown")
                        for c in context_chunks
                    ],
                    "raw_analysis": analysis_result.get("raw_response", "")[:1000]
                },
                status="pending"
            )
            
            self.db.add(finding)
            findings.append(finding)
        
        self.db.commit()
        
        logger.info(f"Created {len(findings)} findings for {check_type}")
        return findings
    
    def _determine_check_types(
        self,
        submission: Submission,
        profile: Dict[str, Any]
    ) -> List[str]:
        """Determine which checks to run based on submission"""
        check_types = []
        
        # Always run basic checks
        check_types.append("general_compliance")
        
        # Fire safety for all multi-story buildings
        building = profile.get("building", {})
        if building.get("floors", 0) > 1:
            check_types.append("fire_safety")
        
        # Accessibility checks
        check_types.append("accessibility")
        
        # Check based on building type from profile
        building_type = building.get("type", "") or profile.get("building_type", "unknown")
        
        if building_type in ["residential", "apartment", "multifamily"]:
            check_types.append("residential_code")
        elif building_type in ["commercial", "office", "retail"]:
            check_types.append("commercial_code")
        
        # System-specific checks
        systems = profile.get("systems", {})
        if systems.get("electrical"):
            check_types.append("electrical_code")
        if systems.get("plumbing"):
            check_types.append("plumbing_code")
        if systems.get("hvac"):
            check_types.append("mechanical_code")
        
        return list(set(check_types))  # Remove duplicates
    
    def _build_check_query(self, check_type: str, profile: Dict[str, Any]) -> str:
        """Build search query for knowledge base retrieval"""
        
        building = profile.get("building", {})
        building_type = building.get("type", "building")
        floors = building.get("floors", 0)
        
        queries = {
            "fire_safety": f"Fire safety requirements for {floors}-story {building_type}, means of egress, fire compartments, sprinkler systems",
            "accessibility": f"Accessibility requirements, ADA compliance, barrier-free design for {building_type}",
            "general_compliance": f"Building code requirements for {building_type}, general structural and safety standards",
            "residential_code": f"Residential building code requirements, IRC standards for {building_type}",
            "commercial_code": f"Commercial building code requirements, IBC standards for {building_type}",
            "electrical_code": f"Electrical code requirements, NEC standards for {building_type}",
            "plumbing_code": f"Plumbing code requirements for {building_type}",
            "mechanical_code": f"HVAC and mechanical code requirements for {building_type}"
        }
        
        return queries.get(check_type, f"{check_type} requirements for {building_type}")
    
    def _get_category_for_check(self, check_type: str) -> Optional[str]:
        """Map check type to knowledge base category"""
        
        category_map = {
            "fire_safety": "fire_safety",
            "accessibility": "accessibility",
            "general_compliance": "building_code",
            "residential_code": "building_code",
            "commercial_code": "building_code",
            "electrical_code": "electrical",
            "plumbing_code": "plumbing",
            "mechanical_code": "mechanical"
        }
        
        return category_map.get(check_type)
    
    def get_findings(
        self,
        submission_id: UUID,
        analysis_run_id: Optional[UUID] = None,
        severity: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Finding]:
        """Get findings for a submission"""
        
        # Get all analysis runs for this submission if no specific run provided
        if analysis_run_id:
            query = self.db.query(Finding).filter(
                Finding.analysis_run_id == analysis_run_id
            )
        else:
            # Get findings from all runs for this submission
            run_ids = self.db.query(AnalysisRun.id).filter(
                AnalysisRun.submission_id == submission_id
            ).all()
            run_id_list = [r[0] for r in run_ids]
            query = self.db.query(Finding).filter(
                Finding.analysis_run_id.in_(run_id_list)
            )
        
        if severity:
            query = query.filter(Finding.severity == severity)
        
        if status:
            query = query.filter(Finding.status == status)
        
        return query.order_by(
            Finding.severity.desc(),
            Finding.created_at.desc()
        ).all()
    
    def get_analysis_runs(
        self,
        submission_id: UUID,
        limit: int = 10
    ) -> List[AnalysisRun]:
        """Get analysis runs for a submission"""
        
        return self.db.query(AnalysisRun).filter(
            AnalysisRun.submission_id == submission_id
        ).order_by(
            AnalysisRun.created_at.desc()
        ).limit(limit).all()
