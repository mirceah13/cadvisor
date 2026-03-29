'use client'

import { useState } from 'react'
import { useLoadingRouter } from '@/hooks/use-loading-router'
import { DashboardNav } from '@/components/dashboard-nav'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api-client'
import { ArrowLeft, Upload, FileText, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { LoadingLink } from '@/components/loading-link'
import { PageHeader } from '@/components/page-header'

export default function UploadKnowledgePage() {
  const router = useLoadingRouter()
  const { accessToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'building_code',
    sourceType: 'document',
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      if (!formData.title) {
        // Auto-fill title from filename
        setFormData({ ...formData, title: file.name.replace(/\.[^/.]+$/, '') })
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setUploadProgress(0)

    try {
      let fileId: string | null = null

      // Step 1: Upload file if document type
      if (formData.sourceType === 'document' && selectedFile) {
        console.log('Step 1: Uploading file via API...')
        
        // Create form data for file upload
        const uploadFormData = new FormData()
        uploadFormData.append('file', selectedFile)
        
        // Upload directly through API
        const uploadResponse: any = await apiClient.post(
          '/files/upload',
          uploadFormData,
          {
            headers: { 
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'multipart/form-data'
            },
          }
        )

        fileId = uploadResponse.data?.id || uploadResponse.id
        console.log('File uploaded successfully, file ID:', fileId)
        setUploadProgress(70)
      }

      // Step 2: Create knowledge source
      console.log('Step 2: Creating knowledge source...')
      const sourceData: any = {
        title: formData.title,
        source_type: formData.sourceType,
        category: formData.category,
        metadata: {
          description: formData.description,
        },
      }

      if (formData.sourceType === 'document' && fileId) {
        sourceData.file_id = fileId
      }

      const response: any = await apiClient.post('/kb/sources', sourceData, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      setUploadProgress(100)

      const source = response.data || response
      console.log('Knowledge source created:', source.id)

      // Navigate to knowledge base list
      setTimeout(() => {
        router.push('/knowledge-base')
      }, 500)
    } catch (err: any) {
      console.error('Upload failed:', err)
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        code: err.code,
      })

      let errorMessage = 'Failed to upload document. Please try again.'

      if (err.response?.data?.detail) {
        errorMessage =
          typeof err.response.data.detail === 'string'
            ? err.response.data.detail
            : 'Server error. Please try again.'
      } else if (!err.response) {
        errorMessage = 'Network error. Please check your connection.'
      }

      setError(errorMessage)
      setUploadProgress(0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DashboardNav />
      <div className="flex-1 space-y-6 p-8 pt-6 container max-w-2xl">
        <PageHeader
          title="Upload Knowledge Document"
          description="Add compliance documents, building codes, and standards to enhance AI analysis"
        />

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {uploadProgress > 0 && uploadProgress < 100 && (
          <Card className="p-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Uploading...</span>
                <span className="text-muted-foreground">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Document Title *</Label>
              <Input
                id="title"
                placeholder="e.g., International Building Code 2021"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the document..."
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="building_code">Building Code</SelectItem>
                  <SelectItem value="fire_safety">Fire Safety</SelectItem>
                  <SelectItem value="accessibility">Accessibility Standards</SelectItem>
                  <SelectItem value="structural">Structural Engineering</SelectItem>
                  <SelectItem value="mechanical">Mechanical Systems</SelectItem>
                  <SelectItem value="electrical">Electrical Standards</SelectItem>
                  <SelectItem value="plumbing">Plumbing Code</SelectItem>
                  <SelectItem value="environmental">Environmental Regulations</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Category helps the AI apply the right context during analysis
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Upload Document *</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-foreground/30 transition-colors">
                <input
                  type="file"
                  id="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileSelect}
                  required
                />
                <label
                  htmlFor="file"
                  className="cursor-pointer flex flex-col items-center justify-center"
                >
                  {selectedFile ? (
                    <>
                      <FileText className="h-12 w-12 text-primary mb-4" />
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <Button type="button" variant="ghost" size="sm" className="mt-4">
                        Change File
                      </Button>
                    </>
                  ) : (
                    <>
                      <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-sm font-medium mb-2">Click to upload or drag and drop</p>
                      <p className="text-xs text-muted-foreground">
                        PDF, DOC, DOCX, or TXT (max 50MB)
                      </p>
                    </>
                  )}
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Document will be processed and embedded for AI-powered compliance checking
              </p>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading || !selectedFile}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Document
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" asChild>
                <LoadingLink href="/knowledge-base">Cancel</LoadingLink>
              </Button>
            </div>
          </form>
        </Card>

        <div className="rounded-md border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">How it works</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>Documents are parsed to extract text content</li>
            <li>Text is chunked into semantically meaningful segments</li>
            <li>Each chunk is embedded using AI models</li>
            <li>During project analysis, relevant sections are retrieved to validate compliance</li>
          </ul>
        </div>
      </div>
    </>
  )
}

