'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useLoadingRouter } from '@/hooks/use-loading-router'
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
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { FileDetailsTab } from '@/components/file-details-tab'
import { AnalysisProgress } from '@/components/analysis-progress'
import { Progress } from '@/components/ui/progress'
import { PageHeader } from '@/components/page-header'
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
  const { toast } = useToast()
  
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [files, setFiles] = useState<any[]>([])
  const [analysisRuns, setAnalysisRuns] = useState<AnalysisRun[]>([])
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
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
  const uploadedFilesStateRef = useRef<typeof uploadedFilesState>([])
  const [isParsingFiles, setIsParsingFiles] = useState(false)
  const fileParsingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [timerTick, setTimerTick] = useState(0)
  const [fileToDelete, setFileToDelete] = useState<{ id: string; filename: string } | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [showDeleteSubmissionDialog, setShowDeleteSubmissionDialog] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('files')
  const [detailsFileId, setDetailsFileId] = useState<string | null>(null)

  // Keep ref in sync with latest uploadedFilesState every render
  useEffect(() => {
    uploadedFilesStateRef.current = uploadedFilesState
  })

  useEffect(() => {
    fetchSubmission()
    fetchFiles()
    fetchAnalysisRuns()
    
    // Cleanup polling on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
      if (fileParsingIntervalRef.current) {
        clearInterval(fileParsingIntervalRef.current)
      }
    }
  }, [params.id])

  // Auto-start polling when uploadedFilesState has files and we're marked as parsing
  useEffect(() => {
    if (isParsingFiles && uploadedFilesState.length > 0 && !fileParsingIntervalRef.current) {
      console.log('[Effect] Auto-starting polling for', uploadedFilesState.length, 'files')
      checkFileParsingStatus()
      const interval = setInterval(checkFileParsingStatus, 2000)
      fileParsingIntervalRef.current = interval
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
    try {
      const data = await apiClient.get<Submission>(`/submissions/${params.id}`)
      setSubmission(data)
      setEditForm({ name: data.name, description: data.description ?? '' })
    } catch (err: any) {
      console.error('Failed to fetch submission:', err)
      setError(err.response?.data?.detail || 'Failed to load submission')
    } finally {
      setLoading(false)
    }
  }

  const fetchFiles = async () => {
    try {
      console.log('[Fetch] Fetching files for submission:', params.id)
      const fetchedFiles = (await apiClient.get<any[]>(`/files?submission_id=${params.id}`)) || []
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
    try {
      const runs = (await apiClient.get<AnalysisRun[]>(`/analysis/submissions/${params.id}/runs`)) || []
      
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
    if (pollingIntervalRef.current) return
    
    const interval = setInterval(() => {
      fetchAnalysisRuns()
    }, 5000) // Poll every 5 seconds
    
    pollingIntervalRef.current = interval
  }

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }

  const fetchFindings = async (analysisRunId?: string) => {
    try {
      const qs = analysisRunId ? `?analysis_run_id=${analysisRunId}` : ''
      const data = (await apiClient.get<Finding[]>(`/analysis/submissions/${params.id}/findings${qs}`)) || []
      setFindings(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch findings:', err)
    }
  }

  const handleStartAnalysis = async () => {
    setAnalyzing(true)
    try {
      await apiClient.post('/analysis/start', { submission_id: params.id })

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
    try {
      await apiClient.post(`/files/${fileId}/retry`, {})
      
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
      if (!fileParsingIntervalRef.current) {
        checkFileParsingStatus()
        const interval = setInterval(checkFileParsingStatus, 2000)
        fileParsingIntervalRef.current = interval
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
    if (uploadedFilesStateRef.current.length === 0) {
      console.log('[Progress] Skipping check - files:', uploadedFilesStateRef.current.length)
      return
    }

    try {
      console.log('[Progress] ============ POLLING CYCLE START ============')
      console.log('[Progress] Checking', uploadedFilesStateRef.current.length, 'files')
      console.log('[Progress] Current state:', uploadedFilesStateRef.current.map(f => ({ 
        name: f.name, 
        status: f.status, 
        startTime: f.startTime,
        elapsed: f.startTime ? ((Date.now() - f.startTime) / 1000).toFixed(1) + 's' : 'no startTime'
      })))
      
      // Use the processing-status endpoint for better performance
      const data = await apiClient.get<any>(`/submissions/${params.id}/processing-status`)
      
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

      const updatedFiles = [...uploadedFilesStateRef.current]
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
        if (fileParsingIntervalRef.current) {
          clearInterval(fileParsingIntervalRef.current)
          fileParsingIntervalRef.current = null
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
    if (!selectedFiles || selectedFiles.length === 0) return

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
          
          const uploadedFile = await apiClient.post<any>('/files/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })
          
          clearInterval(progressInterval)
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
    if (!submission) return
    try {
      await apiClient.delete(`/submissions/${submission.id}`)
      router.push('/submissions')
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: err.response?.data?.detail || 'Failed to delete submission' })
    }
  }

  const handleUpdateSubmission = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!submission) return
    setSaving(true)
    try {
      const updated = await apiClient.put<Submission>(`/submissions/${submission.id}`, {
        name: editForm.name,
        description: editForm.description || undefined,
      })
      setSubmission(updated)
      toast({ title: 'Saved', description: 'Submission updated successfully.' })
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: err.response?.data?.detail || 'Failed to update submission.' })
    } finally {
      setSaving(false)
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
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center max-w-md">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
            <p className="text-sm text-destructive mb-4">{error || 'Submission not found'}</p>
            <Button asChild variant="outline">
              <Link href="/submissions">Back to Submissions</Link>
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <DashboardNav />
      <div className="flex-1 space-y-6 p-6 pt-6 container max-w-7xl">
        {/* Hero Section */}
        <PageHeader
          title={submission.name}
          description={submission.description || undefined}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild className="-ml-2">
                <Link href="/submissions">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowDeleteSubmissionDialog(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          }
        />

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap -mt-4">
          <Badge variant="secondary">{submission.status}</Badge>
          {submission.building_type && (
            <Badge variant="outline">{submission.building_type}</Badge>
          )}
          {submission.project_name && (
            <Badge variant="outline">
              <FolderOpen className="h-3 w-3 mr-1" />
              {submission.project_name}
            </Badge>
          )}
          <span className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}
          </span>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Files</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{submission.files_count}</div>
              <p className="text-xs text-muted-foreground mt-1">CAD files uploaded</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Analyses</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{analysisRuns.length}</div>
              <p className="text-xs text-muted-foreground mt-1">{analysisRuns.filter(r => r.status === 'completed').length} completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Findings</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{findings.length}</div>
              <p className="text-xs text-muted-foreground mt-1">{findings.filter(f => f.severity === 'critical').length} critical</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
              {submission.status === 'completed' ? (
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">{submission.status}</div>
              <p className="text-xs text-muted-foreground mt-1">{submission.building_type || 'Type not specified'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="border-b">
            <TabsList className="h-auto w-full rounded-none bg-transparent p-0">
              <TabsTrigger
                value="files"
                className="flex flex-1 items-center justify-center gap-2 rounded-none border-b-2 border-transparent px-4 py-3 font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors"
              >
                <FileText className="h-4 w-4" />
                Files
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums">{files.length}</span>
              </TabsTrigger>
              <TabsTrigger
                value="details"
                className="flex flex-1 items-center justify-center gap-2 rounded-none border-b-2 border-transparent px-4 py-3 font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors"
              >
                <BarChart3 className="h-4 w-4" />
                CAD Metadata
              </TabsTrigger>
              <TabsTrigger
                value="analysis"
                className="flex flex-1 items-center justify-center gap-2 rounded-none border-b-2 border-transparent px-4 py-3 font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors"
              >
                <Play className="h-4 w-4" />
                Analysis
                {analysisRuns.length > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums">{analysisRuns.length}</span>
                )}
                {findings.length > 0 && (
                  <span className="rounded-full bg-destructive/10 text-destructive px-1.5 py-0.5 text-xs font-semibold tabular-nums">{findings.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="flex flex-1 items-center justify-center gap-2 rounded-none border-b-2 border-transparent px-4 py-3 font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors"
              >
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="files" className="space-y-4">
            <Card className="border-2">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
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
                  <Card className="mb-6 border-2 border-border bg-muted/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 animate-spin text-primary" />
                        Processing Files
                      </CardTitle>
                      <CardDescription>
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
                                        <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden relative">
                                          <div 
                                            className="h-full rounded-full absolute inset-0 bg-primary animate-indeterminate"
                                          />
                                        </div>
                                      </div>
                                      {/* Stage description */}
                                      <div className="flex items-start gap-2">
                                        <div className="flex-1">
                                          <p className="text-xs text-primary font-medium">
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
                                        <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                          <p className="text-sm text-muted-foreground font-medium">
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
                                        className="w-full"
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
                  <div className="rounded-md border border-dashed p-12 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-sm font-semibold mb-1">No files uploaded</h3>
                    <p className="text-muted-foreground mb-4 text-sm max-w-md mx-auto">
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
                    <Button asChild disabled={uploading || isParsingFiles} size="lg">
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
                        <div
                          className="flex items-center gap-4 flex-1 cursor-pointer"
                          onClick={() => { setDetailsFileId(file.id); setActiveTab('details') }}
                        >
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
            <FileDetailsTab profile={(submission as any)?.profile} files={files} initialFileId={detailsFileId} />
          </TabsContent>
          <TabsContent value="analysis" className="space-y-6">
            {/* Analysis in Progress Banner */}
            {runningAnalysisId && (
              <Card className="border-2 border-border bg-muted/30">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <Clock className="h-6 w-6 text-primary animate-spin shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold">Analysis in Progress</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Analyzing your submission for compliance issues. This may take a few minutes...
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Analysis Stats — compact inline bar */}
            {analysisRuns.length > 0 && findings.length > 0 && !analyzing && (() => {
              const critical = findings.filter(f => f.severity === 'critical').length
              const warnings = findings.filter(f => f.severity === 'warning').length
              const info = findings.filter(f => f.severity === 'info').length
              return (
                <div className="flex items-stretch divide-x divide-border rounded-xl border bg-muted/30 overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-3 flex-1">
                    <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xl font-bold leading-none">{findings.length}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Total findings</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-3 flex-1">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <div>
                      <p className={`text-xl font-bold leading-none ${critical > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>{critical}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Critical</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-3 flex-1">
                    <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                    <div>
                      <p className={`text-xl font-bold leading-none ${warnings > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`}>{warnings}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Warnings</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-3 flex-1">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                    <div>
                      <p className={`text-xl font-bold leading-none ${info > 0 ? 'text-blue-500' : 'text-muted-foreground'}`}>{info}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Info</p>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Run Analysis Card */}
            <div className="flex items-center justify-between px-5 py-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <Play className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-sm">Compliance Analysis</p>
                  <p className="text-xs text-muted-foreground">AI-powered compliance checks against building codes and regulations</p>
                </div>
              </div>
              <Button
                onClick={handleStartAnalysis}
                disabled={files.length === 0 || !!runningAnalysisId}
                className="shadow-sm shrink-0"
              >
                <Play className="mr-2 h-4 w-4" />
                {runningAnalysisId ? 'Analyzing…' : 'Run Analysis'}
              </Button>
            </div>

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
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Analysis History</CardTitle>
                  </div>
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
                          <div className="shrink-0">
                            {run.status === 'completed' ? (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            ) : run.status === 'running' ? (
                              <Clock className="h-5 w-5 text-muted-foreground animate-spin" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-destructive" />
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
                              <p className="text-xs text-destructive mt-2 line-clamp-2" title={run.error_message}>
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
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Compliance Findings</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {findings.map((finding, index) => (
                      <div
                        key={finding.id}
                        className="rounded-lg border transition-all duration-200"
                      >
                        {/* Header row */}
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-inherit">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            finding.severity === 'critical' ? 'bg-red-500' :
                            finding.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                          }`} />
                          <Badge
                            className={`text-[10px] px-1.5 h-4 ${
                              finding.severity === 'critical' ? 'bg-red-600 hover:bg-red-700' :
                              finding.severity === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' :
                              'bg-blue-600 hover:bg-blue-700'
                            } text-white`}
                          >
                            {finding.severity}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 h-4">
                            {finding.category}
                          </Badge>
                          {finding.location && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                              {finding.location}
                            </Badge>
                          )}
                          <div className="flex-1" />
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 h-4 ${
                              finding.status === 'resolved' ? 'border-green-600 text-green-500' : ''
                            }`}
                          >
                            {finding.status}
                          </Badge>
                        </div>
                        {/* Body */}
                        <div className="px-4 py-3 space-y-2">
                          <p className="font-semibold text-sm">{finding.title}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{finding.description}</p>
                          {finding.recommendation && (
                            <div className="flex items-start gap-2 pt-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                              <p className="text-xs text-foreground/80">{finding.recommendation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : analysisRuns.length === 0 ? (
              <Card className="border-2 border-dashed">
                <CardContent className="pt-6">
                  <div className="rounded-md border border-dashed p-12 text-center">
                    <Play className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-sm font-semibold mb-1">Ready to analyze</h3>
                    <p className="text-muted-foreground mb-4 text-sm max-w-md mx-auto">
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
                      <Button onClick={handleStartAnalysis} size="lg">
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
              <CardHeader className="border-b">
                <CardTitle>Edit Submission</CardTitle>
                <CardDescription>Update the name and description for this submission</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleUpdateSubmission} className="space-y-4 max-w-lg">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Name</Label>
                    <Input
                      id="edit-name"
                      value={editForm.name}
                      onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={editForm.description}
                      onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
                      rows={3}
                      placeholder="Optional description..."
                    />
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>Permanently delete this submission and all associated files and analysis results</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={() => setShowDeleteSubmissionDialog(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Submission
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Submission Confirmation Dialog */}
      <AlertDialog open={showDeleteSubmissionDialog} onOpenChange={setShowDeleteSubmissionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Submission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{submission?.name}</strong>? This will also delete all uploaded files and analysis results. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete Submission
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
