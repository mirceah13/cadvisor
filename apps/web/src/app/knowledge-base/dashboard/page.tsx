'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  TrendingUp
} from 'lucide-react'

interface DashboardStats {
  total_sources: number
  sources_by_category: Record<string, number>
  sources_by_status: Record<string, number>
  total_chunks: number
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
  const router = useRouter()
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Documents
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total_sources || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Compliance documents uploaded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vector Embeddings
            </CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total_chunks || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Text chunks in pgvector
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ready
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{(stats?.sources_by_status?.indexed || 0) + (stats?.sources_by_status?.ready || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Fully processed documents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Processing
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(stats?.sources_by_status?.uploaded || 0) + (stats?.sources_by_status?.processing || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending/in progress
            </p>
          </CardContent>
        </Card>
      </div>

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
                <div key={category} className="flex items-center">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{categoryLabels[category] || category}</div>
                    <div className="mt-1 h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all"
                        style={{ width: `${(count / (stats?.total_sources || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="ml-4 text-sm font-medium text-muted-foreground">
                    {count}
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

      {/* Processing Status Alert */}
      {((stats?.sources_by_status?.uploaded || 0) > 0 || (stats?.sources_by_status?.processing || 0) > 0) && (
        <Card className="mt-6 border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-900">
              <AlertCircle className="h-5 w-5" />
              Processing Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(stats?.sources_by_status?.processing || 0) > 0 && (
                <p className="text-sm text-yellow-800">
                  <strong>{stats?.sources_by_status?.processing || 0}</strong> document(s) currently being processed.
                </p>
              )}
              {(stats?.sources_by_status?.uploaded || 0) > 0 && (
                <p className="text-sm text-yellow-800">
                  <strong>{stats?.sources_by_status?.uploaded || 0}</strong> document(s) waiting to be processed.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
