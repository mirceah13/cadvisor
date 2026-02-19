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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { FileDetailsTab } from '@/components/file-details-tab'
import { AnalysisProgress } from '@/components/analysis-progress'
import { Progress } from '@/components/ui/progress'
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
  ExternalLink,
  RefreshCw
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
  const [uploadedFilesState, setUploadedFilesState] = useState<{
    id: string
    name: string
    status: string
    uploadProgress?: number
    parsingStage?: string
    startTime?: number
    metadata?: any
  }[]>([])
  const [isParsingFiles, setIsParsingFiles] = useState(false)
  const [fileParsingInterval, setFileParsingInterval] = useState<NodeJS.Timeout | null>(null)
  const [timerTick, setTimerTick] = useState(0)
  const [fileToDelete, setFileToDelete] = useState<{ id: string; filename: string } | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

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

  // Auto-start polling when uploadedFilesState has files and we're marked as parsing
  useEffect(() => {
    if (isParsingFiles && uploadedFilesState.length > 0 && !fileParsingInterval) {
      console.log('[Effect] Auto-starting polling for', uploadedFilesState.length, 'files')
      checkFileParsingStatus()
      const interval = setInterval(checkFileParsingStatus, 2000)
      setFileParsingInterval(interval)
    }
  }, [uploadedFilesState.length, isParsingFiles])

  // Timer to update elapsed time display
  useEffect(() => {
    if (isParsingFiles && uploadedFilesState.length > 0) {
      const timer = setInterval(() => {
        setTimerTick(prev => prev + 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [isParsingFiles, uploadedFilesState.length])

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
      console.log('[Fetch] Fetching files for submission:', params.id)
      const response: any = await apiClient.get('/files', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { submission_id: params.id }
      })
      const fetchedFiles = response.data || response || []
      console.log('[Fetch] Got', fetchedFiles.length, 'files')
      setFiles(fetchedFiles)
      
      // Check if any files are still processing and start polling if needed
      const processingFiles = fetchedFiles.filter((f: any) => {
        const status = f.file_metadata?.processing_status
        const isProcessing = !status || status === 'processing' || status === 'pending'
        console.log('[Fetch] File:', f.filename, '- status:', status, '- consider processing?:', isProcessing)
        return isProcessing
      })
      
      console.log('[Fetch] Found', processingFiles.length, 'files needing polling')
      
      if (processingFiles.length > 0 && !isParsingFiles) {
        // Initialize uploadedFilesState with processing files
        const processingState = processingFiles.map((f: any) => {
          const metadata = f.file_metadata || {}
          const processingStartedAt = metadata.processing_started_at
          
          console.log('[Fetch] Init file:', f.filename, {
            status: metadata.processing_status,
            started_at: processingStartedAt,
            created_at: f.created_at
          })
          
          return {
            id: f.id,
            name: f.filename,
            status: 'parsing',
            parsingStage: 'Processing file...',
            // CRITICAL: Use processing_started_at from metadata, not created_at!
            startTime: processingStartedAt ? new Date(processingStartedAt).getTime() : new Date(f.created_at).getTime()
          }
        })
        
        console.log('[Fetch] Starting polling for', processingState.length, 'files')
        setUploadedFilesState(processingState)
        setIsParsingFiles(true)
        
        // The useEffect will automatically start polling once uploadedFilesState updates
        console.log('[Fetch] State updated, useEffect will trigger polling')
      } else {
        console.log('[Fetch] ✓ No polling needed - all files are complete')
      }
    } catch (err) {
      console.error('[Fetch] ❌ Failed to fetch files:', err)
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

  const retryFileProcessing = async (fileId: string) => {
    if (!accessToken) return

    try {
      await apiClient.post(`/files/${fileId}/retry`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      
      toast({
        title: "Processing Restarted",
        description: "File processing has been queued again.",
      })
      
      // Update file state to show it's being retried
      setUploadedFilesState(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, status: 'parsing', parsingStage: 'Queued for processing...', startTime: Date.now() }
          : f
      ))
      
      // Restart polling if not already running
      if (!fileParsingInterval) {
        checkFileParsingStatus()
        const interval = setInterval(checkFileParsingStatus, 2000)
        setFileParsingInterval(interval)
        setIsParsingFiles(true)
      }
    } catch (error: any) {
      console.error('Failed to retry file processing:', error)
      toast({
        variant: "destructive",
        title: "Retry Failed",
        description: error.response?.data?.detail || "Failed to restart processing. Please try again.",
      })
    }
  }

  const checkFileParsingStatus = async () => {
    if (!accessToken || uploadedFilesState.length === 0) {
      console.log('[Progress] Skipping check - accessToken:', !!accessToken, ', files:', uploadedFilesState.length)
      return
    }

    try {
      console.log('[Progress] ============ POLLING CYCLE START ============')
      console.log('[Progress] Checking', uploadedFilesState.length, 'files')
      console.log('[Progress] Current state:', uploadedFilesState.map(f => ({ 
        name: f.name, 
        status: f.status, 
        startTime: f.startTime,
        elapsed: f.startTime ? ((Date.now() - f.startTime) / 1000).toFixed(1) + 's' : 'no startTime'
      })))
      
      // Use the processing-status endpoint for better performance
      const response: any = await apiClient.get(`/submissions/${params.id}/processing-status`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const data = response.data || response
      
      console.log('[Progress] API Response:', {
        totalFiles: data.files?.length,
        overall: data.overall_status,
        files: data.files?.map((f: any) => ({ 
          filename: f.filename, 
          status: f.processing_status,
          started_at: f.processing_started_at,
          completed_at: f.processing_completed_at
        }))
      })
      
      if (!data.files || data.files.length === 0) {
        console.warn('[Progress] ❌ No files in server response')
        return
      }

      const updatedFiles = [...uploadedFilesState]
      let allDone = true
      let anyUpdated = false

      for (let i = 0; i < updatedFiles.length; i++) {
        // Find matching file in response
        const serverFile = data.files.find((sf: any) => sf.file_id === updatedFiles[i].id)
        
        if (!serverFile) {
          console.warn('[Progress] ❌ File not found in server response:', updatedFiles[i].name, updatedFiles[i].id)
          allDone = false
          continue
        }
        
        const status = serverFile.processing_status
        const oldStatus = updatedFiles[i].status
        console.log('[Progress] 📄', updatedFiles[i].name)
        console.log('[Progress]    → Server status:', status)
        console.log('[Progress]    → Current UI status:', oldStatus)
        console.log('[Progress]    → Server started_at:', serverFile.processing_started_at)
        console.log('[Progress]    → Server completed_at:', serverFile.processing_completed_at)
        
        // CRITICAL FIX: Get processing start time from server metadata (not file creation time!)
        if (!updatedFiles[i].startTime && serverFile.processing_started_at) {
          const newStartTime = new Date(serverFile.processing_started_at).getTime()
          updatedFiles[i].startTime = newStartTime
          console.log('[Progress]    → Set startTime from server:', newStartTime, '(', new Date(newStartTime).toISOString(), ')')
        }
        
        if (status === 'completed' || status === 'partial') {
          if (oldStatus !== 'completed') {
            updatedFiles[i].status = 'completed'
            updatedFiles[i].parsingStage = 'Completed'
            updatedFiles[i].metadata = serverFile
            anyUpdated = true
            console.log('[Progress] ✓ File completed:', updatedFiles[i].name)
          }
        } else if (status === 'failed') {
          if (oldStatus !== 'failed') {
            updatedFiles[i].status = 'failed'
            updatedFiles[i].parsingStage = 'Failed'
            updatedFiles[i].metadata = serverFile
            anyUpdated = true
            console.log('[Progress] ✗ File failed:', updatedFiles[i].name)
          }
        } else if (status === 'processing') {
          // Calculate elapsed time from processing start (not creation!)
          const startTime = updatedFiles[i].startTime || Date.now()
          const elapsed = (Date.now() - startTime) / 1000
          console.log('[Progress] File processing, elapsed:', elapsed.toFixed(1), 's')
          
          // Detect stuck files (processing for > 5 minutes = 300 seconds)
          if (elapsed > 300) {
            if (oldStatus !== 'stuck') {
              updatedFiles[i].status = 'stuck'
              updatedFiles[i].parsingStage = 'Processing appears stuck (task may have been interrupted)'
              anyUpdated = true
              console.warn('[Progress] ⚠ File appears stuck after', elapsed.toFixed(0), 's')
            }
          } else {
            // Update stage based on elapsed time
            let newStage = 'Processing file...'
            if (elapsed < 5) {
              newStage = 'Starting translation...'
            } else if (elapsed < 40) {
              newStage = 'Translating CAD file to SVF2...'
            } else {
              newStage = 'Extracting metadata and properties...'
            }
            
            if (updatedFiles[i].parsingStage !== newStage || updatedFiles[i].status !== 'parsing') {
              updatedFiles[i].parsingStage = newStage
              updatedFiles[i].status = 'parsing'
              anyUpdated = true
            }
          }
          
          if (updatedFiles[i].status !== 'stuck') {
            allDone = false
          }
        } else if (status === 'pending') {
          if (oldStatus !== 'parsing' || updatedFiles[i].parsingStage !== 'Queued for processing...') {
            updatedFiles[i].status = 'parsing'
            updatedFiles[i].parsingStage = 'Queued for processing...'
            // Set startTime when pending to track total time
            if (!updatedFiles[i].startTime) {
              updatedFiles[i].startTime = Date.now()
            }
            anyUpdated = true
          }
          allDone = false
        } else {
          // Unknown status
          console.warn('[Progress] Unknown status:', status)
          updatedFiles[i].status = 'parsing'
          updatedFiles[i].parsingStage = 'Processing file...'
          allDone = false
        }
      }
  
      console.log('[Progress] Status check complete - anyUpdated:', anyUpdated, ', allDone:', allDone)
      
      if (anyUpdated) {
        console.log('[Progress] 🔄 Updating state with new file statuses')
        console.log('[Progress] New state:', updatedFiles.map(f => ({ name: f.name, status: f.status, stage: f.parsingStage })))
        setUploadedFilesState(updatedFiles)
      } else {
        console.log('[Progress] ⏭️  No updates needed, skipping state change')
      }

      // Stop polling if all files are processed
      if (allDone) {
        console.log('[Progress] ✅ All files done, stopping polling')
        if (fileParsingInterval) {
          clearInterval(fileParsingInterval)
          setFileParsingInterval(null)
        }
        setIsParsingFiles(false)

        // Show toast notification
        const successCount = updatedFiles.filter(f => f.status === 'completed').length
        const failedCount = updatedFiles.filter(f => f.status === 'failed').length
        
        if (failedCount === 0) {
          toast({
            title: "Files Processed Successfully",
            description: `All ${successCount} file(s) have been processed and are ready for analysis.`,
          })
        } else if (successCount === 0) {
          toast({
            variant: "destructive",
            title: "Processing Failed",
            description: `${failedCount} file(s) failed to process.`,
          })
        } else {
          toast({
            title: "Processing Complete with Errors",
            description: `${successCount} file(s) processed successfully, ${failedCount} failed.`,
          })
        }
        
        // Refresh the file list to show updated files below
        console.log('[Progress] 🔄 Refreshing file list')
        await fetchFiles()
      }
      
      console.log('[Progress] ============ POLLING CYCLE END ============')
    } catch (error) {
      console.error('[Progress] ❌ Failed to check parsing status:', error)
      // Continue polling even on error
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0 || !accessToken) return

    console.log('[Upload] Starting upload of', selectedFiles.length, 'files')
    setUploading(true)
    setIsParsingFiles(true)
    
    try {
      const uploaded: {
        id: string
        name: string
        status: string
        uploadProgress?: number
        parsingStage?: string
        startTime?: number
        metadata?: any
      }[] = []
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        const startTime = Date.now()
        
        console.log('[Upload] Uploading file', i + 1, '/', selectedFiles.length, ':', file.name)
        
        // Add file to uploaded list with uploading status
        const fileEntry = {
          id: `temp-${i}`,
          name: file.name,
          status: 'uploading',
          uploadProgress: 0,
          startTime
        }
        uploaded.push(fileEntry)
        setUploadedFilesState([...uploaded])
        
        const formData = new FormData()
        formData.append('file', file)
        formData.append('submission_id', params.id as string)

        try {
          // Simulate upload progress
          const progressInterval = setInterval(() => {
            setUploadedFilesState(prev => prev.map(f => 
              f.name === file.name && f.status === 'uploading'
                ? { ...f, uploadProgress: Math.min((f.uploadProgress || 0) + 10, 90) }
                : f
            ))
          }, 200)
          
          const response: any = await apiClient.post('/files/upload', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${accessToken}`
            }
          })
          
          clearInterval(progressInterval)
          
          const uploadedFile = response.data || response
          console.log('[Upload] File uploaded successfully, ID:', uploadedFile.id)
          
          fileEntry.id = uploadedFile.id
          fileEntry.status = 'parsing'
          fileEntry.uploadProgress = 100
          fileEntry.parsingStage = 'Queued for processing...'
          uploaded[i] = fileEntry
          setUploadedFilesState([...uploaded])
        } catch (error) {
          console.error(`[Upload] ❌ Failed to upload ${file.name}:`, error)
          fileEntry.status = 'failed'
          fileEntry.uploadProgress = 0
          uploaded[i] = fileEntry
          setUploadedFilesState([...uploaded])
        }
      }
      
      setUploading(false)
      
      console.log('[Upload] ✓ Upload complete -', uploaded.length, 'files ready for polling')
      console.log('[Upload] Files:', uploaded.map(f => ({ id: f.id, name: f.name, status: f.status })))
      console.log('[Upload] State will trigger polling via useEffect')
      
      // Clear the file input
      e.target.value = ''
      
      // The useEffect will automatically start polling once uploadedFilesState updates
      
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

  const handleDownloadFile = async (fileId: string, filename: string) => {
    try {
      await apiClient.downloadFile(`/files/${fileId}/download`, filename)
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: err.response?.data?.detail || "Failed to download file",
      })
    }
  }

  const handleOpenFile = async (fileId: string) => {
    try {
      await apiClient.openFileInNewTab(`/files/${fileId}/download`)
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Cannot Open File",
        description: err.response?.data?.detail || "Failed to open file",
      })
    }
  }

  const handleDeleteFile = async (fileId: string, filename: string) => {
    try {
      await apiClient.delete(`/files/${fileId}`)
      toast({
        title: "File Deleted",
        description: `${filename} has been deleted.`,
      })
      setDeleteDialogOpen(false)
      setFileToDelete(null)
      await fetchFiles()
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: err.response?.data?.detail || "Failed to delete file",
      })
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
                    className="bg-white dark:bg-white text-primary hover:bg-gray-50 dark:hover:bg-gray-100 shadow-lg border-2 border-white/20"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start Analysis
                  </Button>
                )}
                {(analyzing || isParsingFiles) && (
                  <Button 
                    disabled
                    className="bg-white/60 dark:bg-white/50 text-primary border-2 border-white/30 cursor-not-allowed"
                  >
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    {isParsingFiles ? 'Processing files...' : 'Analyzing...'}
                  </Button>
                )}
                <Button 
                  variant="outline"
                  className="border-2 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:border-white/50 backdrop-blur-sm"
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
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid bg-muted/50 p-1">
            <TabsTrigger 
              value="files" 
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground transition-colors"
            >
              <FileText className="h-4 w-4 mr-2" />
              Files ({files.length})
            </TabsTrigger>
            <TabsTrigger 
              value="details" 
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground transition-colors"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              File Details
            </TabsTrigger>
            <TabsTrigger 
              value="analysis" 
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground transition-colors"
            >
              <Play className="h-4 w-4 mr-2" />
              Analysis
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground transition-colors"
            >
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
                      <div className="space-y-4">
                        {uploadedFilesState.map((file, index) => {
                          const elapsedSeconds = file.startTime ? Math.floor((Date.now() - file.startTime) / 1000) : 0
                          const elapsedDisplay = elapsedSeconds > 0 ? `${elapsedSeconds}s` : '0s'
                          
                          return (
                            <div key={index} className="rounded-lg border bg-white dark:bg-blue-950 p-4 space-y-3">
                              <div className="flex items-start gap-3">
                                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0 space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium truncate">{file.name}</p>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {file.status === 'uploading' && (
                                        <span className="text-xs text-muted-foreground">Uploading...</span>
                                      )}
                                      {file.status === 'parsing' && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <Clock className="h-3 w-3" />
                                          {elapsedDisplay}
                                        </div>
                                      )}
                                      {file.status === 'stuck' && (
                                        <div className="flex items-center gap-1.5 text-xs text-amber-600">
                                          <AlertCircle className="h-3 w-3" />
                                          {elapsedDisplay}
                                        </div>
                                      )}
                                      <div className="flex-shrink-0">
                                        {(file.status === 'uploading' || file.status === 'parsing') && (
                                          <Clock className="h-4 w-4 animate-spin text-primary" />
                                        )}
                                        {file.status === 'stuck' && (
                                          <AlertCircle className="h-4 w-4 text-amber-500" />
                                        )}
                                        {file.status === 'completed' && (
                                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        )}
                                        {file.status === 'failed' && (
                                          <AlertCircle className="h-4 w-4 text-destructive" />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Upload Progress Bar */}
                                  {file.status === 'uploading' && (
                                    <div className="space-y-1">
                                      <Progress value={file.uploadProgress || 0} className="h-2" />
                                      <p className="text-xs text-muted-foreground">
                                        {file.uploadProgress || 0}% uploaded
                                      </p>
                                    </div>
                                  )}
                                  
                                  {/* Parsing Status with Progress Indicator */}
                                  {file.status === 'parsing' && (
                                    <div className="space-y-2">
                                      {/* Animated progress bar */}
                                      <div className="flex items-center gap-2">
                                        <div className="h-2 flex-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                                          <div 
                                            className="h-full rounded-full absolute inset-0 bg-gradient-to-r from-blue-400 via-blue-600 to-blue-400"
                                            style={{ 
                                              width: '100%',
                                              animation: 'gradient 3s ease infinite',
                                              backgroundSize: '200% 100%'
                                            }}
                                          />
                                        </div>
                                      </div>
                                      {/* Stage description */}
                                      <div className="flex items-start gap-2">
                                        <div className="flex-1">
                                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                            {file.parsingStage || 'Processing file...'}
                                          </p>
                                          {file.parsingStage?.includes('Translating') && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                              This typically takes 30-60 seconds
                                            </p>
                                          )}
                                          {file.parsingStage?.includes('Extracting') && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                              Extracting CAD properties and metadata
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Stuck File Status with Retry Button */}
                                  {file.status === 'stuck' && (
                                    <div className="space-y-3">
                                      <div className="flex items-start gap-2">
                                        <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                          <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                                            {file.parsingStage || 'Processing appears stuck'}
                                          </p>
                                          <p className="text-xs text-muted-foreground mt-1">
                                            The processing task may have been interrupted. You can retry to restart processing.
                                          </p>
                                        </div>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => retryFileProcessing(file.id)}
                                        className="w-full border-2 border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-600 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50 dark:border-amber-700 dark:hover:border-amber-600"
                                      >
                                        <RefreshCw className="h-3 w-3 mr-2" />
                                        Retry Processing
                                      </Button>
                                    </div>
                                  )}
                                  
                                  {/* Completion Status */}
                                  {file.status === 'completed' && file.metadata && (
                                    <p className="text-xs text-green-600 font-medium">
                                      ✓ {file.metadata.processing_status === 'partial' 
                                        ? 'Parsed with warnings' 
                                        : 'Successfully parsed'}
                                      {elapsedSeconds > 0 && ` in ${elapsedDisplay}`}
                                    </p>
                                  )}
                                  
                                  {/* Error Status */}
                                  {file.status === 'failed' && (
                                    <p className="text-xs text-destructive font-medium">
                                      ✗ {file.metadata?.message || 'Processing failed'}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
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
                            className="hover:bg-primary/20 hover:text-primary"
                            onClick={() => handleDownloadFile(file.id, file.filename)}
                            title="Download file"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="hover:bg-primary/20 hover:text-primary"
                            onClick={() => handleOpenFile(file.id)}
                            title="Open file in new tab"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="hover:bg-destructive/20 hover:text-destructive"
                            onClick={() => {
                              setFileToDelete({ id: file.id, filename: file.filename })
                              setDeleteDialogOpen(true)
                            }}
                            title="Delete file"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Delete File Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <strong>{fileToDelete?.filename}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteDialogOpen(false); setFileToDelete(null) }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (fileToDelete) {
                  handleDeleteFile(fileToDelete.id, fileToDelete.filename)
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
