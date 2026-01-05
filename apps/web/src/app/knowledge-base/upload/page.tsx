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
      <div className="flex-1 space-y-8 p-8 pt-6 container max-w-3xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <LoadingLink href="/knowledge-base">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Knowledge Base
            </LoadingLink>
          </Button>
        </div>

        <div>
          <h2 className="text-3xl font-bold tracking-tight">Upload Knowledge Document</h2>
          <p className="text-muted-foreground">
            Add compliance documents, building codes, and standards to enhance AI analysis
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
              </div>
            </div>
          </div>
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
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-600 transition-colors">
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

        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                How it works
              </h3>
              <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Documents are parsed to extract text content</li>
                  <li>Text is chunked into semantically meaningful segments</li>
                  <li>Each chunk is embedded using AI models</li>
                  <li>
                    During project analysis, relevant sections are retrieved to validate compliance
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

