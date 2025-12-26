'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api-client'
import { DashboardNav } from '@/components/dashboard-nav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
  Play,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

interface Submission {
  id: string
  name: string
  description?: string
  building_type?: string
  status: string
  project_id?: string
  project_name?: string
  created_at: string
  files_count: number
}

interface AnalysisRun {
  id: string
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

export default function SubmissionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { accessToken } = useAuth()
  const { toast } = useToast()
  
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [files, setFiles] = useState<any[]>([])
  const [analysisRuns, setAnalysisRuns] = useState<AnalysisRun[]>([])
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const [lastAnalysisStatus, setLastAnalysisStatus] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSubmission()
    fetchFiles()
    fetchAnalysisRuns()
    
    // Cleanup polling on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [params.id, accessToken])

  const fetchSubmission = async () => {
    if (!accessToken) return

    try {
      const response: any = await apiClient.get(`/submissions/${params.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      setSubmission(response.data || response)
    } catch (err: any) {
      console.error('Failed to fetch submission:', err)
      setError(err.response?.data?.detail || 'Failed to load submission')
    } finally {
      setLoading(false)
    }
  }

  const fetchFiles = async () => {
    if (!accessToken) return

    try {
      const response: any = await apiClient.get('/files', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { submission_id: params.id }
      })
      setFiles(response.data || response || [])
    } catch (err) {
      console.error('Failed to fetch files:', err)
    }
  }

  const fetchAnalysisRuns = async () => {
    if (!accessToken) return

    try {
      const response: any = await apiClient.get(
        `/analysis/submissions/${params.id}/runs`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const runs = response.data || response || []
      setAnalysisRuns(runs)
      
      // Check if any run is in progress
      const runningRun = runs.find((r: AnalysisRun) => r.status === 'running')
      const latestRun = runs[0]
      
      if (runningRun) {
        setAnalyzing(true)
        startPolling()
      } else {
        // Check if analysis just completed
        if (lastAnalysisStatus === 'running' && latestRun?.status === 'completed') {
          toast({
            title: "Analysis Complete!",
            description: `Found ${latestRun.findings_count || 0} findings. Check the results below.`,
          })
          fetchFindings(latestRun.id)
        } else if (lastAnalysisStatus === 'running' && latestRun?.status === 'failed') {
          toast({
            variant: "destructive",
            title: "Analysis Failed",
            description: "The analysis encountered an error. Please try again.",
          })
        }
        
        setAnalyzing(false)
        stopPolling()
      }
      
      // Update last status
      if (latestRun) {
        setLastAnalysisStatus(latestRun.status)
      }
      
      // Fetch findings from latest completed run
      const completedRun = runs.find((r: AnalysisRun) => r.status === 'completed')
      if (completedRun && !runningRun) {
        fetchFindings(completedRun.id)
      }
    } catch (err) {
      console.error('Failed to fetch analysis runs:', err)
      // Stop polling on error to prevent infinite error loop
      stopPolling()
      setAnalyzing(false)
    }
  }

  const startPolling = () => {
    // Don't start if already polling
    if (pollingInterval) return
    
    const interval = setInterval(() => {
      fetchAnalysisRuns()
    }, 5000) // Poll every 5 seconds
    
    setPollingInterval(interval)
  }

  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      setPollingInterval(null)
    }
  }

  const fetchFindings = async (analysisRunId?: string) => {
    if (!accessToken) return

    try {
      const queryParams: any = { submission_id: params.id }
      if (analysisRunId) {
        queryParams.analysis_run_id = analysisRunId
      }

      const response: any = await apiClient.get(`/analysis/submissions/${params.id}/findings`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: queryParams
      })
      setFindings(response.data || response || [])
    } catch (err) {
      console.error('Failed to fetch findings:', err)
    }
  }

  const handleStartAnalysis = async () => {
    if (!accessToken) return

    setAnalyzing(true)
    try {
      await apiClient.post(
        '/analysis/start',
        { submission_id: params.id },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      toast({
        title: "Analysis Started",
        description: "Your submission is being analyzed. This may take a few minutes.",
      })
      
      // Start polling for updates
      startPolling()
      
      // Fetch initial status
      setTimeout(() => {
        fetchAnalysisRuns()
      }, 2000)
    } catch (error: any) {
      console.error('Failed to start analysis:', error)
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: error.response?.data?.detail || "Failed to start analysis. Please try again.",
      })
      setAnalyzing(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0 || !accessToken) return

    setUploading(true)
    try {
      const uploadPromises = Array.from(selectedFiles).map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('submission_id', params.id as string)

        return apiClient.post('/files/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${accessToken}`
          }
        })
      })

      await Promise.all(uploadPromises)
      await fetchFiles() // Refresh the files list
      
      // Clear the file input
      e.target.value = ''
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Failed to upload files. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!accessToken || !submission) return
    if (!confirm('Are you sure you want to delete this submission?')) return

    try {
      await apiClient.delete(`/submissions/${submission.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      router.push('/submissions')
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete submission')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'indexed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'pending_review':
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  if (loading) {
    return (
      <>
        <DashboardNav />
        <div className="flex-1 p-8 pt-6 container">
          <Skeleton className="h-10 w-64 mb-6" />
          <Skeleton className="h-96" />
        </div>
      </>
    )
  }

  if (error || !submission) {
    return (
      <>
        <DashboardNav />
        <div className="flex-1 p-8 pt-6 container">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-600">{error || 'Submission not found'}</p>
              <Button asChild className="mt-4">
                <Link href="/submissions">Back to Submissions</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <DashboardNav />
      <div className="flex-1 p-8 pt-6 container">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/submissions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Submissions
          </Link>
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{submission.name}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className={getStatusColor(submission.status)}>
                {submission.status}
              </Badge>
              {submission.building_type && (
                <Badge variant="outline">{submission.building_type}</Badge>
              )}
              {submission.project_name && (
                <Badge variant="outline">
                  Project: {submission.project_name}
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                Created {formatDistanceToNow(new Date(submission.created_at))} ago
              </span>
            </div>
            {submission.description && (
              <p className="text-muted-foreground mt-2">{submission.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{submission.files_count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                CAD files and documents
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">{submission.status}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Building Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">
                {submission.building_type || 'Not specified'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="files" className="space-y-4">
          <TabsList>
            <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Uploaded Files</CardTitle>
                    <CardDescription>
                      CAD files, drawings, and documents for this submission
                    </CardDescription>
                  </div>
                  <div>
                    <input
                      type="file"
                      id="file-upload-button"
                      multiple
                      accept=".dwg,.dxf,.ifc,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button asChild disabled={uploading}>
                      <label htmlFor="file-upload-button" className="cursor-pointer">
                        <Upload className="mr-2 h-4 w-4" />
                        {uploading ? 'Uploading...' : 'Upload Files'}
                      </label>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {files.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No files uploaded</h3>
                    <p className="text-muted-foreground mb-4">
                      Upload CAD files, DWG, DXF, IFC, or PDF documents to get started
                    </p>
                    <input
                      type="file"
                      id="file-upload-first"
                      multiple
                      accept=".dwg,.dxf,.ifc,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button asChild disabled={uploading}>
                      <label htmlFor="file-upload-first" className="cursor-pointer">
                        <Upload className="mr-2 h-4 w-4" />
                        {uploading ? 'Uploading...' : 'Upload Your First File'}
                      </label>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{file.filename}</p>
                            <p className="text-sm text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">{file.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            {/* Analysis in Progress Banner */}
            {analyzing && (
              <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <Clock className="h-8 w-8 text-blue-600 animate-spin" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                        Analysis in Progress
                      </h3>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Analyzing your submission for compliance issues. This may take a few minutes...
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Analysis Stats */}
            {analysisRuns.length > 0 && findings.length > 0 && !analyzing && (
              <div className="grid gap-4 md:grid-cols-4 mb-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Findings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{findings.length}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Critical
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {findings.filter(f => f.severity === 'critical').length}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Warnings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">
                      {findings.filter(f => f.severity === 'warning').length}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {findings.filter(f => f.severity === 'info').length}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Run Analysis Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Compliance Analysis</CardTitle>
                    <CardDescription>
                      Run AI-powered compliance checks against building codes
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleStartAnalysis}
                    disabled={files.length === 0 || analyzing}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {analyzing ? 'Analyzing...' : 'Run Analysis'}
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Analysis Runs History */}
            {analysisRuns.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Analysis History</CardTitle>
                  <CardDescription>
                    Previous analysis runs and their status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analysisRuns.map((run) => (
                      <div
                        key={run.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:border-primary cursor-pointer transition-colors"
                        onClick={() => {
                          router.push(`/submissions/${params.id}/analysis/${run.id}`)
                        }}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {run.status === 'completed' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : run.status === 'running' ? (
                            <Clock className="h-5 w-5 text-blue-600 animate-spin" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-600" />
                          )}
                          <div className="flex-1">
                            <p className="font-medium">
                              {formatDistanceToNow(new Date(run.created_at))} ago
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {run.findings_count || 0} findings · {run.checks_completed.join(', ') || 'No checks completed'}
                            </p>
                            {run.status === 'failed' && run.error_message && (
                              <p className="text-xs text-red-600 mt-1 line-clamp-2" title={run.error_message}>
                                Error: {run.error_message}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{run.status}</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async (e) => {
                              e.stopPropagation() // Prevent row click
                              if (!confirm('Delete this analysis run and all its findings?')) return
                              try {
                                await apiClient.delete(`/analysis/runs/${run.id}`)
                                toast({
                                  title: 'Analysis Deleted',
                                  description: 'Analysis run has been removed',
                                })
                                fetchAnalysisRuns()
                              } catch (err: any) {
                                toast({
                                  title: 'Delete Failed',
                                  description: err.response?.data?.detail || 'Failed to delete analysis',
                                  variant: 'destructive',
                                })
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Findings List */}
            {findings.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Findings</CardTitle>
                  <CardDescription>
                    Compliance issues and recommendations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {findings.map((finding) => (
                      <div
                        key={finding.id}
                        className="p-4 rounded-lg border"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                finding.severity === 'critical'
                                  ? 'destructive'
                                  : finding.severity === 'warning'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {finding.severity}
                            </Badge>
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
            ) : analysisRuns.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Play className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Ready to analyze</h3>
                    <p className="text-muted-foreground mb-4">
                      Upload CAD files first, then run compliance analysis
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Submission Settings</CardTitle>
                <CardDescription>
                  Manage submission details and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Settings coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
