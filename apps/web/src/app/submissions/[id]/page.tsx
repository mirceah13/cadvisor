'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useLoadingRouter } from '@/hooks/use-loading-router'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api-client'
import { DashboardNav } from '@/components/dashboard-nav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { FileDetailsTab } from '@/components/file-details-tab'
import { AnalysisProgress } from '@/components/analysis-progress'
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
  Play,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  FolderOpen,
  Calendar,
  BarChart3,
  Settings,
  Download,
  ExternalLink
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
  const router = useLoadingRouter()
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
  const [runningAnalysisId, setRunningAnalysisId] = useState<string | null>(null)
  const [uploadedFilesState, setUploadedFilesState] = useState<{id: string, name: string, status: string, metadata?: any}[]>([])
  const [isParsingFiles, setIsParsingFiles] = useState(false)
  const [fileParsingInterval, setFileParsingInterval] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchSubmission()
    fetchFiles()
    fetchAnalysisRuns()
    
    // Cleanup polling on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
      if (fileParsingInterval) {
        clearInterval(fileParsingInterval)
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
      
      // Only update state if data has actually changed
      const hasChanged = JSON.stringify(runs) !== JSON.stringify(analysisRuns)
      if (hasChanged) {
        setAnalysisRuns(runs)
      }
      
      // Check if any run is in progress
      const runningRun = runs.find((r: AnalysisRun) => r.status === 'running')
      const latestRun = runs[0]
      
      if (runningRun) {
        // Only update states if the running analysis ID changed
        if (runningAnalysisId !== runningRun.id) {
          setRunningAnalysisId(runningRun.id)
        }
        if (!analyzing) {
          setAnalyzing(true)
        }
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
        setRunningAnalysisId(null)
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

  const checkFileParsingStatus = async () => {
    if (!accessToken || uploadedFilesState.length === 0) return

    try {
      const updatedFiles = [...uploadedFilesState]
      let allDone = true

      for (let i = 0; i < updatedFiles.length; i++) {
        if (updatedFiles[i].status === 'parsing') {
          const response: any = await apiClient.get(`/files/${updatedFiles[i].id}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
          const fileData = response.data || response

          if (fileData.parsed_metadata) {
            const processingStatus = fileData.parsed_metadata.processing_status
            if (processingStatus === 'completed' || processingStatus === 'partial') {
              updatedFiles[i].status = 'completed'
              updatedFiles[i].metadata = fileData.parsed_metadata
            } else if (processingStatus === 'failed') {
              updatedFiles[i].status = 'failed'
              updatedFiles[i].metadata = fileData.parsed_metadata
            } else {
              allDone = false
            }
          } else {
            allDone = false
          }
        }
      }

      setUploadedFilesState(updatedFiles)

      // Stop polling if all files are processed
      if (allDone) {
        if (fileParsingInterval) {
          clearInterval(fileParsingInterval)
          setFileParsingInterval(null)
        }
        setIsParsingFiles(false)
        await fetchFiles() // Refresh the full files list
        
        toast({
          title: "Files Processed",
          description: "All files have been processed successfully.",
        })
      }
    } catch (error) {
      console.error('Failed to check parsing status:', error)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0 || !accessToken) return

    setUploading(true)
    setIsParsingFiles(true)
    
    try {
      const uploaded: {id: string, name: string, status: string, metadata?: any}[] = []
      
      for (const file of selectedFiles) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('submission_id', params.id as string)

        try {
          const response: any = await apiClient.post('/files/upload', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${accessToken}`
            }
          })
          const uploadedFile = response.data || response
          uploaded.push({
            id: uploadedFile.id,
            name: file.name,
            status: 'parsing'
          })
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error)
          uploaded.push({
            id: Math.random().toString(),
            name: file.name,
            status: 'failed'
          })
        }
      }
      
      setUploadedFilesState(uploaded)
      setUploading(false)
      
      // Clear the file input
      e.target.value = ''
      
      // Start polling for file parsing status
      const interval = setInterval(checkFileParsingStatus, 2000)
      setFileParsingInterval(interval)
      
      toast({
        title: "Files Uploaded",
        description: `${selectedFiles.length} file(s) uploaded. Processing in background...`,
      })
    } catch (error) {
      console.error('Upload failed:', error)
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Failed to upload files. Please try again.",
      })
      setUploading(false)
      setIsParsingFiles(false)
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
      <div className="flex-1 space-y-8 p-8 pt-6 container max-w-7xl">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-8 text-primary-foreground shadow-2xl">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000,transparent)]" />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    asChild
                    className="text-primary-foreground/90 hover:text-primary-foreground hover:bg-white/10 -ml-2"
                  >
                    <Link href="/submissions">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Submissions
                    </Link>
                  </Button>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                    <FileText className="h-8 w-8" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold tracking-tight">{submission.name}</h1>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <Badge 
                        className={`${getStatusColor(submission.status)} bg-white/20 text-white border-white/30`}
                      >
                        {submission.status}
                      </Badge>
                      {submission.building_type && (
                        <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                          {submission.building_type}
                        </Badge>
                      )}
                      {submission.project_name && (
                        <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                          <FolderOpen className="h-3 w-3 mr-1" />
                          {submission.project_name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {submission.description && (
                  <p className="text-primary-foreground/90 text-lg max-w-3xl">
                    {submission.description}
                  </p>
                )}
                <div className="flex items-center gap-6 text-sm text-primary-foreground/80">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Created {formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>{submission.files_count} {submission.files_count === 1 ? 'File' : 'Files'}</span>
                  </div>
                  {analysisRuns.length > 0 && (
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      <span>{analysisRuns.length} {analysisRuns.length === 1 ? 'Analysis' : 'Analyses'}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                {!analyzing && files.length > 0 && !isParsingFiles && (
                  <Button 
                    onClick={handleStartAnalysis}
                    className="bg-white text-primary hover:bg-white/90 shadow-lg"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start Analysis
                  </Button>
                )}
                {(analyzing || isParsingFiles) && (
                  <Button 
                    disabled
                    className="bg-white/50 text-primary cursor-not-allowed"
                  >
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    {isParsingFiles ? 'Processing files...' : 'Analyzing...'}
                  </Button>
                )}
                <Button 
                  variant="outline"
                  className="border-red-300/50 text-white hover:bg-red-500/20 hover:border-red-300"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{submission.files_count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                CAD files uploaded
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Analyses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{analysisRuns.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {analysisRuns.filter(r => r.status === 'completed').length} completed
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Findings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{findings.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {findings.filter(f => f.severity === 'critical').length} critical
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                {submission.status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize text-green-600">
                {submission.status}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {submission.building_type || 'Type not specified'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="files" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="files" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileText className="h-4 w-4 mr-2" />
              Files ({files.length})
            </TabsTrigger>
            <TabsTrigger value="details" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="h-4 w-4 mr-2" />
              File Details
            </TabsTrigger>
            <TabsTrigger value="analysis" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Play className="h-4 w-4 mr-2" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="space-y-4">
            <Card className="border-2">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Uploaded Files
                    </CardTitle>
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
                      disabled={uploading || isParsingFiles}
                    />
                    <Button asChild disabled={uploading || isParsingFiles} className="shadow-sm">
                      <label htmlFor="file-upload-button" className={uploading || isParsingFiles ? 'cursor-not-allowed' : 'cursor-pointer'}>
                        <Upload className="mr-2 h-4 w-4" />
                        {uploading ? 'Uploading...' : isParsingFiles ? 'Processing...' : 'Upload Files'}
                      </label>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {/* File Parsing Progress */}
                {uploadedFilesState.length > 0 && isParsingFiles && (
                  <Card className="mb-6 border-2 border-blue-500 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                        <Clock className="h-5 w-5 animate-spin" />
                        Processing Files
                      </CardTitle>
                      <CardDescription className="text-blue-700 dark:text-blue-300">
                        Please wait while your files are being parsed...
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {uploadedFilesState.map((file, index) => (
                          <div key={index} className="flex items-center gap-3 rounded-lg border bg-white dark:bg-blue-950 p-3">
                            <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{file.name}</p>
                              {file.status === 'parsing' && (
                                <p className="text-xs text-muted-foreground">Parsing file...</p>
                              )}
                              {file.status === 'completed' && file.metadata && (
                                <p className="text-xs text-green-600">
                                  {file.metadata.processing_status === 'partial' 
                                    ? 'Parsed with warnings' 
                                    : 'Successfully parsed'}
                                </p>
                              )}
                              {file.status === 'failed' && (
                                <p className="text-xs text-destructive">
                                  {file.metadata?.message || 'Processing failed'}
                                </p>
                              )}
                            </div>
                            <div className="flex-shrink-0">
                              {file.status === 'parsing' && (
                                <Clock className="h-4 w-4 animate-spin text-primary" />
                              )}
                              {file.status === 'completed' && (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              )}
                              {file.status === 'failed' && (
                                <AlertCircle className="h-4 w-4 text-destructive" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {files.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="p-4 bg-primary/10 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                      <FileText className="h-12 w-12 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">No files uploaded</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Upload CAD files (.dwg, .dxf), IFC models, or PDF documents to get started with analysis
                    </p>
                    <input
                      type="file"
                      id="file-upload-first"
                      multiple
                      accept=".dwg,.dxf,.ifc,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button asChild disabled={uploading || isParsingFiles} size="lg" className="shadow-lg">
                      <label htmlFor="file-upload-first" className={uploading || isParsingFiles ? 'cursor-not-allowed' : 'cursor-pointer'}>
                        <Upload className="mr-2 h-5 w-5" />
                        {uploading ? 'Uploading...' : isParsingFiles ? 'Processing...' : 'Upload Your First File'}
                      </label>
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {files.map((file, index) => (
                      <div
                        key={file.id}
                        className="group flex items-center justify-between p-4 rounded-lg border-2 border-transparent hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                            <FileText className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-base group-hover:text-primary transition-colors">
                              {file.filename}
                            </p>
                            <div className="flex items-center gap-4 mt-1">
                              <p className="text-sm text-muted-foreground">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                              <Badge 
                                variant={file.status === 'completed' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {file.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="hover:bg-primary/20"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="hover:bg-primary/20"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="details" className="space-y-4">
            <FileDetailsTab profile={(submission as any)?.profile} files={files} />
          </TabsContent>
          <TabsContent value="analysis" className="space-y-6">
            {/* Analysis in Progress Banner */}
            {runningAnalysisId && (
              <Card className="border-2 border-blue-500 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white dark:bg-blue-950 rounded-full">
                      <Clock className="h-8 w-8 text-blue-600 animate-spin" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">
                        Analysis in Progress
                      </h3>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Analyzing your submission for compliance issues. This may take a few minutes...
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Analysis Stats */}
            {analysisRuns.length > 0 && findings.length > 0 && !analyzing && (
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="border-l-4 border-l-primary hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Total Findings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">{findings.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">Issues detected</p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-red-500 hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Critical
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600">
                      {findings.filter(f => f.severity === 'critical').length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Requires immediate action</p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-yellow-500 hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Warnings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-yellow-600">
                      {findings.filter(f => f.severity === 'warning').length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Needs attention</p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">
                      {findings.filter(f => f.severity === 'info').length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Informational</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Run Analysis Card */}
            <Card className="border-2">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Play className="h-5 w-5 text-primary" />
                      Compliance Analysis
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Run AI-powered compliance checks against building codes and regulations
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleStartAnalysis}
                    disabled={files.length === 0 || !!runningAnalysisId}
                    size="lg"
                    className="shadow-lg"
                  >
                    <Play className="mr-2 h-5 w-5" />
                    {runningAnalysisId ? 'Analyzing...' : 'Run Analysis'}
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Progress Display */}
            {runningAnalysisId && (
              <AnalysisProgress 
                key={runningAnalysisId}
                runId={runningAnalysisId}
                onComplete={() => {
                  setAnalyzing(false)
                  setRunningAnalysisId(null)
                  fetchAnalysisRuns()
                  if (analysisRuns[0]?.id) {
                    fetchFindings(analysisRuns[0].id)
                  }
                }}
                onError={() => {
                  setAnalyzing(false)
                  setRunningAnalysisId(null)
                  fetchAnalysisRuns()
                }}
              />
            )}

            {/* Analysis Runs History */}
            {analysisRuns.length > 0 && (
              <Card className="border-2">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Analysis History
                  </CardTitle>
                  <CardDescription>
                    Previous analysis runs and their results
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {analysisRuns.map((run, index) => (
                      <div
                        key={run.id}
                        className="group flex items-center justify-between p-4 rounded-lg border-2 border-transparent hover:border-primary/30 hover:bg-primary/5 cursor-pointer transition-all duration-200"
                        onClick={() => {
                          router.push(`/submissions/${params.id}/analysis/${run.id}`)
                        }}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className={`p-2 rounded-lg ${
                            run.status === 'completed' ? 'bg-green-100 dark:bg-green-950' :
                            run.status === 'running' ? 'bg-blue-100 dark:bg-blue-950' :
                            'bg-red-100 dark:bg-red-950'
                          }`}>
                            {run.status === 'completed' ? (
                              <CheckCircle2 className="h-6 w-6 text-green-600" />
                            ) : run.status === 'running' ? (
                              <Clock className="h-6 w-6 text-blue-600 animate-spin" />
                            ) : (
                              <AlertCircle className="h-6 w-6 text-red-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <p className="font-semibold text-base group-hover:text-primary transition-colors">
                                Analysis #{analysisRuns.length - index}
                              </p>
                              <Badge 
                                variant={run.status === 'completed' ? 'default' : run.status === 'running' ? 'secondary' : 'destructive'}
                              >
                                {run.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })} · {run.findings_count || 0} findings
                            </p>
                            {run.checks_completed && run.checks_completed.length > 0 && (
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {run.checks_completed.slice(0, 3).map((check, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {check}
                                  </Badge>
                                ))}
                                {run.checks_completed.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{run.checks_completed.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            )}
                            {run.status === 'failed' && run.error_message && (
                              <p className="text-xs text-red-600 mt-2 line-clamp-2" title={run.error_message}>
                                Error: {run.error_message}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="hover:bg-primary/20"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="hover:bg-red-100 dark:hover:bg-red-950"
                            onClick={async (e) => {
                              e.stopPropagation()
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
                            <Trash2 className="h-4 w-4 text-red-600" />
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
              <Card className="border-2">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-primary" />
                    Compliance Findings
                  </CardTitle>
                  <CardDescription>
                    Issues, warnings, and recommendations from the analysis
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {findings.map((finding, index) => (
                      <div
                        key={finding.id}
                        className={`p-5 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                          finding.severity === 'critical' ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20' :
                          finding.severity === 'warning' ? 'border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20' :
                          'border-blue-200 bg-blue-50/50 dark:bg-blue-950/20'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              className={`${
                                finding.severity === 'critical' ? 'bg-red-600 hover:bg-red-700' :
                                finding.severity === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' :
                                'bg-blue-600 hover:bg-blue-700'
                              } text-white`}
                            >
                              {finding.severity === 'critical' ? '🚨 Critical' :
                               finding.severity === 'warning' ? '⚠️ Warning' :
                               'ℹ️ Info'}
                            </Badge>
                            <Badge variant="outline" className="font-medium">
                              {finding.category}
                            </Badge>
                            {finding.location && (
                              <Badge variant="secondary" className="text-xs">
                                📍 {finding.location}
                              </Badge>
                            )}
                          </div>
                          <Badge 
                            variant="outline"
                            className={finding.status === 'resolved' ? 'border-green-500 text-green-700' : ''}
                          >
                            {finding.status}
                          </Badge>
                        </div>
                        <h4 className="font-bold text-lg mb-2 text-foreground">
                          {finding.title}
                        </h4>
                        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                          {finding.description}
                        </p>
                        {finding.recommendation && (
                          <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-semibold mb-1 text-primary">Recommendation:</p>
                                <p className="text-sm text-foreground">{finding.recommendation}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : analysisRuns.length === 0 ? (
              <Card className="border-2 border-dashed">
                <CardContent className="pt-6">
                  <div className="text-center py-16">
                    <div className="p-4 bg-primary/10 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                      <Play className="h-12 w-12 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Ready to analyze</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Upload CAD files first, then run compliance analysis to identify potential issues
                    </p>
                    {files.length === 0 && (
                      <input
                        type="file"
                        id="file-upload-analysis"
                        multiple
                        accept=".dwg,.dxf,.ifc,.pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    )}
                    {files.length === 0 ? (
                      <Button asChild disabled={uploading} size="lg">
                        <label htmlFor="file-upload-analysis" className="cursor-pointer">
                          <Upload className="mr-2 h-5 w-5" />
                          Upload Files to Start
                        </label>
                      </Button>
                    ) : (
                      <Button onClick={handleStartAnalysis} size="lg" className="shadow-lg">
                        <Play className="mr-2 h-5 w-5" />
                        Run Your First Analysis
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card className="border-2">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  Submission Settings
                </CardTitle>
                <CardDescription>
                  Manage submission details, permissions, and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="text-center py-16">
                  <div className="p-4 bg-muted rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                    <Settings className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Settings Coming Soon</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Advanced settings and configuration options will be available here
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
