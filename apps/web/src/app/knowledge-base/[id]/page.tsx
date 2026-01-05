'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useLoadingRouter } from '@/hooks/use-loading-router'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  ArrowLeft, 
  FileText, 
  Calendar, 
  Tag, 
  AlertCircle,
  RefreshCw,
  Trash2,
  Loader2
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface KnowledgeSource {
  id: string
  title: string
  source_type: string
  category: string
  status: string
  file_id?: string
  url?: string
  chunks_count?: number
  created_at: string
  meta_data?: {
    progress?: {
      stage?: string
      total_chunks?: number
      processed_chunks?: number
      message?: string
    }
    chunks_count?: number
  }
}

const categoryLabels: Record<string, string> = {
  building_code: 'Building Code',
  fire_safety: 'Fire Safety',
  accessibility: 'Accessibility',
  energy_efficiency: 'Energy Efficiency',
  structural: 'Structural',
  mechanical: 'Mechanical',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  other: 'Other'
}

const statusColors: Record<string, string> = {
  uploaded: 'bg-blue-500',
  processing: 'bg-yellow-500',
  indexed: 'bg-green-500',
  ready: 'bg-green-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500'
}

export default function KnowledgeBaseDetailPage() {
  const params = useParams()
  const router = useLoadingRouter()
  const { accessToken } = useAuth()
  const [source, setSource] = useState<KnowledgeSource | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchSource(true) // Initial load with loading state
  }, [params.id, accessToken])

  // Silent polling for updates when processing
  useEffect(() => {
    if (source?.status === 'processing') {
      const interval = setInterval(() => {
        fetchSource(false) // Silent update, no loading state
      }, 3000) // Poll every 3 seconds

      return () => clearInterval(interval)
    }
  }, [source?.status, accessToken])

  const fetchSource = async (showLoading: boolean = true) => {
    if (!accessToken) return

    try {
      if (showLoading) setLoading(true)
      const response: any = await apiClient.get(`/kb/sources/${params.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      
      setSource(response.data || response)
    } catch (err: any) {
      console.error('Failed to fetch knowledge source:', err)
      if (showLoading) setError(err.response?.data?.detail || 'Failed to load knowledge source')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!accessToken || !source) return

    try {
      setDeleting(true)
      await apiClient.delete(`/kb/sources/${source.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      
      router.push('/knowledge-base')
    } catch (err: any) {
      console.error('Failed to delete source:', err)
      setError(err.response?.data?.detail || 'Failed to delete knowledge source')
      setDeleting(false)
    }
  }

  const handleReIngest = async () => {
    if (!accessToken || !source) return

    try {
      await apiClient.post(`/kb/sources/${source.id}/reingest`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      
      // Refresh the source data
      fetchSource()
    } catch (err: any) {
      console.error('Failed to re-ingest:', err)
      setError(err.response?.data?.detail || 'Failed to trigger re-ingestion')
    }
  }

  const handleCancel = async () => {
    if (!accessToken || !source) return
    if (!confirm('Are you sure you want to stop processing this document?')) return

    try {
      await apiClient.post(`/kb/sources/${source.id}/cancel`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      
      // Refresh the source data
      fetchSource()
    } catch (err: any) {
      console.error('Failed to cancel:', err)
      setError(err.response?.data?.detail || 'Failed to cancel processing')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Skeleton className="h-10 w-48 mb-4" />
          <Skeleton className="h-6 w-96" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !source) {
    return (
      <div className="container mx-auto p-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/knowledge-base')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Knowledge Base
        </Button>
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error || 'Knowledge source not found'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/knowledge-base')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Knowledge Base
        </Button>
        <h1 className="text-3xl font-bold">Knowledge Source Details</h1>
        <p className="text-muted-foreground mt-2">
          View and manage this knowledge base document
        </p>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl mb-2">{source.title}</CardTitle>
              <CardDescription className="flex flex-wrap gap-3 mt-3">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {categoryLabels[source.category] || source.category}
                </Badge>
                <Badge 
                  variant="outline" 
                  className={`${statusColors[source.status] || 'bg-gray-500'} text-white border-0`}
                >
                  {source.status === 'indexed' ? 'Ready' : source.status === 'ready' ? 'Ready' : source.status.charAt(0).toUpperCase() + source.status.slice(1)}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {source.source_type}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(source.created_at).toLocaleDateString()}
                </Badge>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {source.status === 'processing' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  Stop Processing
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleReIngest}
                disabled={source.status === 'processing'}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Re-process
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleting}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Knowledge Source</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this knowledge source? This will remove
                      the document and all associated chunks. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Processing Progress */}
            {source.status === 'processing' && source.meta_data?.progress && (
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      <span>Processing Document</span>
                    </div>
                    <Badge variant="outline" className="bg-white dark:bg-gray-900 font-mono text-lg px-3 py-1">
                      {source.meta_data.progress.total_chunks 
                        ? `${Math.round(((source.meta_data.progress.processed_chunks || 0) / source.meta_data.progress.total_chunks) * 100)}%`
                        : '0%'
                      }
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {/* Stage and Chunk Count */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium capitalize text-blue-900 dark:text-blue-100">
                        {source.meta_data.progress.stage === 'downloading' && '📥 Downloading'}
                        {source.meta_data.progress.stage === 'chunking' && '✂️ Chunking'}
                        {source.meta_data.progress.stage === 'embedding' && '🧠 Generating Embeddings'}
                        {source.meta_data.progress.stage === 'complete' && '✅ Complete'}
                        {!source.meta_data.progress.stage && 'Processing...'}
                      </span>
                      {source.meta_data.progress.total_chunks && (
                        <span className="text-muted-foreground font-mono">
                          {source.meta_data.progress.processed_chunks || 0} / {source.meta_data.progress.total_chunks} chunks
                        </span>
                      )}
                    </div>
                    
                    {/* Progress Bar */}
                    {source.meta_data.progress.total_chunks ? (
                      <div className="relative">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden shadow-inner">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-4 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                            style={{ 
                              width: `${Math.min(((source.meta_data.progress.processed_chunks || 0) / source.meta_data.progress.total_chunks) * 100, 100)}%` 
                            }}
                          >
                            {/* Animated shine effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div className="bg-blue-600 h-4 rounded-full animate-pulse w-1/3" />
                      </div>
                    )}
                    
                    {/* Status Message */}
                    <p className="text-sm text-muted-foreground italic">
                      {source.meta_data.progress.message || 'Processing document...'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold capitalize">{source.status}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Text Chunks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {source.chunks_count || 0}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Source Type
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold capitalize">{source.source_type}</p>
                </CardContent>
              </Card>
            </div>

            {/* Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Details</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Category</dt>
                  <dd className="mt-1 text-sm">
                    {categoryLabels[source.category] || source.category}
                  </dd>
                </div>
                
                {source.file_id && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">File ID</dt>
                    <dd className="mt-1 text-sm font-mono text-xs">{source.file_id}</dd>
                  </div>
                )}
                
                {source.url && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">URL</dt>
                    <dd className="mt-1 text-sm">
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {source.url}
                      </a>
                    </dd>
                  </div>
                )}
                
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Created</dt>
                  <dd className="mt-1 text-sm">
                    {new Date(source.created_at).toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Processing Status Info */}
            {source.status === 'processing' && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <div className="flex items-start gap-3">
                  <RefreshCw className="h-5 w-5 text-yellow-600 animate-spin mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Processing</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      This document is being processed. Text extraction and chunking are in progress.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {source.status === 'failed' && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-900">Processing Failed</h4>
                    <p className="text-sm text-red-700 mt-1">
                      There was an error processing this document. Click "Re-process" to try again.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
