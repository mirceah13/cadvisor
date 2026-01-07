'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LoadingLink } from '@/components/loading-link'
import { DashboardNav } from '@/components/dashboard-nav'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, BookOpen, FileText, Search, BarChart3 } from 'lucide-react'
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
      <div className="flex-1 space-y-0">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/95 to-primary/80 text-white">
          <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
          <div className="container relative py-12 px-8">
            <div className="flex items-center justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
                    <BookOpen className="h-8 w-8" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold tracking-tight">Knowledge Base</h1>
                    <p className="text-white/80 mt-1">
                      Manage compliance documents and standards for AI analysis
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20" asChild>
                  <LoadingLink href="/knowledge-base/dashboard">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    View Stats
                  </LoadingLink>
                </Button>
                <Button className="bg-white text-primary hover:bg-white/90" asChild>
                  <LoadingLink href="/knowledge-base/upload">
                    <Plus className="mr-2 h-4 w-4" />
                    Upload Document
                  </LoadingLink>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container space-y-8 p-8">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search knowledge base..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-6 hover:shadow-lg transition-shadow">
                <div className="animate-pulse space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                </div>
              </Card>
            ))}
          </div>
        ) : filteredSources.length === 0 && searchQuery === '' ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="rounded-full bg-primary/10 p-6 mb-4">
                <BookOpen className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No documents yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Upload compliance documents to enhance AI analysis accuracy and ensure your submissions meet all requirements
              </p>
              <Button className="bg-primary hover:bg-primary/90" asChild>
                <LoadingLink href="/knowledge-base/upload">
                  <Plus className="mr-2 h-4 w-4" />
                  Upload Your First Document
                </LoadingLink>
              </Button>
            </div>
          </Card>
        ) : filteredSources.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="rounded-full bg-muted p-6 mb-4">
                <Search className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No results found</h3>
              <p className="text-muted-foreground">
                No documents match "{searchQuery}"
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSources.map((source) => (
              <LoadingLink key={source.id} href={`/knowledge-base/${source.id}`}>
                <Card className="p-6 hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer group">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="rounded-lg bg-primary/10 p-2.5 group-hover:bg-primary/20 transition-colors flex-shrink-0">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors flex-1 min-w-0">{source.title}</h3>
                      </div>
                      <Badge variant="outline" className="font-normal flex-shrink-0">{source.source_type || source.type}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5" />
                        <span>{source.chunks_count || source.document_count || 0} chunks</span>
                      </div>
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
      </div>
    </>
  )
}

