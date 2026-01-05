'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DashboardNav } from '@/components/dashboard-nav'
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
      <div className="flex-1 space-y-8 p-8 pt-6 container max-w-7xl">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-8 text-primary-foreground shadow-2xl">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000,transparent)]" />
          <div className="relative flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">Submissions</h1>
              <p className="text-primary-foreground/90 text-lg max-w-2xl">
                Track and manage your CAD file submissions for compliance analysis
              </p>
            </div>
            <Button size="lg" variant="secondary" asChild className="shadow-lg hover:shadow-xl transition-all" onClick={() => triggerLoading()}>
              <LoadingLink href="/submissions/new">
                <Plus className="mr-2 h-5 w-5" />
                New Submission
              </LoadingLink>
            </Button>
          </div>
        </div>

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
          <Card className="p-12 border-2 border-red-200 dark:border-red-900">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="p-4 rounded-full bg-red-100 dark:bg-red-950 mb-4">
                <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-red-900 dark:text-red-100">Error Loading Submissions</h3>
              <p className="text-red-700 dark:text-red-300 mb-6 max-w-md">
                {error}
              </p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </Card>
        ) : submissions.length === 0 ? (
          <Card className="p-12 border-2 border-dashed border-primary/20">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <Upload className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No submissions yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Upload your first CAD file for compliance analysis and start generating insights
              </p>
              <Button size="lg" asChild className="shadow-lg" onClick={() => triggerLoading()}>
                <LoadingLink href="/submissions/new">
                  <Plus className="mr-2 h-5 w-5" />
                  Create Submission
                </LoadingLink>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <LoadingLink key={submission.id} href={`/submissions/${submission.id}`} className="block">
                <Card className="p-6 hover:shadow-lg hover:border-primary/40 transition-all cursor-pointer group border-l-4 border-l-transparent hover:border-l-primary">
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors truncate">
                            {submission.name}
                          </h3>
                          {submission.description && (
                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                              {submission.description}
                            </p>
                          )}
                        </div>
                        <Badge className={getStatusColor(submission.status)}>
                          <span className="flex items-center gap-1.5">
                            {getStatusIcon(submission.status)}
                            {submission.status.replace('_', ' ')}
                          </span>
                        </Badge>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground ml-11">
                        {submission.project_name && (
                          <div className="flex items-center gap-1.5">
                            <Folder className="h-3.5 w-3.5" />
                            <span>{submission.project_name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" />
                          <span>{submission.files_count} {submission.files_count === 1 ? 'file' : 'files'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            {formatDistanceToNow(new Date(submission.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {submission.findings_summary && submission.findings_summary.total > 0 && (
                      <div className="flex gap-3">
                        <div className="text-center p-3 rounded-lg bg-muted min-w-[80px]">
                          <div className="text-2xl font-bold">{submission.findings_summary.total}</div>
                          <div className="text-xs text-muted-foreground mt-1">Total Findings</div>
                        </div>
                        {submission.findings_summary.critical > 0 && (
                          <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 min-w-[80px]">
                            <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400 mb-1">
                              <AlertCircle className="h-4 w-4" />
                              <div className="text-2xl font-bold">{submission.findings_summary.critical}</div>
                            </div>
                            <div className="text-xs text-red-600 dark:text-red-400 font-medium">Critical</div>
                          </div>
                        )}
                        {submission.findings_summary.high > 0 && (
                          <div className="text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 min-w-[80px]">
                            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                              {submission.findings_summary.high}
                            </div>
                            <div className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-1">High</div>
                          </div>
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
