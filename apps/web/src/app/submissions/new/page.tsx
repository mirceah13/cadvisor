'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

export default function NewSubmissionPage() {
  const router = useRouter()
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
      <div className="flex-1 p-8 pt-6 container max-w-2xl">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/submissions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Submissions
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Create New Submission</CardTitle>
            <CardDescription>
              Create a new CAD submission for compliance analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
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
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Click to upload files</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Supported formats: DWG, DXF, IFC, PDF
                      </p>
                    </div>
                  </label>
                </div>

                {selectedFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium">Selected files ({selectedFiles.length}):</p>
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  You can also upload files after creating the submission
                </p>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={loading || uploading}>
                  {(loading || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {uploading ? 'Uploading Files...' : 'Create Submission'}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
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
