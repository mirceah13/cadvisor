'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DashboardNav } from '@/components/dashboard-nav'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Upload, FileText, AlertCircle, Clock, Folder, TrendingUp, CheckCircle2 } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { formatDistanceToNow } from 'date-fns'
import { LoadingLink } from '@/components/loading-link'
import { triggerLoading } from '@/components/global-loading-spinner'

interface FindingsSummary {
  total: number
  critical: number
  high: number
  medium: number
  low: number
}

interface Submission {
  id: string
  name: string
  description?: string
  status: string
  created_at: string
  updated_at: string
  project_id: string
  project_name?: string
  files_count: number
  findings_summary?: FindingsSummary
}

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        console.log('Fetching submissions...')
        const data = await apiClient.get<Submission[]>('/submissions')
        console.log('Submissions data:', data)
        const submissions = Array.isArray(data) ? data : []
        console.log('Processed submissions:', submissions)
        setSubmissions(submissions)
        setError(null)
      } catch (error: any) {
        console.error('Failed to fetch submissions:', error)
        console.error('Error response:', error?.response?.data)
        setError(error?.response?.data?.detail || error?.message || 'Failed to load submissions')
        setSubmissions([])
      } finally {
        setLoading(false)
      }
    }

    fetchSubmissions()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'reviewed':
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 border border-green-200 dark:border-green-800'
      case 'analyzing':
      case 'submitted':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800'
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border border-red-200 dark:border-red-800'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200 border border-gray-200 dark:border-gray-700'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'reviewed':
      case 'approved':
        return <CheckCircle2 className="h-3 w-3" />
      case 'analyzing':
      case 'submitted':
        return <TrendingUp className="h-3 w-3" />
      case 'draft':
        return <Clock className="h-3 w-3" />
      case 'rejected':
        return <AlertCircle className="h-3 w-3" />
      default:
        return <FileText className="h-3 w-3" />
    }
  }

  return (
    <>
      <DashboardNav />
      <div className="flex-1 space-y-6 p-8 pt-6 container max-w-7xl">
        <PageHeader
          title="Submissions"
          description="Track CAD file submissions for compliance analysis"
          actions={
            <Button size="sm" asChild onClick={() => triggerLoading()}>
              <LoadingLink href="/submissions/new">
                <Plus className="mr-2 h-4 w-4" />
                New Submission
              </LoadingLink>
            </Button>
          }
        />

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="p-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <div className="flex gap-4">
                    <Skeleton className="h-16 w-20" />
                    <Skeleton className="h-16 w-20" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
          </div>
        ) : submissions.length === 0 ? (
          <div className="rounded-md border border-dashed p-12 text-center">
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-medium mb-1">No submissions yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Upload a CAD file for compliance analysis</p>
            <Button size="sm" asChild onClick={() => triggerLoading()}>
              <LoadingLink href="/submissions/new"><Plus className="mr-2 h-4 w-4" />Create Submission</LoadingLink>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {submissions.map((submission) => (
              <LoadingLink key={submission.id} href={`/submissions/${submission.id}`} className="block">
                <Card className="p-4 hover:border-foreground/20 transition-colors group">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                          {submission.name}
                        </h3>
                        <Badge className={`shrink-0 text-xs ${getStatusColor(submission.status)}`}>
                          {submission.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {submission.project_name && <span>{submission.project_name}</span>}
                        <span>{submission.files_count} {submission.files_count === 1 ? 'file' : 'files'}</span>
                        <span>{formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                    {submission.findings_summary && submission.findings_summary.total > 0 && (
                      <div className="flex items-center gap-3 text-xs shrink-0">
                        <span className="tabular-nums">{submission.findings_summary.total} findings</span>
                        {submission.findings_summary.critical > 0 && (
                          <span className="text-destructive font-medium">{submission.findings_summary.critical} critical</span>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              </LoadingLink>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
