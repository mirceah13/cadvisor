'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useLoadingRouter } from '@/hooks/use-loading-router'
import Link from 'next/link'
import { DashboardNav } from '@/components/dashboard-nav'
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
      <div className="flex-1 space-y-8 p-8 pt-6 container max-w-7xl">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-8 text-primary-foreground shadow-2xl">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000,transparent)]" />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    asChild
                    className="text-primary-foreground/90 hover:text-primary-foreground hover:bg-white/10 -ml-2"
                  >
                    <Link href="/projects">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Projects
                    </Link>
                  </Button>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                    <Building2 className="h-8 w-8" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold tracking-tight">{project.name}</h1>
                    {project.building_type && (
                      <Badge variant="secondary" className="mt-2 bg-white/20 text-white border-white/30 hover:bg-white/30">
                        {project.building_type}
                      </Badge>
                    )}
                  </div>
                </div>
                {project.description && (
                  <p className="text-primary-foreground/90 text-lg max-w-3xl">
                    {project.description}
                  </p>
                )}
                <div className="flex items-center gap-6 text-sm text-primary-foreground/80">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Created {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>{submissions.length} {submissions.length === 1 ? 'Submission' : 'Submissions'}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <Button 
                  asChild
                  className="bg-white text-primary hover:bg-white/90 shadow-lg"
                >
                  <Link href={`/submissions/new?project=${project.id}`}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Submission
                  </Link>
                </Button>
                <Button 
                  variant="outline" 
                  asChild
                  className="border-white/30 text-white hover:bg-white/10 hover:border-white/50"
                >
                  <Link href={`/projects/${project.id}/settings`}>
                    <Settings className="h-4 w-4" />
                  </Link>
                </Button>
                <Button 
                  variant="outline"
                  className="border-red-300/50 text-white hover:bg-red-500/20 hover:border-red-300"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="submissions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
            <TabsTrigger value="findings">Findings</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="submissions" className="space-y-4">
            {submissions.length === 0 ? (
              <Card className="p-12 border-2 border-dashed">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="p-4 bg-primary/10 rounded-full mb-4">
                    <FileText className="h-12 w-12 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No submissions yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md">
                    Upload your first CAD file for analysis and start generating compliance insights
                  </p>
                  <Button asChild size="lg" className="shadow-lg">
                    <Link href={`/submissions/new?project=${project.id}`}>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Submission
                    </Link>
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4">
                {submissions.map((submission, index) => (
                  <Link 
                    key={submission.id} 
                    href={`/submissions/${submission.id}`}
                    className="block group"
                  >
                    <Card className="p-6 hover:shadow-lg hover:border-primary/40 transition-all duration-200 border-l-4 border-l-transparent hover:border-l-primary cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="p-3 bg-primary/5 rounded-lg group-hover:bg-primary/10 transition-colors">
                            <FileText className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-lg group-hover:text-primary transition-colors">
                              {submission.name}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Created {formatDistanceToNow(new Date(submission.created_at), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          {submission.findings_count !== undefined && (
                            <div className="text-center">
                              <div className="text-2xl font-bold text-primary">
                                {submission.findings_count}
                              </div>
                              <div className="text-xs text-muted-foreground">Findings</div>
                            </div>
                          )}
                          <Badge 
                            variant={submission.status === 'completed' ? 'default' : 'secondary'}
                            className="min-w-[100px] justify-center"
                          >
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
