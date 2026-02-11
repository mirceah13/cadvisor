'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLoadingRouter } from '@/hooks/use-loading-router'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api-client'
import { DashboardNav } from '@/components/dashboard-nav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Loader2, Upload, X, FileText, CheckCircle2, AlertCircle } from 'lucide-react'

interface UploadedFile {
  id: string
  name: string
  status: 'uploading' | 'parsing' | 'completed' | 'failed'
  metadata?: any
}

export default function NewSubmissionPage() {
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

  const checkFileParsingStatus = async () => {
    if (!submissionId) {
      console.log('No submissionId, skipping status check')
      return
    }

    try {
      console.log('Checking file parsing status for submission:', submissionId)
      const response: any = await apiClient.get(`/submissions/${submissionId}/processing-status`)
      const data = response.data || response
      
      console.log('Processing status response:', data)
      
      if (data.files && data.files.length > 0) {
        // Always update all files from server response
        const updatedFiles = data.files.map((serverFile: any) => {
          const existingFile = uploadedFiles.find(uf => uf.id === serverFile.file_id) || {
            id: serverFile.file_id,
            name: serverFile.filename,
            status: 'parsing' as const
          }
          const status = serverFile.processing_status
          console.log(`File ${serverFile.filename} status:`, status)
          
          if (status === 'completed' || status === 'partial') {
            return { ...existingFile, status: 'completed' as const, metadata: serverFile }
          } else if (status === 'failed') {
            return { ...existingFile, status: 'failed' as const, error: serverFile.error }
          } else if (status === 'processing') {
            return { ...existingFile, status: 'parsing' as const }
          } else {
            return { ...existingFile, status: 'parsing' as const }
          }
        })
        
        setUploadedFiles(updatedFiles)

        // Check if all files are done processing
        const allDone = updatedFiles.every(f => f.status === 'completed' || f.status === 'failed')
        if (allDone && pollingInterval.current) {
          clearInterval(pollingInterval.current)
          pollingInterval.current = null
          console.log('All files processed, will redirect shortly')
        }
      }
    } catch (error) {
      console.error('Failed to check file status:', error)
      // On error, continue anyway after 10s
      if (pollingInterval.current && uploadedFiles.length > 0) {
        setTimeout(() => {
          if (pollingInterval.current) {
            clearInterval(pollingInterval.current)
            pollingInterval.current = null
            setUploadedFiles(prev => prev.map(f => ({ ...f, status: 'completed' as const })))
          }
        }, 10000)
      }
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
        
        for (const file of selectedFiles) {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('submission_id', submission.id)
          
          try {
            const fileResponse: any = await apiClient.post('/files/upload', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            })
            const uploadedFile = fileResponse.data || fileResponse
            uploaded.push({
              id: uploadedFile.id,
              name: file.name,
              status: 'parsing',
              uploadTime: Date.now()
            } as any)
          } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error)
            uploaded.push({
              id: Math.random().toString(),
              name: file.name,
              status: 'failed'
            })
          }
        }
        
        setUploadedFiles(uploaded)
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
      <div className="flex-1 space-y-0">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/95 to-primary/80 text-white">
          <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
          <div className="container relative py-8 px-6">
            <Button 
              variant="ghost" 
              onClick={() => router.push('/submissions')}
              className="mb-4 text-white hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Submissions
            </Button>
            
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                <Upload className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">New Submission</h1>
                <p className="text-white/80">Upload architectural plans for comprehensive analysis</p>
              </div>
            </div>
          </div>
        </div>

        {/* Form Section */}
        <div className="container py-8 px-6">
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
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-3 rounded-lg border p-3">
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
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
      </div>
    </>
  )
}
