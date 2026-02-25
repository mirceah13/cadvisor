'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard-nav'
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
  Loader2,
  Image,
  Database,
  Clock,
  FileType,
  CheckCircle2,
  TrendingUp
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
  images_count?: number
  chunks_with_embeddings?: number
  images_with_embeddings?: number
  text_length?: number
  processing_time?: number
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
      <>
        <DashboardNav />
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
      </>
    )
  }

  if (error || !source) {
    return (
      <>
        <DashboardNav />
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
      </>
    )
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
              onClick={() => router.push('/knowledge-base')}
              className="mb-4 text-white hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Knowledge Base
            </Button>
            
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
                  <FileText className="h-8 w-8" />
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl font-bold tracking-tight">{source.title}</h1>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-white/10 border-white/20 text-white">
                      <Tag className="h-3 w-3 mr-1" />
                      {categoryLabels[source.category] || source.category}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`${statusColors[source.status] || 'bg-gray-500'} text-white border-0`}
                    >
                      {source.status === 'indexed' ? 'Ready' : source.status === 'ready' ? 'Ready' : source.status.charAt(0).toUpperCase() + source.status.slice(1)}
                    </Badge>
                    <Badge variant="outline" className="bg-white/10 border-white/20 text-white">
                      <Calendar className="h-3 w-3 mr-1" />
                      {new Date(source.created_at).toLocaleDateString()}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {source.status === 'processing' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    Stop Processing
                  </Button>
                )}
                {(source.status !== 'processing') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReIngest}
                    disabled={source.status === 'processing'}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Re-process
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deleting}
                      className="bg-red-500/10 border-red-300/20 text-white hover:bg-red-500/20"
                    >
                      {deleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
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
                      <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>

        <div className="container space-y-6 p-6">
          <Card>
            <CardContent className="pt-6">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold capitalize">{source.status}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {source.status === 'indexed' && '✅ Ready for queries'}
                    {source.status === 'processing' && '⏳ In progress'}
                    {source.status === 'failed' && '❌ Processing failed'}
                    {source.status === 'uploaded' && '📤 Awaiting processing'}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Text Chunks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {source.chunks_count?.toLocaleString() || 0}
                  </p>
                  {source.chunks_with_embeddings !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {source.chunks_with_embeddings.toLocaleString()} with embeddings ({source.chunks_count ? Math.round((source.chunks_with_embeddings / source.chunks_count) * 100) : 0}%)
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Images
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {source.images_count?.toLocaleString() || 0}
                  </p>
                  {source.images_with_embeddings !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {source.images_with_embeddings.toLocaleString()} with embeddings ({source.images_count ? Math.round((source.images_with_embeddings / source.images_count) * 100) : 0}%)
                    </p>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileType className="h-4 w-4" />
                    Source Type
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold capitalize">{source.source_type}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {categoryLabels[source.category] || source.category}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Additional Metrics */}
            {(source.text_length || source.processing_time) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {source.text_length && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Total Text Length
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {(source.text_length / 1000).toFixed(1)}K
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {source.text_length.toLocaleString()} characters
                      </p>
                    </CardContent>
                  </Card>
                )}

                {source.processing_time && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Processing Time
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {Math.floor(source.processing_time / 60)}m {Math.round(source.processing_time % 60)}s
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {source.processing_time.toFixed(2)} seconds total
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Visual Analytics */}
            {source.status === 'indexed' && source.chunks_count && source.chunks_count > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Content Analytics</CardTitle>
                  <CardDescription>Embedding generation success rates and content breakdown</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  {/* Success Rate Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Text Chunks Progress */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-emerald-500/10">
                            <FileText className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold">Text Chunks</h4>
                            <p className="text-sm text-muted-foreground">
                              {source.chunks_with_embeddings?.toLocaleString()} / {source.chunks_count?.toLocaleString()} embedded
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-emerald-600">
                            {source.chunks_count ? Math.round((source.chunks_with_embeddings || 0) / source.chunks_count * 100) : 0}%
                          </p>
                          <p className="text-xs text-muted-foreground">success</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="relative h-4 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-green-600 rounded-full transition-all duration-1000 ease-out"
                            style={{ 
                              width: `${source.chunks_count ? ((source.chunks_with_embeddings || 0) / source.chunks_count * 100) : 0}%` 
                            }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{source.chunks_with_embeddings?.toLocaleString()} with embeddings</span>
                          <span>{((source.chunks_count || 0) - (source.chunks_with_embeddings || 0)).toLocaleString()} failed</span>
                        </div>
                      </div>
                    </div>

                    {/* Images Progress */}
                    {source.images_count && source.images_count > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                              <Image className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <h4 className="font-semibold">Images</h4>
                              <p className="text-sm text-muted-foreground">
                                {source.images_with_embeddings?.toLocaleString()} / {source.images_count?.toLocaleString()} embedded
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-blue-600">
                              {source.images_count ? Math.round((source.images_with_embeddings || 0) / source.images_count * 100) : 0}%
                            </p>
                            <p className="text-xs text-muted-foreground">success</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="relative h-4 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div 
                              className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-1000 ease-out"
                              style={{ 
                                width: `${source.images_count ? ((source.images_with_embeddings || 0) / source.images_count * 100) : 0}%` 
                              }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{source.images_with_embeddings?.toLocaleString()} with embeddings</span>
                            <span>{((source.images_count || 0) - (source.images_with_embeddings || 0)).toLocaleString()} failed</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Comparison Stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                    <div className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 p-4">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full -mr-10 -mt-10" />
                      <div className="relative">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Text Chunks</p>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                          {source.chunks_count?.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {source.chunks_with_embeddings?.toLocaleString()} embedded
                        </p>
                      </div>
                    </div>

                    <div className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-4">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -mr-10 -mt-10" />
                      <div className="relative">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Images</p>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                          {source.images_count?.toLocaleString() || 0}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {source.images_with_embeddings?.toLocaleString() || 0} embedded
                        </p>
                      </div>
                    </div>

                    <div className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 p-4">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full -mr-10 -mt-10" />
                      <div className="relative">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Total Items</p>
                        <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                          {((source.chunks_count || 0) + (source.images_count || 0)).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          chunks + images
                        </p>
                      </div>
                    </div>

                    <div className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 p-4">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -mr-10 -mt-10" />
                      <div className="relative">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Embeddings</p>
                        <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                          {((source.chunks_with_embeddings || 0) + (source.images_with_embeddings || 0)).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          generated successfully
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Overall Success Indicator */}
                  <div className="relative overflow-hidden rounded-lg border bg-gradient-to-r from-emerald-500/5 via-blue-500/5 to-purple-500/5 p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Overall Processing Success</p>
                        <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
                          {Math.round((((source.chunks_with_embeddings || 0) + (source.images_with_embeddings || 0)) / ((source.chunks_count || 0) + (source.images_count || 0))) * 100)}%
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle2 className="h-8 w-8" />
                        <span className="text-sm font-medium">Ready for Search</span>
                      </div>
                    </div>
                    <div className="mt-4 h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 rounded-full transition-all duration-1000"
                        style={{ 
                          width: `${Math.round((((source.chunks_with_embeddings || 0) + (source.images_with_embeddings || 0)) / ((source.chunks_count || 0) + (source.images_count || 0))) * 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Details */}
            <Card>
              <CardHeader>
                <CardTitle>Document Details</CardTitle>
                <CardDescription>Metadata and additional information</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
                      <Tag className="h-4 w-4" />
                      Category
                    </dt>
                    <dd className="text-sm font-medium">
                      {categoryLabels[source.category] || source.category}
                    </dd>
                  </div>
                  
                  {source.file_id && (
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4" />
                        File ID
                      </dt>
                      <dd className="text-xs font-mono bg-muted p-2 rounded">{source.file_id}</dd>
                    </div>
                  )}
                  
                  {source.url && (
                    <div className="md:col-span-2">
                      <dt className="text-sm font-medium text-muted-foreground mb-1">URL</dt>
                      <dd className="text-sm">
                        <a 
                          href={source.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-all"
                        >
                          {source.url}
                        </a>
                      </dd>
                    </div>
                  )}
                  
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4" />
                      Created
                    </dt>
                    <dd className="text-sm">
                      {new Date(source.created_at).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </dd>
                  </div>

                  {source.text_length && (
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4" />
                        Average Chunk Size
                      </dt>
                      <dd className="text-sm font-medium">
                        {source.chunks_count ? Math.round(source.text_length / source.chunks_count) : 0} characters
                      </dd>
                    </div>
                  )}

                  {source.chunks_count && source.images_count && (
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Text to Image Ratio
                      </dt>
                      <dd className="text-sm font-medium">
                        {(source.chunks_count / source.images_count).toFixed(2)}:1
                        <span className="text-xs text-muted-foreground ml-2">
                          ({source.chunks_count} chunks / {source.images_count} images)
                        </span>
                      </dd>
                    </div>
                  )}

                  {source.processing_time && source.chunks_count && (
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4" />
                        Processing Speed
                      </dt>
                      <dd className="text-sm font-medium">
                        {(source.chunks_count / source.processing_time * 60).toFixed(1)} chunks/min
                        <span className="text-xs text-muted-foreground ml-2">
                          ({(source.processing_time / source.chunks_count).toFixed(2)}s per chunk)
                        </span>
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

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
      </div>
    </>
  )
}
