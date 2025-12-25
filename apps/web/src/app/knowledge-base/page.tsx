'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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
  status: string
  created_at: string
  document_count?: number
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
      <div className="flex-1 space-y-8 p-8 pt-6 container">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Knowledge Base</h2>
            <p className="text-muted-foreground">
              Manage compliance documents and standards for AI analysis
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/knowledge-base/dashboard">
                <BarChart3 className="mr-2 h-4 w-4" />
                View Stats
              </Link>
            </Button>
            <Button asChild>
              <Link href="/knowledge-base/upload">
                <Plus className="mr-2 h-4 w-4" />
                Upload Document
              </Link>
            </Button>
          </div>
        </div>

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
              <Card key={i} className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                </div>
              </Card>
            ))}
          </div>
        ) : filteredSources.length === 0 && searchQuery === '' ? (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
              <p className="text-muted-foreground mb-4">
                Upload compliance documents to enhance AI analysis accuracy
              </p>
              <Button asChild>
                <Link href="/knowledge-base/upload">
                  <Plus className="mr-2 h-4 w-4" />
                  Upload Document
                </Link>
              </Button>
            </div>
          </Card>
        ) : filteredSources.length === 0 ? (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No results found</h3>
              <p className="text-muted-foreground">
                No documents match "{searchQuery}"
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSources.map((source) => (
              <Link key={source.id} href={`/knowledge-base/${source.id}`}>
                <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold line-clamp-1">{source.title}</h3>
                      </div>
                      <Badge variant="outline">{source.type}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{source.document_count || 0} documents</span>
                      <span>
                        {formatDistanceToNow(new Date(source.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
