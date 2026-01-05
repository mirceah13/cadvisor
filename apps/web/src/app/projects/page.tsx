'use client'

import { useEffect, useState } from 'react'
import { DashboardNav } from '@/components/dashboard-nav'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadingLink } from '@/components/loading-link'
import { Plus, FolderOpen, Calendar, FileText, Building2, TrendingUp, AlertCircle } from 'lucide-react'
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
      <div className="flex-1 space-y-8 p-8 pt-6 container max-w-7xl">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-8 text-primary-foreground shadow-2xl">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000,transparent)]" />
          <div className="relative flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">Projects</h1>
              <p className="text-primary-foreground/90 text-lg max-w-2xl">
                Manage your compliance projects and track submissions
              </p>
            </div>
            <Button 
              size="lg" 
              variant="secondary" 
              asChild 
              className="shadow-lg hover:shadow-xl transition-all"
              onClick={() => triggerLoading()}
            >
              <LoadingLink href="/projects/new">
                <Plus className="mr-2 h-5 w-5" />
                New Project
              </LoadingLink>
            </Button>
          </div>
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
          <Card className="p-12 border-2 border-red-200 dark:border-red-900">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="p-4 rounded-full bg-red-100 dark:bg-red-950 mb-4">
                <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-red-900 dark:text-red-100">Error Loading Projects</h3>
              <p className="text-red-700 dark:text-red-300 mb-6 max-w-md">
                {error}
              </p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </Card>
        ) : projects.length === 0 ? (
          <Card className="p-12 border-2 border-dashed border-primary/20">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <FolderOpen className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Get started by creating your first project to organize your CAD submissions
              </p>
              <Button 
                size="lg" 
                asChild 
                className="shadow-lg"
                onClick={() => triggerLoading()}
              >
                <LoadingLink href="/projects/new">
                  <Plus className="mr-2 h-5 w-5" />
                  Create Project
                </LoadingLink>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <LoadingLink 
                key={project.id} 
                href={`/projects/${project.id}`}
                className="block group"
              >
                <Card className="p-6 h-full hover:shadow-lg hover:border-primary/40 transition-all border-l-4 border-l-transparent hover:border-l-primary">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors flex-shrink-0">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
                            {project.name}
                          </h3>
                        </div>
                      </div>
                      {project.building_type && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 flex-shrink-0">
                          {project.building_type}
                        </Badge>
                      )}
                    </div>
                    
                    {project.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        <span>{project._count?.submissions || 0} {project._count?.submissions === 1 ? 'submission' : 'submissions'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {formatDistanceToNow(new Date(project.updated_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
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
