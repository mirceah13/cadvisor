'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, FileText, AlertCircle, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { LoadingLink } from '@/components/loading-link'
import { useEffect, useState } from 'react'
import { dashboardApi, ActivityItem } from '@/lib/api-client'
import { formatDistanceToNow } from 'date-fns'

export function RecentActivity() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRecentActivity()
  }, [])

  const fetchRecentActivity = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await dashboardApi.getActivity(10)
      setActivities(data.activities)
    } catch (error: any) {
      console.error('Failed to fetch recent activity:', error)
      setError(error?.response?.data?.detail || 'Failed to load recent activity')
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'submission_created':
        return <FileText className="h-4 w-4" />
      case 'analysis_completed':
        return <CheckCircle2 className="h-4 w-4" />
      case 'analysis_in_progress':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'analysis_failed':
        return <AlertCircle className="h-4 w-4" />
      case 'finding_reviewed':
        return <CheckCircle2 className="h-4 w-4" />
      case 'report_generated':
        return <FileText className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    } catch (e) {
      return timestamp
    }
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates from your projects</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchRecentActivity} className="hover:bg-primary/10 hover:text-primary">
            <Clock className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={fetchRecentActivity}>
              Try again
            </Button>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No recent activity</p>
            <p className="text-sm text-muted-foreground mt-2">
              Upload your first submission to get started
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 rounded-lg border p-3 hover:bg-primary/5 hover:border-primary/40 transition-all group cursor-pointer"
              >
                <div className={`rounded-lg p-2.5 ${getStatusColor(activity.status)} shadow-sm`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm group-hover:text-primary transition-colors">{activity.title}</p>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {activity.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      {formatTimestamp(activity.timestamp)}
                    </p>
                  </div>
                </div>
                {activity.link && (
                  <LoadingLink href={activity.link}>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-all group-hover:bg-primary/10 group-hover:text-primary">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </LoadingLink>
                )}
              </div>
            ))}
          </div>
        )}
        
        {!loading && !error && activities.length > 0 && (
          <div className="mt-4 text-center pt-3 border-t">
            <LoadingLink href="/submissions">
              <Button variant="outline" size="sm" className="hover:bg-primary/5 hover:border-primary hover:text-primary">
                View All Submissions
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </LoadingLink>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
