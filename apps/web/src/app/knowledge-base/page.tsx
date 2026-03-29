'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LoadingLink } from '@/components/loading-link'
import { DashboardNav } from '@/components/dashboard-nav'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, BookOpen, FileText, Search, BarChart3 } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api-client'
import { Input } from '@/components/ui/input'
import { formatDistanceToNow } from 'date-fns'

interface KnowledgeSource {
  id: number
  title: string
  type: string
  source_type?: string
  status: string
  created_at: string
  document_count?: number
  chunks_count?: number
  category?: string
}

export default function KnowledgeBasePage() {
  const { accessToken } = useAuth()
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchSources = async () => {
      if (!accessToken) return

      try {
        const response = await apiClient.get('/kb/sources', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        // Handle both response.data and direct array response
        const sourcesData = Array.isArray(response) ? response : (response.data || [])
        setSources(sourcesData)
      } catch (error) {
        console.error('Failed to fetch knowledge sources:', error)
        setSources([]) // Set empty array on error
      } finally {
        setLoading(false)
      }
    }

    fetchSources()
  }, [accessToken])

  const filteredSources = (sources || []).filter((source) =>
    source.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <>
      <DashboardNav />
      <div className="flex-1 space-y-6 p-8 pt-6 container max-w-7xl">
        <PageHeader
          title="Knowledge Base"
          description="Manage compliance documents and standards for AI analysis"
          actions={
            <>
              <Button variant="outline" size="sm" asChild>
                <LoadingLink href="/knowledge-base/dashboard">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View Stats
                </LoadingLink>
              </Button>
              <Button size="sm" asChild>
                <LoadingLink href="/knowledge-base/upload">
                  <Plus className="mr-2 h-4 w-4" />
                  Upload Document
                </LoadingLink>
              </Button>
            </>
          }
        />
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search knowledge base..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 max-w-sm"
          />
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-5 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-full"></div>
                </div>
              </Card>
            ))}
          </div>
        ) : filteredSources.length === 0 && searchQuery === '' ? (
          <div className="rounded-md border border-dashed p-12 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-medium mb-1">No documents yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Upload compliance documents to enhance AI analysis accuracy
            </p>
            <Button size="sm" asChild>
              <LoadingLink href="/knowledge-base/upload">
                <Plus className="mr-2 h-4 w-4" />
                Upload Your First Document
              </LoadingLink>
            </Button>
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="rounded-md border border-dashed p-12 text-center">
            <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-medium mb-1">No results found</h3>
            <p className="text-sm text-muted-foreground">
              No documents match &quot;{searchQuery}&quot;
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSources.map((source) => (
              <LoadingLink key={source.id} href={`/knowledge-base/${source.id}`}>
                <Card className="p-5 hover:border-foreground/20 transition-colors cursor-pointer">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium line-clamp-2 flex-1 min-w-0">{source.title}</h3>
                      <Badge variant="outline" className="font-normal flex-shrink-0 text-xs">{source.source_type || source.type}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{source.chunks_count || source.document_count || 0} chunks</span>
                      <span>
                        {formatDistanceToNow(new Date(source.created_at), {
                          addSuffix: true,
                        }).replace('about ', '')}
                      </span>
                    </div>
                  </div>
                </Card>
              </LoadingLink>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

