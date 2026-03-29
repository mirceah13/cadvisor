'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useLoadingRouter } from '@/hooks/use-loading-router'
import Link from 'next/link'
import { DashboardNav } from '@/components/dashboard-nav'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api-client'
import { ArrowLeft, Upload, FileText, Settings, Trash2, Building2, Calendar, FolderOpen } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { LoadingSkeleton } from '@/components/loading-skeleton'

interface Project {
  id: string
  name: string
  description: string | null
  building_type: string | null
  org_id: string
  created_at: string
  updated_at: string
}

interface Submission {
  id: string
  name: string
  status: string
  created_at: string
  findings_count?: number
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useLoadingRouter()
  const { accessToken } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    const fetchProject = async () => {
      if (!accessToken || !params.id) return

      try {
        const [projectRes, submissionsRes] = await Promise.all([
          apiClient.get(`/projects/${params.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          apiClient.get(`/projects/${params.id}/submissions`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ])
        
        // Handle both response.data and direct array response
        const projectData = projectRes.data || projectRes
        const submissionsData = Array.isArray(submissionsRes) ? submissionsRes : (submissionsRes.data || [])
        
        console.log('Project data:', projectData)
        console.log('Submissions data:', submissionsData)
        
        setProject(projectData)
        setSubmissions(submissionsData)
      } catch (error) {
        console.error('Failed to fetch project:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [accessToken, params.id])

  const handleDelete = async () => {
    if (!accessToken || !params.id) return
    
    setDeleting(true)
    try {
      await apiClient.delete(`/projects/${params.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      router.push('/projects')
    } catch (error: any) {
      console.error('Failed to delete project:', error)
      alert(error.response?.data?.detail || 'Failed to delete project')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (loading) {
    return (
      <>
        <DashboardNav />
        <div className="flex-1 p-8 pt-6 container">
          <LoadingSkeleton />
        </div>
      </>
    )
  }

  if (!project) {
    return (
      <>
        <DashboardNav />
        <div className="flex-1 p-8 pt-6 container">
          <Card className="p-12 text-center">
            <h3 className="text-lg font-semibold mb-2">Project not found</h3>
            <Button asChild>
              <Link href="/projects">Back to Projects</Link>
            </Button>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <DashboardNav />
      <div className="flex-1 space-y-6 p-8 pt-6 container max-w-7xl">
        <PageHeader
          title={project.name}
          description={project.description || undefined}
          actions={
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/submissions/new?project=${project.id}`}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Submission
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          }
        />

        <Tabs defaultValue="submissions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
            <TabsTrigger value="findings">Findings</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="submissions" className="space-y-4">
            {submissions.length === 0 ? (
              <div className="rounded-md border border-dashed p-12 text-center">
                    <h3 className="text-sm font-medium mb-1">No submissions yet</h3>
                    <p className="text-xs text-muted-foreground mb-4">Upload a CAD file to start generating compliance insights</p>
                    <Button size="sm" asChild>
                      <Link href={`/submissions/new?project=${project.id}`}>
                        <Upload className="mr-2 h-4 w-4" />Upload Submission
                      </Link>
                    </Button>
                  </div>
            ) : (
              <div className="grid gap-3">
                {submissions.map((submission) => (
                  <Link key={submission.id} href={`/submissions/${submission.id}`} className="block group">
                    <Card className="p-4 hover:border-foreground/20 transition-colors">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                            {submission.name}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {submission.findings_count !== undefined && (
                            <span className="text-sm font-medium tabular-nums">{submission.findings_count} findings</span>
                          )}
                          <Badge variant={submission.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                            {submission.status}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="findings">
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Findings view coming soon</p>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Reports view coming soon</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project "{project?.name}" and all associated submissions. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete Project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
