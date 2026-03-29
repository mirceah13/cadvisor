'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useLoadingRouter } from '@/hooks/use-loading-router'
import { apiClient } from '@/lib/api-client'
import { DashboardNav } from '@/components/dashboard-nav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface AnalysisRun {
  id: string
  submission_id: string
  status: string
  findings_count?: number
  checks_completed: string[]
  error_message?: string
  created_at: string
}

interface Finding {
  id: string
  severity: string
  category: string
  title: string
  description: string
  status: string
  location?: string
  recommendation?: string
  metadata?: any
  created_at: string
}

export default function AnalysisDetailPage() {
  const params = useParams()
  const router = useLoadingRouter()

  const [analysisRun, setAnalysisRun] = useState<AnalysisRun | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAnalysisRun()
    fetchFindings()
  }, [params.runId])

  const fetchAnalysisRun = async () => {
    try {
      const data = await apiClient.get<AnalysisRun>(`/analysis/runs/${params.runId}`)
      setAnalysisRun(data)
    } catch (err: any) {
      console.error('Failed to fetch analysis run:', err)
      setError(err.response?.data?.detail || 'Failed to load analysis')
    } finally {
      setLoading(false)
    }
  }

  const fetchFindings = async () => {
    try {
      const data = await apiClient.get<Finding[]>(
        `/analysis/submissions/${params.id}/findings?analysis_run_id=${params.runId}`
      )
      setFindings(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch findings:', err)
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'info':
        return <Info className="h-5 w-5 text-blue-600" />
      default:
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive'
      case 'warning':
        return 'default'
      case 'info':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  if (loading) {
    return (
      <>
        <DashboardNav />
        <div className="flex-1 p-8 pt-6 container max-w-7xl">
          <Skeleton className="h-10 w-64 mb-6" />
          <Skeleton className="h-96" />
        </div>
      </>
    )
  }

  if (error || !analysisRun) {
    return (
      <>
        <DashboardNav />
        <div className="flex-1 p-8 pt-6 container max-w-7xl">
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{error || 'Analysis run not found'}</p>
              <Button onClick={() => router.back()} className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  const criticalCount = findings.filter(f => f.severity === 'critical').length
  const warningCount = findings.filter(f => f.severity === 'warning').length
  const infoCount = findings.filter(f => f.severity === 'info').length
  const passedChecks = analysisRun.checks_completed.length

  return (
    <>
      <DashboardNav />
      <div className="flex-1 p-8 pt-6 container max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="mb-2"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Submission
            </Button>
            <h1 className="text-3xl font-bold">Analysis Report</h1>
            <p className="text-muted-foreground">
              Run {formatDistanceToNow(new Date(analysisRun.created_at))} ago
            </p>
          </div>
          <Badge
            variant={analysisRun.status === 'completed' ? 'default' : 'destructive'}
            className="text-lg px-4 py-2"
          >
            {analysisRun.status}
          </Badge>
        </div>

        {/* Metrics Dashboard */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Findings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{findings.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Issues detected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Critical
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{criticalCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Requires immediate attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Warnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{warningCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Needs review
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Informational
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{infoCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                For reference
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Compliance Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Compliance Summary</CardTitle>
            <CardDescription>
              Overview of checks performed and results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Checks Completed</span>
                  <span className="text-sm text-muted-foreground">{passedChecks} checks</span>
                </div>
                {analysisRun.checks_completed.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {analysisRun.checks_completed.map((check) => (
                      <Badge key={check} variant="outline">
                        {check.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No checks completed</p>
                )}
              </div>

              {analysisRun.error_message && (
                <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/30">
                  <h4 className="text-sm font-semibold text-destructive mb-1">
                    Error
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {analysisRun.error_message}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Findings by Severity */}
        {findings.length > 0 ? (
          <>
            {criticalCount > 0 && (
              <Card className="mb-6 border-destructive/30">
                <CardHeader>
                  <CardTitle className="text-destructive flex items-center gap-2">
                    <XCircle className="h-5 w-5" />
                    Critical Issues ({criticalCount})
                  </CardTitle>
                  <CardDescription>
                    These issues require immediate attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {findings.filter(f => f.severity === 'critical').map((finding) => (
                      <div key={finding.id} className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getSeverityIcon(finding.severity)}
                            <Badge variant="outline">{finding.category}</Badge>
                          </div>
                          <Badge variant="outline">{finding.status}</Badge>
                        </div>
                        <h4 className="font-semibold mb-2">{finding.title}</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          {finding.description}
                        </p>
                        {finding.recommendation && (
                          <div className="p-3 bg-background rounded-md">
                            <p className="text-sm font-medium mb-1">Recommendation:</p>
                            <p className="text-sm">{finding.recommendation}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {warningCount > 0 && (
              <Card className="mb-6 border-yellow-200">
                <CardHeader>
                  <CardTitle className="text-yellow-600 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Warnings ({warningCount})
                  </CardTitle>
                  <CardDescription>
                    These issues should be reviewed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {findings.filter(f => f.severity === 'warning').map((finding) => (
                      <div key={finding.id} className="p-4 rounded-lg border">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getSeverityIcon(finding.severity)}
                            <Badge variant="outline">{finding.category}</Badge>
                          </div>
                          <Badge variant="outline">{finding.status}</Badge>
                        </div>
                        <h4 className="font-semibold mb-2">{finding.title}</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          {finding.description}
                        </p>
                        {finding.recommendation && (
                          <div className="p-3 bg-muted rounded-md">
                            <p className="text-sm font-medium mb-1">Recommendation:</p>
                            <p className="text-sm">{finding.recommendation}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {infoCount > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-blue-600 flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    Informational ({infoCount})
                  </CardTitle>
                  <CardDescription>
                    Additional information and observations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {findings.filter(f => f.severity === 'info').map((finding) => (
                      <div key={finding.id} className="p-4 rounded-lg border">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getSeverityIcon(finding.severity)}
                            <Badge variant="outline">{finding.category}</Badge>
                          </div>
                          <Badge variant="outline">{finding.status}</Badge>
                        </div>
                        <h4 className="font-semibold mb-2">{finding.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {finding.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-600 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Issues Found</h3>
                <p className="text-muted-foreground">
                  {analysisRun.status === 'completed' 
                    ? 'The analysis completed successfully with no compliance issues detected.'
                    : 'Analysis is still in progress or encountered an error.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
