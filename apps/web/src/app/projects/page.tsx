'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardNav } from '@/components/dashboard-nav'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingLink } from '@/components/loading-link'
import { Plus, FolderOpen, Calendar, FileText, Upload, Search, CheckCircle2 } from 'lucide-react'
import { projectsApi, type Project } from '@/lib/api-client'
import { formatDistanceToNow } from 'date-fns'
import { triggerLoading } from '@/components/global-loading-spinner'
import { useDebounce } from '@/hooks/use-debounce'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [buildingType, setBuildingType] = useState<string>('')
  const [sort, setSort] = useState('updated_at')
  const debouncedSearch = useDebounce(search, 300)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { sort, order: 'desc' }
      if (debouncedSearch) params.search = debouncedSearch
      if (buildingType) params.building_type = buildingType
      const data = await projectsApi.list(params)
      setProjects(Array.isArray(data) ? data : [])
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load projects')
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, buildingType, sort])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  return (
    <>
      <DashboardNav />
      <div className="flex-1 space-y-6 p-8 pt-6 container max-w-7xl">
        <PageHeader
          title="Projects"
          description="Manage compliance projects and track submissions"
          actions={
            <Button size="sm" asChild onClick={() => triggerLoading()}>
              <LoadingLink href="/projects/new">
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </LoadingLink>
            </Button>
          }
        />

        {/* Search / Filter toolbar */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={buildingType || 'all'} onValueChange={(v) => setBuildingType(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="building">Building</SelectItem>
              <SelectItem value="infrastructure">Infrastructure</SelectItem>
              <SelectItem value="mechanical">Mechanical</SelectItem>
              <SelectItem value="electrical">Electrical</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated_at">Last updated</SelectItem>
              <SelectItem value="created_at">Date created</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="submissions">Submissions</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex gap-4">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchProjects}>Retry</Button>
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-md border border-dashed p-12 text-center">
            <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-medium mb-1">
              {debouncedSearch || buildingType ? 'No projects match your filters' : 'No projects yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {debouncedSearch || buildingType
                ? 'Try adjusting your search or filters'
                : 'Create your first project to organize CAD submissions'}
            </p>
            {!debouncedSearch && !buildingType && (
              <Button size="sm" asChild onClick={() => triggerLoading()}>
                <LoadingLink href="/projects/new"><Plus className="mr-2 h-4 w-4" />Create Project</LoadingLink>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const total = project._count?.submissions ?? 0
              const analyzed = project._count?.analyzed ?? 0
              const reference = project.last_analysis_at ?? project.updated_at
              return (
                <Card key={project.id} className="p-5 h-full hover:border-foreground/20 transition-colors group relative">
                  <LoadingLink href={`/projects/${project.id}`} className="absolute inset-0 z-0" />
                  <div className="relative z-10 space-y-3 pointer-events-none">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium line-clamp-1 group-hover:text-primary transition-colors">
                        {project.name}
                      </h3>
                      {project.building_type && (
                        <Badge variant="secondary" className="shrink-0 text-xs">{project.building_type}</Badge>
                      )}
                    </div>
                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {total} submission{total !== 1 ? 's' : ''}
                      </span>
                      {total > 0 && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          {analyzed}/{total} analyzed
                        </span>
                      )}
                      <span className="flex items-center gap-1 ml-auto">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(reference), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  {/* New Submission shortcut */}
                  <div className="relative z-10 mt-3 pointer-events-auto">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full justify-start text-xs text-muted-foreground h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      asChild
                      onClick={(e) => { e.stopPropagation(); triggerLoading() }}
                    >
                      <LoadingLink href={`/submissions/new?project=${project.id}`}>
                        <Upload className="mr-1.5 h-3 w-3" />
                        New Submission
                      </LoadingLink>
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
