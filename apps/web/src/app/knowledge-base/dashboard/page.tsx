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
      <div className="container mx-auto p-6">
        <Skeleton className="h-10 w-64 mb-6" />
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
        <h1 className="text-3xl font-bold">Knowledge Base Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your AI training data and vector embeddings
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="relative overflow-hidden border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -mr-12 -mt-12" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Documents
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">{stats?.total_sources || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Compliance documents uploaded
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full -mr-12 -mt-12" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Text Embeddings
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Database className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{stats?.chunks_with_embeddings || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.total_chunks || 0} total chunks in pgvector
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full -mr-12 -mt-12" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Visual Embeddings
            </CardTitle>
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Image className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-purple-700 dark:text-purple-400">{stats?.images_with_embeddings || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.total_images || 0} total images extracted
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full -mr-12 -mt-12" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ready for Search
            </CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/10">
              <CheckCircle2 className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-amber-700 dark:text-amber-400">
              {(stats?.sources_by_status?.indexed || 0) + (stats?.sources_by_status?.ready || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Fully processed documents
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Processing Status Cards */}
      {((stats?.sources_by_status?.uploaded || 0) > 0 || (stats?.sources_by_status?.processing || 0) > 0 || (stats?.sources_by_status?.failed || 0) > 0) && (
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {(stats?.sources_by_status?.processing || 0) > 0 && (
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Activity className="h-5 w-5 text-blue-600 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                      {stats?.sources_by_status?.processing || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Currently Processing</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {(stats?.sources_by_status?.uploaded || 0) > 0 && (
            <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                      {stats?.sources_by_status?.uploaded || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Waiting in Queue</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {(stats?.sources_by_status?.failed || 0) > 0 && (
            <Card className="border-red-200 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                      {stats?.sources_by_status?.failed || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Processing Failed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Overall System Health */}
      {stats && (stats.total_chunks > 0 || stats.total_images > 0) && (
        <Card className="mb-6 relative overflow-hidden bg-gradient-to-r from-emerald-500/5 via-blue-500/5 to-purple-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              System Performance
            </CardTitle>
            <CardDescription>Overall embedding generation success rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Text Embeddings Progress */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium">Text Embeddings</span>
                  </div>
                  <span className="text-2xl font-bold text-emerald-600">
                    {stats.total_chunks > 0 ? Math.round((stats.chunks_with_embeddings / stats.total_chunks) * 100) : 0}%
                  </span>
                </div>
                <div className="relative h-3 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-green-600 rounded-full transition-all duration-1000"
                    style={{ 
                      width: `${stats.total_chunks > 0 ? (stats.chunks_with_embeddings / stats.total_chunks * 100) : 0}%` 
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{stats.chunks_with_embeddings.toLocaleString()} successful</span>
                  <span>{stats.total_chunks.toLocaleString()} total</span>
                </div>
              </div>

              {/* Visual Embeddings Progress */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4 text-purple-600" />
                    <span className="font-medium">Visual Embeddings</span>
                  </div>
                  <span className="text-2xl font-bold text-purple-600">
                    {stats.total_images > 0 ? Math.round((stats.images_with_embeddings / stats.total_images) * 100) : 0}%
                  </span>
                </div>
                <div className="relative h-3 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-pink-600 rounded-full transition-all duration-1000"
                    style={{ 
                      width: `${stats.total_images > 0 ? (stats.images_with_embeddings / stats.total_images * 100) : 0}%` 
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{stats.images_with_embeddings.toLocaleString()} successful</span>
                  <span>{stats.total_images.toLocaleString()} total</span>
                </div>
              </div>
            </div>

            {/* Overall Success Bar */}
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">Combined Success Rate</span>
                <span className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-purple-600 bg-clip-text text-transparent">
                  {((stats.total_chunks + stats.total_images) > 0) 
                    ? Math.round(((stats.chunks_with_embeddings + stats.images_with_embeddings) / (stats.total_chunks + stats.total_images)) * 100) 
                    : 0}%
                </span>
              </div>
              <div className="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 rounded-full transition-all duration-1000"
                  style={{ 
                    width: `${((stats.total_chunks + stats.total_images) > 0) 
                      ? ((stats.chunks_with_embeddings + stats.images_with_embeddings) / (stats.total_chunks + stats.total_images) * 100) 
                      : 0}%` 
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
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
            <CardTitle>Documents by Category</CardTitle>
            <CardDescription>Distribution across compliance areas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats?.sources_by_category || {}).map(([category, count]) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{categoryLabels[category] || category}</span>
                    <span className="text-sm font-bold text-muted-foreground">{count}</span>
                  </div>
                  <div className="relative h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${(count / (stats?.total_sources || 1)) * 100}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                    </div>
                  </div>
                </div>
              ))}
              {Object.keys(stats?.sources_by_category || {}).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No documents uploaded yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Model Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              AI Model Information
            </CardTitle>
            <CardDescription>Language model and embeddings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Embedding Model</div>
                <div className="text-lg font-semibold mt-1">nomic-embed-text</div>
                <p className="text-sm text-muted-foreground mt-1">
                  768-dimensional embeddings via Ollama
                </p>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Vector Database</div>
                <div className="text-lg font-semibold mt-1">PostgreSQL + pgvector</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Cosine similarity search enabled
                </p>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Processing</div>
                <div className="text-lg font-semibold mt-1">Celery + Redis</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Async document ingestion pipeline
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
