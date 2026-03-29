'use client'

import { useEffect, useState } from 'react'
import { DashboardNav } from '@/components/dashboard-nav'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadingLink } from '@/components/loading-link'
import { Plus, FolderOpen, Calendar, FileText, AlertCircle } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { formatDistanceToNow } from 'date-fns'
import { triggerLoading } from '@/components/global-loading-spinner'

interface Project {
  id: string
  name: string
  description: string | null
  building_type: string | null
  org_id: string
  created_at: string
  updated_at: string
  _count?: {
    submissions: number
  }
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        console.log('Fetching projects...')
        const data = await apiClient.get<Project[]>('/projects')
        console.log('Projects data:', data)
        const projectsList = Array.isArray(data) ? data : []
        setProjects(projectsList)
        setError(null)
      } catch (error: any) {
        console.error('Failed to fetch projects:', error)
        setError(error?.response?.data?.detail || error?.message || 'Failed to load projects')
        setProjects([])
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [])

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
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-md border border-dashed p-12 text-center">
            <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-medium mb-1">No projects yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first project to organize CAD submissions</p>
            <Button size="sm" asChild onClick={() => triggerLoading()}>
              <LoadingLink href="/projects/new"><Plus className="mr-2 h-4 w-4" />Create Project</LoadingLink>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <LoadingLink key={project.id} href={`/projects/${project.id}`} className="block group">
                <Card className="p-5 h-full hover:border-foreground/20 transition-colors">
                  <div className="space-y-3">
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
                        {project._count?.submissions || 0} submissions
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
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
