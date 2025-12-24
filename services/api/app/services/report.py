"""
Report Generation Service - Generates PDF compliance reports
"""
import io
import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from jinja2 import Template

from app.models import (
    Organization, Project, Submission, AnalysisRun, Finding,
    FindingFeedback, User, File
)


class ReportTemplate:
    """Base template for PDF reports"""
    
    def __init__(self, page_size=letter):
        self.page_size = page_size
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Setup custom paragraph styles"""
        # Title style
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Title'],
            fontSize=24,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=30,
            alignment=TA_CENTER
        ))
        
        # Section header
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading1'],
            fontSize=16,
            textColor=colors.HexColor('#2563eb'),
            spaceBefore=20,
            spaceAfter=12,
            borderPadding=5
        ))
        
        # Subsection header
        self.styles.add(ParagraphStyle(
            name='SubsectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#1e40af'),
            spaceBefore=12,
            spaceAfter=8
        ))
        
        # Finding text
        self.styles.add(ParagraphStyle(
            name='FindingText',
            parent=self.styles['Normal'],
            fontSize=10,
            leading=14,
            alignment=TA_JUSTIFY,
            spaceAfter=6
        ))
        
        # Footer
        self.styles.add(ParagraphStyle(
            name='Footer',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=colors.grey,
            alignment=TA_CENTER
        ))


class ReportService:
    """Service for generating PDF compliance reports"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def generate_compliance_report(
        self,
        analysis_run_id: int,
        organization_id: int,
        options: Optional[Dict[str, Any]] = None
    ) -> bytes:
        """
        Generate comprehensive compliance report PDF
        
        Args:
            analysis_run_id: ID of analysis run to report on
            organization_id: Organization ID for access control
            options: Report customization options
                - include_summary: Include executive summary (default: True)
                - include_findings: Include detailed findings (default: True)
                - include_recommendations: Include recommendations (default: True)
                - finding_statuses: List of statuses to include (default: all)
                - severity_levels: List of severities to include (default: all)
                - page_size: 'letter' or 'a4' (default: letter)
                - include_metadata: Include file metadata (default: True)
                - include_statistics: Include statistics (default: True)
        
        Returns:
            PDF bytes
        """
        options = options or {}
        
        # Validate access and get data
        analysis_run = self._get_analysis_run(analysis_run_id, organization_id)
        submission = analysis_run.submission
        project = submission.project
        organization = project.organization
        
        # Get findings with filters
        findings = self._get_filtered_findings(
            analysis_run_id,
            statuses=options.get('finding_statuses'),
            severities=options.get('severity_levels')
        )
        
        # Create PDF buffer
        buffer = io.BytesIO()
        
        # Setup document
        page_size = A4 if options.get('page_size') == 'a4' else letter
        template = ReportTemplate(page_size=page_size)
        
        doc = SimpleDocTemplate(
            buffer,
            pagesize=page_size,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72,
            title=f"Compliance Report - {submission.name}"
        )
        
        # Build report content
        story = []
        
        # Cover page
        story.extend(self._build_cover_page(
            organization, project, submission, analysis_run, template
        ))
        story.append(PageBreak())
        
        # Executive summary
        if options.get('include_summary', True):
            story.extend(self._build_executive_summary(
                analysis_run, findings, template
            ))
            story.append(PageBreak())
        
        # Statistics
        if options.get('include_statistics', True):
            story.extend(self._build_statistics_section(findings, template))
            story.append(PageBreak())
        
        # Metadata
        if options.get('include_metadata', True):
            story.extend(self._build_metadata_section(submission, template))
            story.append(PageBreak())
        
        # Detailed findings
        if options.get('include_findings', True):
            story.extend(self._build_findings_section(findings, template))
        
        # Recommendations
        if options.get('include_recommendations', True):
            story.append(PageBreak())
            story.extend(self._build_recommendations_section(findings, template))
        
        # Build PDF
        doc.build(
            story,
            onFirstPage=lambda canvas, doc: self._add_footer(canvas, doc, organization),
            onLaterPages=lambda canvas, doc: self._add_footer(canvas, doc, organization)
        )
        
        return buffer.getvalue()
    
    def _get_analysis_run(self, analysis_run_id: int, organization_id: int) -> AnalysisRun:
        """Get analysis run with access validation"""
        analysis_run = self.db.query(AnalysisRun).filter(
            AnalysisRun.id == analysis_run_id
        ).first()
        
        if not analysis_run:
            raise ValueError("Analysis run not found")
        
        submission = self.db.query(Submission).filter(
            Submission.id == analysis_run.submission_id
        ).first()
        
        project = self.db.query(Project).filter(
            Project.id == submission.project_id
        ).first()
        
        if project.organization_id != organization_id:
            raise ValueError("Access denied")
        
        return analysis_run
    
    def _get_filtered_findings(
        self,
        analysis_run_id: int,
        statuses: Optional[List[str]] = None,
        severities: Optional[List[str]] = None
    ) -> List[Finding]:
        """Get findings with optional filters"""
        query = self.db.query(Finding).filter(
            Finding.analysis_run_id == analysis_run_id
        )
        
        if statuses:
            query = query.filter(Finding.status.in_(statuses))
        
        if severities:
            query = query.filter(Finding.severity.in_(severities))
        
        return query.order_by(
            Finding.severity.desc(),
            Finding.created_at.desc()
        ).all()
    
    def _build_cover_page(
        self,
        organization: Organization,
        project: Project,
        submission: Submission,
        analysis_run: AnalysisRun,
        template: ReportTemplate
    ) -> List:
        """Build report cover page"""
        story = []
        
        # Add logo space (if organization has logo)
        story.append(Spacer(1, 0.5*inch))
        
        # Title
        title = Paragraph(
            "Building Compliance Report",
            template.styles['CustomTitle']
        )
        story.append(title)
        story.append(Spacer(1, 0.3*inch))
        
        # Submission info
        info_data = [
            ["Organization:", organization.name],
            ["Project:", project.name],
            ["Submission:", submission.name],
            ["Analysis Date:", analysis_run.created_at.strftime("%B %d, %Y")],
            ["Report Generated:", datetime.utcnow().strftime("%B %d, %Y at %H:%M UTC")]
        ]
        
        info_table = Table(info_data, colWidths=[2*inch, 4*inch])
        info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#374151')),
            ('TEXTCOLOR', (1, 0), (1, -1), colors.black),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0, 0), (-1, -1), [None, colors.HexColor('#f9fafb')]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb'))
        ]))
        
        story.append(info_table)
        
        return story
    
    def _build_executive_summary(
        self,
        analysis_run: AnalysisRun,
        findings: List[Finding],
        template: ReportTemplate
    ) -> List:
        """Build executive summary section"""
        story = []
        
        story.append(Paragraph("Executive Summary", template.styles['SectionHeader']))
        story.append(Spacer(1, 0.2*inch))
        
        # Count findings by severity
        severity_counts = {
            'critical': 0,
            'high': 0,
            'medium': 0,
            'low': 0,
            'info': 0
        }
        
        for finding in findings:
            severity = finding.severity.lower()
            if severity in severity_counts:
                severity_counts[severity] += 1
        
        # Summary text
        total_findings = len(findings)
        critical_high = severity_counts['critical'] + severity_counts['high']
        
        summary_text = f"""
        This compliance analysis identified <b>{total_findings}</b> findings across various 
        compliance categories. Of these, <b>{critical_high}</b> findings are classified as 
        critical or high severity and require immediate attention.
        """
        
        story.append(Paragraph(summary_text.strip(), template.styles['FindingText']))
        story.append(Spacer(1, 0.2*inch))
        
        # Severity breakdown table
        severity_data = [
            ['Severity', 'Count', 'Percentage'],
            ['Critical', str(severity_counts['critical']), 
             f"{severity_counts['critical']/total_findings*100:.1f}%" if total_findings > 0 else "0%"],
            ['High', str(severity_counts['high']), 
             f"{severity_counts['high']/total_findings*100:.1f}%" if total_findings > 0 else "0%"],
            ['Medium', str(severity_counts['medium']), 
             f"{severity_counts['medium']/total_findings*100:.1f}%" if total_findings > 0 else "0%"],
            ['Low', str(severity_counts['low']), 
             f"{severity_counts['low']/total_findings*100:.1f}%" if total_findings > 0 else "0%"],
            ['Info', str(severity_counts['info']), 
             f"{severity_counts['info']/total_findings*100:.1f}%" if total_findings > 0 else "0%"]
        ]
        
        severity_table = Table(severity_data, colWidths=[2*inch, 1.5*inch, 1.5*inch])
        severity_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f3f4f6')])
        ]))
        
        story.append(severity_table)
        
        return story
    
    def _build_statistics_section(
        self,
        findings: List[Finding],
        template: ReportTemplate
    ) -> List:
        """Build statistics section"""
        story = []
        
        story.append(Paragraph("Compliance Statistics", template.styles['SectionHeader']))
        story.append(Spacer(1, 0.2*inch))
        
        # Count by check type
        check_type_counts = {}
        for finding in findings:
            check_type = finding.check_type
            check_type_counts[check_type] = check_type_counts.get(check_type, 0) + 1
        
        # Create table
        check_data = [['Check Type', 'Findings']]
        for check_type, count in sorted(check_type_counts.items(), key=lambda x: x[1], reverse=True):
            check_data.append([check_type.replace('_', ' ').title(), str(count)])
        
        check_table = Table(check_data, colWidths=[4*inch, 2*inch])
        check_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f3f4f6')])
        ]))
        
        story.append(check_table)
        
        return story
    
    def _build_metadata_section(
        self,
        submission: Submission,
        template: ReportTemplate
    ) -> List:
        """Build submission metadata section"""
        story = []
        
        story.append(Paragraph("Submission Details", template.styles['SectionHeader']))
        story.append(Spacer(1, 0.2*inch))
        
        # Get files
        files = self.db.query(File).filter(
            File.submission_id == submission.id
        ).all()
        
        # File list
        if files:
            story.append(Paragraph("Analyzed Files", template.styles['SubsectionHeader']))
            
            file_data = [['File Name', 'Type', 'Size']]
            for file in files:
                size_mb = file.size / (1024 * 1024)
                file_data.append([
                    file.original_filename,
                    file.file_type.upper(),
                    f"{size_mb:.2f} MB"
                ])
            
            file_table = Table(file_data, colWidths=[3*inch, 1.5*inch, 1.5*inch])
            file_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f3f4f6')])
            ]))
            
            story.append(file_table)
        
        return story
    
    def _build_findings_section(
        self,
        findings: List[Finding],
        template: ReportTemplate
    ) -> List:
        """Build detailed findings section"""
        story = []
        
        story.append(Paragraph("Detailed Findings", template.styles['SectionHeader']))
        story.append(Spacer(1, 0.2*inch))
        
        # Group by severity
        severity_order = ['critical', 'high', 'medium', 'low', 'info']
        findings_by_severity = {s: [] for s in severity_order}
        
        for finding in findings:
            severity = finding.severity.lower()
            if severity in findings_by_severity:
                findings_by_severity[severity].append(finding)
        
        # Add findings for each severity
        for severity in severity_order:
            severity_findings = findings_by_severity[severity]
            if not severity_findings:
                continue
            
            # Severity subsection
            story.append(Paragraph(
                f"{severity.upper()} Severity Findings ({len(severity_findings)})",
                template.styles['SubsectionHeader']
            ))
            story.append(Spacer(1, 0.1*inch))
            
            for i, finding in enumerate(severity_findings, 1):
                # Finding box
                finding_elements = []
                
                # Title
                title_text = f"<b>Finding {i}: {finding.title}</b>"
                finding_elements.append(Paragraph(title_text, template.styles['FindingText']))
                finding_elements.append(Spacer(1, 0.05*inch))
                
                # Details
                details = [
                    f"<b>Check Type:</b> {finding.check_type.replace('_', ' ').title()}",
                    f"<b>Status:</b> {finding.status.replace('_', ' ').title()}",
                    f"<b>Location:</b> {finding.location or 'General'}"
                ]
                
                for detail in details:
                    finding_elements.append(Paragraph(detail, template.styles['FindingText']))
                
                finding_elements.append(Spacer(1, 0.05*inch))
                
                # Description
                desc_text = f"<b>Description:</b><br/>{finding.description}"
                finding_elements.append(Paragraph(desc_text, template.styles['FindingText']))
                
                # Recommendation
                if finding.recommendation:
                    finding_elements.append(Spacer(1, 0.05*inch))
                    rec_text = f"<b>Recommendation:</b><br/>{finding.recommendation}"
                    finding_elements.append(Paragraph(rec_text, template.styles['FindingText']))
                
                # Keep finding together on same page
                story.append(KeepTogether(finding_elements))
                story.append(Spacer(1, 0.15*inch))
        
        return story
    
    def _build_recommendations_section(
        self,
        findings: List[Finding],
        template: ReportTemplate
    ) -> List:
        """Build recommendations summary section"""
        story = []
        
        story.append(Paragraph("Recommendations Summary", template.styles['SectionHeader']))
        story.append(Spacer(1, 0.2*inch))
        
        # Get critical and high findings with recommendations
        priority_findings = [
            f for f in findings 
            if f.severity.lower() in ['critical', 'high'] and f.recommendation
        ]
        
        if priority_findings:
            text = """
            The following high-priority recommendations should be addressed immediately 
            to ensure compliance and building safety:
            """
            story.append(Paragraph(text.strip(), template.styles['FindingText']))
            story.append(Spacer(1, 0.2*inch))
            
            for i, finding in enumerate(priority_findings, 1):
                rec_text = f"<b>{i}. [{finding.severity.upper()}]</b> {finding.recommendation}"
                story.append(Paragraph(rec_text, template.styles['FindingText']))
                story.append(Spacer(1, 0.1*inch))
        else:
            story.append(Paragraph(
                "No high-priority recommendations at this time.",
                template.styles['FindingText']
            ))
        
        return story
    
    def _add_footer(self, canvas, doc, organization: Organization):
        """Add footer to page"""
        canvas.saveState()
        
        # Footer text
        footer_text = f"{organization.name} | Generated on {datetime.utcnow().strftime('%B %d, %Y')}"
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.grey)
        
        # Center footer
        canvas.drawCentredString(
            doc.pagesize[0] / 2.0,
            0.5 * inch,
            footer_text
        )
        
        # Page number
        page_num = f"Page {doc.page}"
        canvas.drawRightString(
            doc.pagesize[0] - 72,
            0.5 * inch,
            page_num
        )
        
        canvas.restoreState()
