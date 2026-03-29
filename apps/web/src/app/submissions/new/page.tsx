'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLoadingRouter } from '@/hooks/use-loading-router'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api-client'
import { DashboardNav } from '@/components/dashboard-nav'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Loader2, Upload, X, FileText, CheckCircle2, AlertCircle, Clock, RefreshCw } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface UploadedFile {
  id: string
  name: string
  status: 'uploading' | 'parsing' | 'completed' | 'failed' | 'stuck'
  uploadProgress?: number
  parsingStage?: string
  startTime?: number
  metadata?: any
}

function NewSubmissionPageInner() {
  const router = useLoadingRouter()
  const searchParams = useSearchParams()
  const { accessToken } = useAuth()
  const pollingInterval = useRef<NodeJS.Timeout | null>(null)
  
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [projects, setProjects] = useState<any[]>([])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [timerTick, setTimerTick] = useState(0)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    building_type: 'residential',
    project_id: searchParams.get('project') || ''
  })

  useEffect(() => {
    fetchProjects()
  }, [accessToken])

  useEffect(() => {
    // Clean up polling interval on unmount
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current)
      }
    }
  }, [])

  // Timer to update elapsed time display
  useEffect(() => {
    if (uploadedFiles.length > 0 && !allFilesProcessed) {
      const timer = setInterval(() => {
        setTimerTick(prev => prev + 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [uploadedFiles.length])

  // Timer to update elapsed time display
  useEffect(() => {
    const hasProcessingFiles = uploadedFiles.some(f => f.status === 'uploading' || f.status === 'parsing')
    if (hasProcessingFiles) {
      const timer = setInterval(() => {
        setTimerTick(prev => prev + 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [uploadedFiles])

  const retryFileProcessing = async (fileId: string) => {
    if (!accessToken) return

    try {
      await apiClient.post(`/files/${fileId}/retry`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      
      // Update file state to show it's being retried
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, status: 'parsing', parsingStage: 'Queued for processing...', startTime: Date.now() }
          : f
      ))
      
      // Restart polling if not already running
      if (!pollingInterval.current && submissionId) {
        checkFileParsingStatus()
        pollingInterval.current = setInterval(checkFileParsingStatus, 2000)
      }
    } catch (error: any) {
      console.error('Failed to retry file processing:', error)
    }
  }

  const checkFileParsingStatus = async () => {
    if (!submissionId) {
      console.log('[Progress] No submissionId, skipping status check')
      return
    }

    try {
      console.log('[Progress] Polling for submission:', submissionId)
      const response: any = await apiClient.get(`/submissions/${submissionId}/processing-status`)
      const data = response.data || response
      
      console.log('[Progress] Server response:', { 
        totalFiles: data.files?.length,
        statuses: data.files?.map((f: any) => ({ name: f.filename, status: f.processing_status }))
      })
      
      if (!data.files || data.files.length === 0) {
        console.log('[Progress] No files in response')
        return
      }
      
      // Rebuild file list from server response with proper timestamp handling
      let anyUpdated = false
      const updatedFiles = data.files.map((serverFile: any) => {
        const existingFile = uploadedFiles.find(uf => uf.id === serverFile.file_id) || {
          id: serverFile.file_id,
          name: serverFile.filename,
          status: 'parsing' as const
        }
        
        const status = serverFile.processing_status
        const oldStatus = existingFile.status
        
        console.log(`[Progress] File ${serverFile.filename}: ${status}`)
        
        // Use processing_started_at from server if available
        let startTime = existingFile.startTime
        if (!startTime && serverFile.processing_started_at) {
          startTime = new Date(serverFile.processing_started_at).getTime()
          console.log('[Progress] Set startTime from server:', startTime)
        } else if (!startTime) {
          startTime = Date.now()
        }
        
        if (status === 'completed' || status === 'partial') {
          if (oldStatus !== 'completed') {
            anyUpdated = true
            console.log('[Progress] ✓ File completed:', serverFile.filename)
          }
          return { 
            ...existingFile, 
            status: 'completed' as const, 
            metadata: serverFile, 
            parsingStage: 'Completed',
            startTime
          }
        } else if (status === 'failed') {
          if (oldStatus !== 'failed') {
            anyUpdated = true
            console.log('[Progress] ✗ File failed:', serverFile.filename)
          }
          return { 
            ...existingFile, 
            status: 'failed' as const, 
            error: serverFile.error, 
            parsingStage: 'Failed',
            startTime
          }
        } else if (status === 'processing') {
          // Calculate elapsed time from processing start (not creation!)
          const elapsed = (Date.now() - startTime) / 1000
          console.log('[Progress] File processing, elapsed:', elapsed.toFixed(1), 's')
          
          // Detect stuck files (> 5 minutes = 300 seconds)
          if (elapsed > 300) {
            if (oldStatus !== 'stuck') {
              anyUpdated = true
              console.warn('[Progress] ⚠ File appears stuck after', elapsed.toFixed(0), 's')
            }
            return {
              ...existingFile,
              status: 'stuck' as const,
              parsingStage: 'Processing appears stuck (task may have been interrupted)',
              startTime
            }
          }
          
          // Update stage based on elapsed time
          let stage = 'Processing file...'
          if (elapsed < 5) {
            stage = 'Starting translation...'
          } else if (elapsed < 40) {
            stage = 'Translating CAD file to SVF2...'
          } else {
            stage = 'Extracting metadata and properties...'
          }
          
          if (existingFile.parsingStage !== stage) {
            anyUpdated = true
          }
          
          return { 
            ...existingFile, 
            status: 'parsing' as const, 
            parsingStage: stage,
            startTime
          }
        } else {
          // Pending or unknown status
          if (oldStatus !== 'parsing' || existingFile.parsingStage !== 'Queued for processing...') {
            anyUpdated = true
          }
          return { 
            ...existingFile, 
            status: 'parsing' as const, 
            parsingStage: 'Queued for processing...',
            startTime
          }
        }
      })
      
      if (anyUpdated) {
        console.log('[Progress] Updating state with new file statuses')
        setUploadedFiles(updatedFiles)
      }

      // Check if all files are done processing
      const allDone = updatedFiles.every(f => f.status === 'completed' || f.status === 'failed')
      if (allDone && pollingInterval.current) {
        console.log('[Progress] All files done, stopping polling')
        clearInterval(pollingInterval.current)
        pollingInterval.current = null
        
        const failedCount = updatedFiles.filter(f => f.status === 'failed').length
        const successCount = updatedFiles.filter(f => f.status === 'completed').length
        console.log(`[Progress] Complete: ${successCount} success, ${failedCount} failed`)
        
        // Auto-redirect will be handled by useEffect
      }
    } catch (error) {
      console.error('[Progress] Failed to check file status:', error)
      // Continue polling on error - don't auto-complete
    }
  }

  const fetchProjects = async () => {
    if (!accessToken) return
    try {
      const response: any = await apiClient.get('/projects')
      setProjects(response.data || response || [])
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setSelectedFiles(prev => [...prev, ...files])
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!accessToken) {
      alert('You must be logged in to create a submission')
      return
    }

    try {
      setLoading(true)
      
      const payload: any = {
        name: formData.name,
        description: formData.description,
        building_type: formData.building_type
      }
      
      if (formData.project_id) {
        payload.project_id = formData.project_id
      }

      const response: any = await apiClient.post('/submissions', payload)
      const submission = response.data || response
      setSubmissionId(submission.id)

      // Upload files if any
      if (selectedFiles.length > 0) {
        setUploading(true)
        const uploaded: UploadedFile[] = []
        
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i]
          const startTime = Date.now()
          
          // Add file to uploaded list with uploading status
          const fileEntry: UploadedFile = {
            id: `temp-${i}`,
            name: file.name,
            status: 'uploading',
            uploadProgress: 0,
            startTime
          }
          uploaded.push(fileEntry)
          setUploadedFiles([...uploaded])
          
          const formData = new FormData()
          formData.append('file', file)
          formData.append('submission_id', submission.id)
          
          try {
            // Simulate upload progress (actual progress tracking would need axios)
            const progressInterval = setInterval(() => {
              setUploadedFiles(prev => prev.map(f => 
                f.name === file.name && f.status === 'uploading'
                  ? { ...f, uploadProgress: Math.min((f.uploadProgress || 0) + 10, 90) }
                  : f
              ))
            }, 200)
            
            const fileResponse: any = await apiClient.post('/files/upload', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            })
            
            clearInterval(progressInterval)
            
            const uploadedFile = fileResponse.data || fileResponse
            fileEntry.id = uploadedFile.id
            fileEntry.status = 'parsing'
            fileEntry.uploadProgress = 100
            fileEntry.parsingStage = 'Queued for processing...'
            uploaded[i] = fileEntry
            setUploadedFiles([...uploaded])
          } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error)
            fileEntry.status = 'failed'
            fileEntry.uploadProgress = 0
            uploaded[i] = fileEntry
            setUploadedFiles([...uploaded])
          }
        }
        
        setUploading(false)
        
        // Start polling for file parsing status immediately
        // Use setTimeout to ensure state has updated
        setTimeout(() => {
          checkFileParsingStatus()
          pollingInterval.current = setInterval(checkFileParsingStatus, 2000)
        }, 100)
      } else {
        // No files, navigate immediately
        router.push(`/submissions/${submission.id}`)
      }
    } catch (error: any) {
      console.error('Failed to create submission:', error)
      alert(error.response?.data?.detail || error.message || 'Failed to create submission')
      setLoading(false)
    }
  }

  const handleContinue = () => {
    if (submissionId) {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current)
      }
      router.push(`/submissions/${submissionId}`)
    }
  }

  const allFilesProcessed = uploadedFiles.length > 0 && 
    uploadedFiles.every(f => f.status === 'completed' || f.status === 'failed')

  // Auto-redirect when all files are processed
  useEffect(() => {
    if (allFilesProcessed && submissionId) {
      // Wait 1.5 seconds to show success state, then redirect
      const redirectTimer = setTimeout(() => {
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current)
        }
        router.push(`/submissions/${submissionId}`)
      }, 1500)
      
      return () => clearTimeout(redirectTimer)
    }
  }, [allFilesProcessed, submissionId, router])

  // Fallback: Show continue button after 2 minutes of waiting
  const [showContinueButton, setShowContinueButton] = useState(false)
  useEffect(() => {
    if (uploadedFiles.length > 0 && !allFilesProcessed) {
      const timer = setTimeout(() => {
        setShowContinueButton(true)
      }, 120000) // 2 minutes
      return () => clearTimeout(timer)
    }
  }, [uploadedFiles.length, allFilesProcessed])

  return (
    <>
      <DashboardNav />
      <div className="flex-1 p-8 pt-6 container max-w-2xl">
        <PageHeader
          title="New Submission"
          description="Upload architectural plans for compliance analysis"
          className="mb-8"
        />

        {/* Form Section */}
          <Card>
            <CardHeader>
              <CardTitle>Submission Details</CardTitle>
              <CardDescription>
                Provide information about your architectural submission
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Submission Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="e.g., Office Building Phase 2"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="Optional description..."
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="building_type">Building Type</Label>
                      <Select
                        value={formData.building_type}
                        onValueChange={(value) => setFormData({...formData, building_type: value})}
                      >
                        <SelectTrigger id="building_type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="residential">Residential</SelectItem>
                          <SelectItem value="commercial">Commercial</SelectItem>
                          <SelectItem value="industrial">Industrial</SelectItem>
                          <SelectItem value="mixed_use">Mixed Use</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="project">Project (Optional)</Label>
                      <Select
                        value={formData.project_id || undefined}
                        onValueChange={(value) => setFormData({...formData, project_id: value})}
                      >
                        <SelectTrigger id="project">
                          <SelectValue placeholder="No project selected" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Files</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('file-input')?.click()}
                        className="w-full"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Select Files
                      </Button>
                      <input
                        id="file-input"
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        accept=".dwg,.dxf,.ifc,.pdf"
                      />
                    </div>
                    
                    {selectedFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-2 rounded-lg border p-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1 text-sm">{file.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={loading || uploading || !formData.name}
                    className="flex-1"
                  >
                    {loading || uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {uploading ? 'Uploading files...' : 'Creating...'}
                      </>
                    ) : (
                      'Create Submission'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/submissions')}
                    disabled={loading || uploading}
                    size="lg"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* File Processing Status */}
          {uploadedFiles.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {allFilesProcessed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  )}
                  File Processing
                </CardTitle>
                <CardDescription>
                  {allFilesProcessed 
                    ? 'All files have been processed. You can now continue.' 
                    : 'Please wait while your files are being processed...'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {uploadedFiles.map((file, index) => {
                    const elapsedSeconds = file.startTime ? Math.floor((Date.now() - file.startTime) / 1000) : 0
                    const elapsedDisplay = elapsedSeconds > 0 ? `${elapsedSeconds}s` : '0s'
                    
                    return (
                      <div key={index} className="rounded-lg border p-4 space-y-3">
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
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
                            
                            {file.status === 'parsing' && (
                              <div className="space-y-2">
                                <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full animate-indeterminate" />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {file.parsingStage || 'Processing file...'}
                                </p>
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
                                  className="w-full border-amber-500 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"
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

                <div className="mt-6 flex gap-2">
                  <Button
                    onClick={handleContinue}
                    disabled={!allFilesProcessed && !showContinueButton}
                    className="flex-1"
                    variant={showContinueButton && !allFilesProcessed ? "outline" : "default"}
                  >
                    {allFilesProcessed ? (
                      'Continue to Submission'
                    ) : showContinueButton ? (
                      <>
                        <AlertCircle className="mr-2 h-4 w-4" />
                        Continue Anyway
                      </>
                    ) : (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing files...
                      </>
                    )}
                  </Button>
                  {allFilesProcessed && (
                    <Button
                      variant="outline"
                      onClick={() => router.push('/submissions')}
                    >
                      Back to List
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
      </div>
    </>
  )
}

export default function NewSubmissionPage() {
  return (
    <Suspense fallback={null}>
      <NewSubmissionPageInner />
    </Suspense>
  )
}
