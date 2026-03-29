'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, AlertCircle, CheckCircle2, Clock, Loader2, ArrowRight } from 'lucide-react'
import { LoadingLink } from '@/components/loading-link'
import { useEffect, useState } from 'react'
import { dashboardApi, ActivityItem } from '@/lib/api-client'
import { formatDistanceToNow } from 'date-fns'

export function RecentActivity() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchRecentActivity() }, [])

  const fetchRecentActivity = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await dashboardApi.getActivity(10)
      setActivities(data.activities)
    } catch (error: any) {
      setError(error?.response?.data?.detail || 'Failed to load recent activity')
    } finally {
      setLoading(false)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'analysis_completed': return <CheckCircle2 className="h-3.5 w-3.5" />
      case 'analysis_in_progress': return <Loader2 className="h-3.5 w-3.5 animate-spin" />
      case 'analysis_failed': return <AlertCircle className="h-3.5 w-3.5" />
      default: return <FileText className="h-3.5 w-3.5" />
    }
  }

  const getDot = (status?: string) => {
    switch (status) {
      case 'success': return 'bg-green-500'
      case 'error': return 'bg-destructive'
      case 'warning': return 'bg-amber-500'
      default: return 'bg-primary'
    }
  }

  const formatTs = (ts: string) => {
    try { return formatDistanceToNow(new Date(ts), { addSuffix: true }) }
    catch { return ts }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
        <Button variant="ghost" size="sm" onClick={fetchRecentActivity} className="h-7 w-7 p-0 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchRecentActivity}>Try again</Button>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 py-3 first:pt-0">
                <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${getDot(activity.status)}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{activity.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{activity.description}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">{formatTs(activity.timestamp)}</p>
                </div>
                {activity.link && (
                  <LoadingLink href={activity.link} className="shrink-0 text-muted-foreground hover:text-foreground mt-0.5">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </LoadingLink>
                )}
              </div>
            ))}
          </div>
        )}
        {!loading && !error && activities.length > 0 && (
          <div className="pt-3 mt-1 border-t">
            <LoadingLink href="/submissions">
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-foreground text-xs">
                View all submissions
              </Button>
            </LoadingLink>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
