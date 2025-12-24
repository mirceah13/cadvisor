'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardNav } from '@/components/dashboard-nav'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api-client'
import { ArrowLeft, Upload, FileText, Settings, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Project {
  id: number
  name: string
  description: string
  type: string
  status: string
  created_at: string
  updated_at: string
}

interface Submission {
  id: number
  name: string
  status: string
  created_at: string
  findings_count?: number
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { accessToken } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

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
        setProject(projectRes.data)
        setSubmissions(submissionsRes.data)
      } catch (error) {
        console.error('Failed to fetch project:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [accessToken, params.id])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'archived':
        return 'bg-gray-100 text-gray-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <>
        <DashboardNav />
        <div className="flex-1 p-8 pt-6 container">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
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
      <div className="flex-1 space-y-8 p-8 pt-6 container">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight">{project.name}</h2>
              <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
            </div>
            <p className="text-muted-foreground mt-2">{project.description}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Created {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href={`/submissions/new?project=${project.id}`}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Submission
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/projects/${project.id}/settings`}>
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
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
              <Card className="p-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No submissions yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Upload your first CAD file for analysis
                  </p>
                  <Button asChild>
                    <Link href={`/submissions/new?project=${project.id}`}>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Submission
                    </Link>
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {submissions.map((submission) => (
                  <Link key={submission.id} href={`/submissions/${submission.id}`}>
                    <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{submission.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(submission.created_at), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          {submission.findings_count !== undefined && (
                            <span className="text-sm text-muted-foreground">
                              {submission.findings_count} findings
                            </span>
                          )}
                          <Badge>{submission.status}</Badge>
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
    </>
  )
}
