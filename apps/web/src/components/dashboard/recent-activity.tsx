'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, AlertCircle, CheckCircle2, Loader2, RefreshCw, Upload, ArrowRight } from 'lucide-react'
import { LoadingLink } from '@/components/loading-link'
import { useEffect, useState, useCallback, useRef } from 'react'
import { dashboardApi, ActivityItem } from '@/lib/api-client'
import { formatDistanceToNow } from 'date-fns'

const POLL_WHEN_ACTIVE_MS = 15_000

function StatusBadge({ type }: { type: string }) {
  switch (type) {
    case 'analysis_completed':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400 shrink-0">
          <CheckCircle2 className="h-3 w-3" />
          Analyzed
        </span>
      )
    case 'analysis_in_progress':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 shrink-0">
          <Loader2 className="h-3 w-3 animate-spin" />
          Analyzing
        </span>
      )
    case 'analysis_failed':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive shrink-0">
          <AlertCircle className="h-3 w-3" />
          Failed
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary shrink-0">
          <Upload className="h-3 w-3" />
          Uploaded
        </span>
      )
  }
}

function ActivityIcon({ type }: { type: string }) {
  const base = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full'
  switch (type) {
    case 'analysis_completed':
      return <div className={`${base} bg-green-500/10 text-green-500`}><CheckCircle2 className="h-4 w-4" /></div>
    case 'analysis_in_progress':
      return <div className={`${base} bg-amber-400/10 text-amber-500`}><Loader2 className="h-4 w-4 animate-spin" /></div>
    case 'analysis_failed':
      return <div className={`${base} bg-destructive/10 text-destructive`}><AlertCircle className="h-4 w-4" /></div>
    default:
      return <div className={`${base} bg-primary/10 text-primary`}><FileText className="h-4 w-4" /></div>
  }
}

export function RecentActivity() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchRecentActivity = useCallback(async () => {
    try {
      setLoading(prev => {
        // Only show full skeleton on first load
        return activities.length === 0 ? true : prev
      })
      setError(null)
      const data = await dashboardApi.getActivity(20)
      setActivities(data.activities)
    } catch (error: any) {
      setError(error?.response?.data?.detail || 'Failed to load recent activity')
    } finally {
      setLoading(false)
    }
  }, [activities.length])

  useEffect(() => {
    fetchRecentActivity()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-poll while any submission is being analyzed
  useEffect(() => {
    const hasActive = activities.some(a => a.type === 'analysis_in_progress')
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (hasActive) {
      intervalRef.current = setInterval(fetchRecentActivity, POLL_WHEN_ACTIVE_MS)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [activities, fetchRecentActivity])

  const formatTs = (ts: string) => {
    try { return formatDistanceToNow(new Date(ts), { addSuffix: true }) }
    catch { return ts }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-sm font-semibold">Recent Submissions</CardTitle>
          {!loading && !error && activities.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">{activities.length} submission{activities.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchRecentActivity}
          className="h-7 w-7 p-0 text-muted-foreground"
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>

      <CardContent className="pt-0 flex-1">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchRecentActivity}>Try again</Button>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-10">
            <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No submissions yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Upload a CAD file to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-center gap-3 py-3 first:pt-0">
                <ActivityIcon type={activity.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug truncate">{activity.description}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{formatTs(activity.timestamp)}</p>
                </div>
                <StatusBadge type={activity.type} />
                {activity.link && (
                  <LoadingLink href={activity.link} className="shrink-0 text-muted-foreground hover:text-foreground ml-1">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </LoadingLink>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {!loading && !error && activities.length > 0 && (
        <div className="px-6 pb-4 pt-1 border-t mt-1">
          <LoadingLink href="/submissions">
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-foreground text-xs">
              View all submissions
            </Button>
          </LoadingLink>
        </div>
      )}
    </Card>
  )
}
