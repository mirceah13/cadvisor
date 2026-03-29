'use client'

import { useEffect, useState } from 'react'
import { useLoadingRouter } from '@/hooks/use-loading-router'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  ArrowLeft, 
  FileText, 
  Database, 
  Cpu,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Image,
  Zap,
  Activity
} from 'lucide-react'
import { DashboardNav } from '@/components/dashboard-nav'
import { PageHeader } from '@/components/page-header'

interface DashboardStats {
  total_sources: number
  sources_by_category: Record<string, number>
  sources_by_status: Record<string, number>
  total_chunks: number
  total_images: number
  chunks_with_embeddings: number
  images_with_embeddings: number
  recent_uploads: any[]
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

export default function KnowledgeBaseDashboardPage() {
  const router = useLoadingRouter()
  const { accessToken } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [accessToken])

  const fetchStats = async () => {
    if (!accessToken) return

    try {
      setLoading(true)
      // Use the new dedicated stats endpoint
      const response: any = await apiClient.get('/kb/stats', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      
      const data = response.data || response
      
      // Get recent uploads separately
      const sourcesResponse: any = await apiClient.get('/kb/sources?limit=5', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      
      const recentSources = sourcesResponse.data || sourcesResponse || []
      
      setStats({
        total_sources: data.total_sources || 0,
        sources_by_category: data.sources_by_category || {},
        sources_by_status: data.sources_by_status || {},
        total_chunks: data.total_chunks || 0,
        total_images: data.total_images || 0,
        chunks_with_embeddings: data.chunks_with_embeddings || 0,
        images_with_embeddings: data.images_with_embeddings || 0,
        recent_uploads: recentSources
      })
    } catch (err: any) {
      console.error('Failed to fetch stats:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <>
        <DashboardNav />
        <div className="flex-1 p-8 pt-6 container max-w-7xl">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <DashboardNav />
      <div className="flex-1 space-y-6 p-8 pt-6 container max-w-7xl">
        <PageHeader
          title="Knowledge Base Dashboard"
          description="Overview of your AI training data and vector embeddings"
        />

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{stats?.total_sources || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Compliance documents uploaded</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Text Embeddings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{stats?.chunks_with_embeddings || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats?.total_chunks || 0} total chunks in pgvector</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Visual Embeddings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{stats?.images_with_embeddings || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats?.total_images || 0} total images extracted</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ready for Search</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">
                {(stats?.sources_by_status?.indexed || 0) + (stats?.sources_by_status?.ready || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Fully processed documents</p>
            </CardContent>
          </Card>
        </div>

        {/* Processing Status */}
        {((stats?.sources_by_status?.uploaded || 0) > 0 || (stats?.sources_by_status?.processing || 0) > 0 || (stats?.sources_by_status?.failed || 0) > 0) && (
          <div className="grid gap-4 md:grid-cols-3">
            {(stats?.sources_by_status?.processing || 0) > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <Activity className="h-4 w-4 text-muted-foreground animate-pulse" />
                    <div>
                      <p className="text-xl font-semibold">{stats?.sources_by_status?.processing || 0}</p>
                      <p className="text-xs text-muted-foreground">Currently Processing</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {(stats?.sources_by_status?.uploaded || 0) > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xl font-semibold">{stats?.sources_by_status?.uploaded || 0}</p>
                      <p className="text-xs text-muted-foreground">Waiting in Queue</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {(stats?.sources_by_status?.failed || 0) > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <div>
                      <p className="text-xl font-semibold">{stats?.sources_by_status?.failed || 0}</p>
                      <p className="text-xs text-muted-foreground">Processing Failed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* System Performance */}
        {stats && (stats.total_chunks > 0 || stats.total_images > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">System Performance</CardTitle>
              <CardDescription>Overall embedding generation success rates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Text Embeddings</span>
                    <span className="tabular-nums text-muted-foreground">
                      {stats.chunks_with_embeddings.toLocaleString()} / {stats.total_chunks.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-1000"
                      style={{ width: `${stats.total_chunks > 0 ? (stats.chunks_with_embeddings / stats.total_chunks * 100) : 0}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Visual Embeddings</span>
                    <span className="tabular-nums text-muted-foreground">
                      {stats.images_with_embeddings.toLocaleString()} / {stats.total_images.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-1000"
                      style={{ width: `${stats.total_images > 0 ? (stats.images_with_embeddings / stats.total_images * 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Combined Success Rate</span>
                  <span className="font-semibold tabular-nums">
                    {((stats.total_chunks + stats.total_images) > 0)
                      ? Math.round(((stats.chunks_with_embeddings + stats.images_with_embeddings) / (stats.total_chunks + stats.total_images)) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-1000"
                    style={{ width: `${((stats.total_chunks + stats.total_images) > 0) ? ((stats.chunks_with_embeddings + stats.images_with_embeddings) / (stats.total_chunks + stats.total_images) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {(stats.chunks_with_embeddings + stats.images_with_embeddings).toLocaleString()} of {(stats.total_chunks + stats.total_images).toLocaleString()} items successfully embedded
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Documents by Category */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Documents by Category</CardTitle>
              <CardDescription>Distribution across compliance areas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(stats?.sources_by_category || {}).map(([category, count]) => (
                  <div key={category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span>{categoryLabels[category] || category}</span>
                      <span className="tabular-nums text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${(count / (stats?.total_sources || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {Object.keys(stats?.sources_by_category || {}).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No documents uploaded yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* AI Model Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">AI Model Information</CardTitle>
              <CardDescription>Language model and embeddings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Embedding Model</p>
                  <p className="font-medium">nomic-embed-text</p>
                  <p className="text-xs text-muted-foreground mt-0.5">768-dimensional embeddings via Ollama</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Vector Database</p>
                  <p className="font-medium">PostgreSQL + pgvector</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Cosine similarity search enabled</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Processing</p>
                  <p className="font-medium">Celery + Redis</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Async document ingestion pipeline</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
