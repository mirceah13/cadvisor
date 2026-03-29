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
import { PageHeader } from '@/components/page-header'
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
      }, 2000) // Poll every 2 seconds

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
        <div className="flex-1 space-y-6 p-8 pt-6 container max-w-4xl">
          <Button variant="ghost" size="sm" onClick={() => router.push('/knowledge-base')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Knowledge Base
          </Button>
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">{error || 'Knowledge source not found'}</p>
            <Button variant="outline" size="sm" onClick={() => fetchSource()}>Retry</Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <DashboardNav />
      <div className="flex-1 space-y-6 p-8 pt-6 container max-w-4xl">
        <PageHeader
          title={source.title}
          description={`${categoryLabels[source.category] || source.category} · ${source.status === 'indexed' || source.status === 'ready' ? 'Ready' : source.status.charAt(0).toUpperCase() + source.status.slice(1)}`}
          actions={
            <div className="flex gap-2">
              {source.status === 'processing' && (
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  Stop Processing
                </Button>
              )}
              {source.status !== 'processing' && (
                <Button variant="outline" size="sm" onClick={handleReIngest}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Re-process
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={deleting}>
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          }
        />

        <div className="space-y-6">
          {/* Processing Progress */}
          {source.status === 'processing' && (() => {
            const prog = source.meta_data?.progress
            const total = prog?.total_chunks ?? 0
            const done = prog?.processed_chunks ?? 0
            const pct = total > 0 ? Math.round((done / total) * 100) : null
            const stage = prog?.stage
            const isIndeterminate = !total || done === 0
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span>Processing Document</span>
                    </div>
                    <span className="font-mono text-sm text-muted-foreground">
                      {pct !== null ? `${pct}%` : '\u2026'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {stage === 'downloading' && 'Downloading'}
                      {stage === 'chunking' && 'Chunking text'}
                      {stage === 'embedding' && 'Generating Embeddings'}
                      {stage === 'complete' && 'Complete'}
                      {!stage && 'Starting up\u2026'}
                    </span>
                    {total > 0 && (
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {done} / {total} chunks
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    {isIndeterminate ? (
                      <div className="h-2 w-full relative overflow-hidden rounded-full">
                        <div className="absolute inset-0 bg-primary animate-indeterminate" />
                      </div>
                    ) : (
                      <div
                        className="bg-primary h-2 rounded-full transition-[width] duration-700 ease-out"
                        style={{ width: `${Math.min(pct!, 100)}%` }}
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {prog?.message || 'Preparing document\u2026'}
                  </p>
                </CardContent>
              </Card>
            )
          })()}

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold capitalize">{source.status}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {source.status === 'indexed' && 'Ready for queries'}
                  {source.status === 'processing' && 'In progress'}
                  {source.status === 'failed' && 'Processing failed'}
                  {source.status === 'uploaded' && 'Awaiting processing'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Text Chunks</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{source.chunks_count?.toLocaleString() || 0}</p>
                {source.chunks_with_embeddings !== undefined && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {source.chunks_with_embeddings.toLocaleString()} with embeddings ({source.chunks_count ? Math.round((source.chunks_with_embeddings / source.chunks_count) * 100) : 0}%)
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Images</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{source.images_count?.toLocaleString() || 0}</p>
                {source.images_with_embeddings !== undefined && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {source.images_with_embeddings.toLocaleString()} with embeddings ({source.images_count ? Math.round((source.images_with_embeddings / source.images_count) * 100) : 0}%)
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Source Type</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold capitalize">{source.source_type}</p>
                <p className="text-xs text-muted-foreground mt-1">{categoryLabels[source.category] || source.category}</p>
              </CardContent>
            </Card>
          </div>

          {/* Additional Metrics */}
          {(source.text_length || source.processing_time) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {source.text_length && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Text Length</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{(source.text_length / 1000).toFixed(1)}K</p>
                    <p className="text-xs text-muted-foreground mt-1">{source.text_length.toLocaleString()} characters</p>
                  </CardContent>
                </Card>
              )}
              {source.processing_time && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Processing Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{Math.floor(source.processing_time / 60)}m {Math.round(source.processing_time % 60)}s</p>
                    <p className="text-xs text-muted-foreground mt-1">{source.processing_time.toFixed(2)} seconds total</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Content Analytics */}
          {source.status === 'indexed' && source.chunks_count && source.chunks_count > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Content Analytics</CardTitle>
                <CardDescription>Embedding generation success rates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Text Chunks</span>
                    <span className="tabular-nums text-muted-foreground">
                      {source.chunks_with_embeddings?.toLocaleString()} / {source.chunks_count?.toLocaleString()} embedded
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-1000"
                      style={{ width: `${source.chunks_count ? ((source.chunks_with_embeddings || 0) / source.chunks_count * 100) : 0}%` }}
                    />
                  </div>
                </div>

                {source.images_count && source.images_count > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Images</span>
                      <span className="tabular-nums text-muted-foreground">
                        {source.images_with_embeddings?.toLocaleString()} / {source.images_count?.toLocaleString()} embedded
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-1000"
                        style={{ width: `${source.images_count ? ((source.images_with_embeddings || 0) / source.images_count * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Text Chunks</p>
                    <p className="text-xl font-semibold">{source.chunks_count?.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{source.chunks_with_embeddings?.toLocaleString()} embedded</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Images</p>
                    <p className="text-xl font-semibold">{source.images_count?.toLocaleString() || 0}</p>
                    <p className="text-xs text-muted-foreground">{source.images_with_embeddings?.toLocaleString() || 0} embedded</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Total Items</p>
                    <p className="text-xl font-semibold">{((source.chunks_count || 0) + (source.images_count || 0)).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">chunks + images</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Embeddings</p>
                    <p className="text-xl font-semibold">{((source.chunks_with_embeddings || 0) + (source.images_with_embeddings || 0)).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">generated</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Document Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Document Details</CardTitle>
              <CardDescription>Metadata and additional information</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground mb-1">Category</dt>
                  <dd className="font-medium">{categoryLabels[source.category] || source.category}</dd>
                </div>
                {source.file_id && (
                  <div>
                    <dt className="text-muted-foreground mb-1">File ID</dt>
                    <dd className="font-mono text-xs bg-muted p-2 rounded">{source.file_id}</dd>
                  </div>
                )}
                {source.url && (
                  <div className="md:col-span-2">
                    <dt className="text-muted-foreground mb-1">URL</dt>
                    <dd>
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                        {source.url}
                      </a>
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground mb-1">Created</dt>
                  <dd className="font-medium">{new Date(source.created_at).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd>
                </div>
                {source.text_length && source.chunks_count && (
                  <div>
                    <dt className="text-muted-foreground mb-1">Avg Chunk Size</dt>
                    <dd className="font-medium">{Math.round(source.text_length / source.chunks_count)} characters</dd>
                  </div>
                )}
                {source.processing_time && source.chunks_count && (
                  <div>
                    <dt className="text-muted-foreground mb-1">Processing Speed</dt>
                    <dd className="font-medium">{(source.chunks_count / source.processing_time * 60).toFixed(1)} chunks/min</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Status alerts */}
          {source.status === 'failed' && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive mb-1">Processing Failed</p>
              <p className="text-xs text-muted-foreground">There was an error processing this document. Click &quot;Re-process&quot; to try again.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
