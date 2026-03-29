'use client'

import { useEffect, useState, useMemo } from 'react'
import { DashboardNav } from '@/components/dashboard-nav'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Upload, Search, FileText, CheckCircle2, Clock, AlertCircle, TrendingUp } from 'lucide-react'
import { submissionsApi, type SubmissionListItem } from '@/lib/api-client'
import { formatDistanceToNow } from 'date-fns'
import { LoadingLink } from '@/components/loading-link'
import { triggerLoading } from '@/components/global-loading-spinner'
import { useDebounce } from '@/hooks/use-debounce'

const STATUS_STYLES: Record<string, string> = {
  reviewed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
  analyzing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  reviewed: <CheckCircle2 className="h-3 w-3" />,
  approved: <CheckCircle2 className="h-3 w-3" />,
  analyzing: <TrendingUp className="h-3 w-3" />,
  submitted: <TrendingUp className="h-3 w-3" />,
  draft: <Clock className="h-3 w-3" />,
  rejected: <AlertCircle className="h-3 w-3" />,
}

function SeverityBar({ summary }: { summary: SubmissionListItem['findings_summary'] }) {
  if (!summary || summary.total === 0) return null
  const { critical, high, medium, low, total } = summary
  const pct = (n: number) => `${Math.max((n / total) * 100, 0)}%`
  return (
    <div
      className="flex h-1.5 w-20 rounded-full overflow-hidden"
      title={`${critical} critical · ${high} high · ${medium} medium · ${low} low`}
    >
      {critical > 0 && <div className="bg-red-500" style={{ width: pct(critical) }} />}
      {high > 0 && <div className="bg-orange-500" style={{ width: pct(high) }} />}
      {medium > 0 && <div className="bg-yellow-500" style={{ width: pct(medium) }} />}
      {low > 0 && <div className="bg-blue-400" style={{ width: pct(low) }} />}
    </div>
  )
}

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest' | 'name'>('newest')
  const debouncedSearch = useDebounce(search, 250)

  const fetchSubmissions = async () => {
    setLoading(true)
    try {
      const data = await submissionsApi.list()
      setSubmissions(Array.isArray(data) ? data : [])
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load submissions')
      setSubmissions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSubmissions() }, [])

  const filtered = useMemo(() => {
    let result = [...submissions]
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.project_name ?? '').toLowerCase().includes(q)
      )
    }
    if (statusFilter) result = result.filter(s => s.status === statusFilter)
    if (sort === 'newest') result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    else if (sort === 'oldest') result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    else result.sort((a, b) => a.name.localeCompare(b.name))
    return result
  }, [submissions, debouncedSearch, statusFilter, sort])

  return (
    <>
      <DashboardNav />
      <div className="flex-1 space-y-6 p-8 pt-6 container max-w-7xl">
        <PageHeader
          title="Submissions"
          description="Track CAD file submissions for compliance analysis"
          actions={
            <Button size="sm" asChild onClick={() => triggerLoading()}>
              <LoadingLink href="/submissions/new">
                <Plus className="mr-2 h-4 w-4" />
                New Submission
              </LoadingLink>
            </Button>
          }
        />

        {/* Toolbar */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search submissions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="analyzing">Analyzing</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="name">Name A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="px-4 py-3">
                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-1.5 w-20 rounded-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchSubmissions}>Retry</Button>
          </div>
        ) : submissions.length === 0 ? (
          <div className="rounded-md border border-dashed p-12 text-center">
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-medium mb-1">No submissions yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Upload a CAD file for compliance analysis</p>
            <Button size="sm" asChild onClick={() => triggerLoading()}>
              <LoadingLink href="/submissions/new"><Plus className="mr-2 h-4 w-4" />Create Submission</LoadingLink>
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center">
            <p className="text-sm font-medium mb-1">No submissions match your filters</p>
            <p className="text-xs text-muted-foreground">Try adjusting your search or status filter</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((submission) => {
              const statusStyle = STATUS_STYLES[submission.status.toLowerCase()] ||
                'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200'
              const statusIcon = STATUS_ICONS[submission.status.toLowerCase()] || <FileText className="h-3 w-3" />
              return (
                <LoadingLink key={submission.id} href={`/submissions/${submission.id}`} className="block">
                  <Card className="px-4 py-3 hover:border-foreground/20 transition-colors group">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                            {submission.name}
                          </h3>
                          <span className={`inline-flex items-center gap-1 shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${statusStyle}`}>
                            {statusIcon}
                            {submission.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {submission.project_name && <span>{submission.project_name}</span>}
                          <span>{submission.files_count} {submission.files_count === 1 ? 'file' : 'files'}</span>
                          <span>{formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                      {submission.findings_summary && submission.findings_summary.total > 0 && (
                        <div className="flex items-center gap-2 shrink-0">
                          <SeverityBar summary={submission.findings_summary} />
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {submission.findings_summary.total}
                            {submission.findings_summary.critical > 0 && (
                              <span className="text-destructive font-medium"> · {submission.findings_summary.critical} crit</span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </Card>
                </LoadingLink>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
