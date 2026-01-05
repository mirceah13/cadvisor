'use client'

import { useState, useEffect } from 'react'
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
import { ArrowLeft, Loader2, Upload, X, FileText } from 'lucide-react'
import Link from 'next/link'
import { LoadingLink } from '@/components/loading-link'

export default function NewSubmissionPage() {
  const router = useLoadingRouter()
  const searchParams = useSearchParams()
  const { accessToken } = useAuth()
  
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [projects, setProjects] = useState<any[]>([])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    building_type: 'residential',
    project_id: searchParams.get('project') || ''
  })

  useEffect(() => {
    fetchProjects()
  }, [accessToken])

  const fetchProjects = async () => {
    if (!accessToken) return

    try {
      // Don't pass Authorization header - the apiClient interceptor handles it
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

  const uploadFiles = async (submissionId: string) => {
    if (selectedFiles.length === 0) return

    setUploading(true)
    try {
      const uploadPromises = selectedFiles.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        if (submissionId) {
          formData.append('submission_id', submissionId)
        }

        try {
          // Don't pass Authorization header - the apiClient interceptor handles it
          await apiClient.post('/files/upload', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          })
        } catch (error: any) {
          console.error(`Failed to upload ${file.name}:`, error)
          console.error('Error details:', error.response?.data)
          throw error
        }
      })

      await Promise.all(uploadPromises)
    } catch (error) {
      console.error('Upload failed:', error)
      throw error
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!accessToken) {
      console.error('No access token available')
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

      console.log('Creating submission with payload:', payload)
      console.log('Using access token:', accessToken ? 'Present' : 'Missing')
      console.log('API URL:', process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
      
      // Don't pass Authorization header - the apiClient interceptor handles it
      const response: any = await apiClient.post('/submissions', payload)

      console.log('Response received:', response)
      const submission = response.data || response
      console.log('Submission created:', submission)

      // Upload files if any were selected
      if (selectedFiles.length > 0) {
        console.log('Uploading files...')
        try {
          await uploadFiles(submission.id)
          console.log('Files uploaded successfully')
        } catch (uploadError) {
          console.error('File upload failed, but submission was created:', uploadError)
          alert('Submission created but some files failed to upload. You can upload them from the submission detail page.')
        }
      }

      console.log('Redirecting to:', `/submissions/${submission.id}`)
      router.push(`/submissions/${submission.id}`)
    } catch (error: any) {
      console.error('Failed to create submission:', error)
      console.error('Error response:', error.response?.data)
      console.error('Error status:', error.response?.status)
      console.error('Error message:', error.message)
      alert(error.response?.data?.detail || error.message || 'Failed to create submission')
    } finally {
      setLoading(false)
    }
  }

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
              className="mb-4 text-white hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Submissions
            </Button>
            
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
                <Upload className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Create New Submission</h1>
                <p className="text-white/80 mt-1">
                  Upload CAD files for automated compliance analysis
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="container max-w-3xl p-8">
          <Card className="border-2">
            <CardHeader className="bg-gradient-to-br from-primary/5 to-primary/10">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Submission Details
              </CardTitle>
              <CardDescription>
                Provide information about your submission for better organization and analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Submission Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Office Building - Floor Plans"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional description of this submission..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="building_type">Building Type</Label>
                <Select
                  value={formData.building_type}
                  onValueChange={(value) => setFormData({ ...formData, building_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                    <SelectItem value="mixed_use">Mixed Use</SelectItem>
                    <SelectItem value="institutional">Institutional</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="project">Project (Optional)</Label>
                <Select
                  value={formData.project_id || undefined}
                  onValueChange={(value) => setFormData({ ...formData, project_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Link this submission to a project for better organization
                </p>
              </div>

              <div className="space-y-2">
                <Label>CAD Files (Optional)</Label>
                <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-all">
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    accept=".dwg,.dxf,.ifc,.pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center gap-3"
                  >
                    <div className="rounded-full bg-primary/10 p-4">
                      <Upload className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Click to upload or drag and drop</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        DWG, DXF, IFC, PDF up to 50MB each
                      </p>
                    </div>
                  </label>
                </div>

                {selectedFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Selected files</p>
                      <Badge variant="secondary">{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}</Badge>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="rounded-lg bg-primary/10 p-2">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  You can also upload files after creating the submission
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button 
                  type="submit" 
                  disabled={loading || uploading}
                  className="bg-primary hover:bg-primary/90 flex-1"
                  size="lg"
                >
                  {(loading || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {uploading ? 'Uploading Files...' : loading ? 'Creating...' : 'Create Submission'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => router.back()}
                  disabled={loading || uploading}
                  size="lg"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

