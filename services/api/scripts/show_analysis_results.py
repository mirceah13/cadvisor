#!/usr/bin/env python3
"""Display analysis results"""
import sys
sys.path.insert(0, '/app')

from app.core.database import SessionLocal
from app.models import AnalysisRun, Finding
from sqlalchemy import desc
import json

db = SessionLocal()
try:
    # Get most recent analysis run
    analysis_run = db.query(AnalysisRun).order_by(desc(AnalysisRun.created_at)).first()
    
    if analysis_run:
        print('='*70)
        print('         FIRE SAFETY COMPLIANCE ANALYSIS RESULTS')
        print('='*70)
        print(f'\nAnalysis Run ID: {analysis_run.id}')
        print(f'Submission: {analysis_run.submission_id}')
        print(f'Status: {analysis_run.status.upper()}')
        if analysis_run.started_at:
            print(f'Started: {analysis_run.started_at}')
        if analysis_run.finished_at:
            print(f'Finished: {analysis_run.finished_at}')
        if analysis_run.started_at and analysis_run.finished_at:
            duration = (analysis_run.finished_at - analysis_run.started_at).total_seconds()
            print(f'Duration: {duration:.2f} seconds')
        print(f'\nSUMMARY:')
        print(f'   Total Findings: {analysis_run.total_findings}')
        print(f'   Critical: {analysis_run.critical_findings}')
        
        # Get findings
        findings = db.query(Finding).filter(
            Finding.analysis_run_id == analysis_run.id
        ).order_by(Finding.severity.desc()).all()
        
        print('\n' + '='*70)
        print('DETAILED FINDINGS')
        print('='*70 + '\n')
        
        for i, finding in enumerate(findings, 1):
            if finding.severity == 'critical':
                severity_icon = 'CRITICAL'
            elif finding.severity == 'warning':
                severity_icon = 'WARNING'
            else:
                severity_icon = 'INFO'
                
            print(f'FINDING #{i} - {severity_icon}')
            print(f'   Category: {finding.category}')
            print(f'   Confidence: {finding.confidence*100:.0f}%')
            print(f'   Status: {finding.status}')
            print(f'\n   Statement:')
            print(f'   {finding.statement}\n')
            
            if finding.evidence:
                evidence = finding.evidence
                print(f'   Evidence:')
                if 'description' in evidence:
                    desc = evidence['description']
                    if len(desc) > 300:
                        desc = desc[:300] + '...'
                    print(f'      Description: {desc}')
                if 'recommendation' in evidence:
                    rec = evidence['recommendation']
                    if len(rec) > 300:
                        rec = rec[:300] + '...'
                    print(f'      Recommendation: {rec}')
                if 'reference_documents' in evidence:
                    refs = evidence['reference_documents'][:5]
                    print(f'      References ({len(evidence["reference_documents"])} total):')
                    for ref in refs:
                        print(f'         - {ref}')
            print('\n' + '-'*70 + '\n')
    else:
        print('No analysis runs found')
finally:
    db.close()
