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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { projectsApi, type Project, type ProjectSubmission, type ProjectFindingsSummary } from '@/lib/api-client'
import { Upload, Trash2, Pencil, FileText, Calendar, CheckCircle2, BarChart3, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { LoadingSkeleton } from '@/components/loading-skeleton'
import { triggerLoading } from '@/components/global-loading-spinner'

const SEVERITY_CONFIG = [
  { key: 'critical' as const, label: 'Critical', color: 'bg-red-500' },
  { key: 'high' as const, label: 'High', color: 'bg-orange-500' },
  { key: 'medium' as const, label: 'Medium', color: 'bg-yellow-500' },
  { key: 'low' as const, label: 'Low', color: 'bg-blue-400' },
]

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useLoadingRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [submissions, setSubmissions] = useState<ProjectSubmission[]>([])
  const [findingsSummary, setFindingsSummary] = useState<ProjectFindingsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '', type: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchAll = async () => {
      if (!projectId) return
      try {
        const [projectData, submissionsData] = await Promise.all([
          projectsApi.get(projectId),
          projectsApi.getSubmissions(projectId),
        ])
        setProject(projectData)
        setSubmissions(Array.isArray(submissionsData) ? submissionsData : [])
        setEditForm({
          name: projectData.name,
          description: projectData.description ?? '',
          type: projectData.building_type ?? 'building',
        })
      } catch (err) {
        console.error('Failed to fetch project:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [projectId])

  const loadFindingsSummary = async () => {
    if (findingsSummary || !projectId) return
    try {
      const data = await projectsApi.getFindingsSummary(projectId)
      setFindingsSummary(data)
    } catch (err) {
      console.error('Failed to fetch findings summary:', err)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await projectsApi.remove(projectId)
      router.push('/projects')
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to delete project')
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await projectsApi.update(projectId, editForm)
      setProject(updated)
      setShowEditDialog(false)
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to update project')
    } finally {
      setSaving(false)
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

  const total = project._count?.submissions ?? submissions.length
  const analyzed = project._count?.analyzed ?? 0

  return (
    <>
      <DashboardNav />
      <div className="flex-1 space-y-6 p-8 pt-6 container max-w-7xl">
        <PageHeader
          title={project.name}
          description={project.description ?? undefined}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button variant="outline" size="sm" asChild onClick={() => triggerLoading()}>
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

        {/* Project metadata strip */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {project.building_type && (
            <Badge variant="secondary">{project.building_type}</Badge>
          )}
          <span className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            {total} submission{total !== 1 ? 's' : ''}
          </span>
          {total > 0 && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              {analyzed} analyzed
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Updated {formatDistanceToNow(new Date(project.last_analysis_at ?? project.updated_at), { addSuffix: true })}
          </span>
        </div>

        <Tabs defaultValue="submissions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
            <TabsTrigger value="findings" onClick={loadFindingsSummary}>Findings</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="submissions" className="space-y-4">
            {submissions.length === 0 ? (
              <div className="rounded-md border border-dashed p-12 text-center">
                <h3 className="text-sm font-medium mb-1">No submissions yet</h3>
                <p className="text-xs text-muted-foreground mb-4">Upload a CAD file to start generating compliance insights</p>
                <Button size="sm" asChild onClick={() => triggerLoading()}>
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
            {!findingsSummary ? (
              <Card className="p-12 text-center">
                <p className="text-sm text-muted-foreground">Loading findings…</p>
              </Card>
            ) : findingsSummary.total === 0 ? (
              <div className="rounded-md border border-dashed p-12 text-center">
                <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No findings yet. Run an analysis first.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Card className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-medium">Findings Distribution</h3>
                    <span className="text-sm text-muted-foreground">{findingsSummary.total} total</span>
                  </div>
                  <div className="space-y-3">
                    {SEVERITY_CONFIG.map(({ key, label, color }) => {
                      const count = findingsSummary[key]
                      const pct = findingsSummary.total > 0 ? (count / findingsSummary.total) * 100 : 0
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <span className="w-16 text-xs text-muted-foreground">{label}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-8 text-xs text-right tabular-nums">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports">
            <Card className="p-8 text-center space-y-3">
              <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium">View reports for this project</p>
              <p className="text-xs text-muted-foreground">Generated reports are linked to individual submissions</p>
              <Button size="sm" variant="outline" asChild onClick={() => triggerLoading()}>
                <Link href={`/submissions?project=${project.id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Submissions
                </Link>
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Type</Label>
              <Select value={editForm.type} onValueChange={(v) => setEditForm({ ...editForm, type: v })}>
                <SelectTrigger id="edit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="building">Building</SelectItem>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="mechanical">Mechanical</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{project.name}" and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete Project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
