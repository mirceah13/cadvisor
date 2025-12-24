'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DashboardNav } from '@/components/dashboard-nav'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, FolderOpen, Calendar, FileText } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api-client'
import { formatDistanceToNow } from 'date-fns'
import { CardSkeleton } from '@/components/loading-skeleton'

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
  const { accessToken } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProjects = async () => {
      console.log('Fetching projects, accessToken:', accessToken ? 'exists' : 'missing')
      
      if (!accessToken) {
        setLoading(false)
        return
      }

      try {
        const response = await apiClient.get('/projects', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        console.log('Full response:', response)
        console.log('Type of response:', typeof response)
        console.log('Is response an array?', Array.isArray(response))
        
        // The response itself is the data array, not response.data
        const data = Array.isArray(response) ? response : (response.data || [])
        console.log('Final data:', data)
        setProjects(data)
      } catch (error: any) {
        console.error('Failed to fetch projects:', error)
        console.error('Error response:', error.response)
        console.error('Error message:', error.message)
        setProjects([])
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [accessToken])

  return (
    <>
      <DashboardNav />
      <div className="flex-1 space-y-8 p-8 pt-6 container">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Projects</h2>
            <p className="text-muted-foreground">
              Manage your compliance projects and submissions
            </p>
          </div>
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : !projects || projects.length === 0 ? (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first project
              </p>
              <Button asChild>
                <Link href="/projects/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </Link>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, index) => (
              <Link 
                key={project.id} 
                href={`/projects/${project.id}`}
                className="transform transition-all duration-200 hover:scale-[1.02]"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-lg line-clamp-1">
                        {project.name}
                      </h3>
                      {project.building_type && (
                        <Badge variant="secondary">
                          {project.building_type}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span>{project._count?.submissions || 0} submissions</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(project.updated_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
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
