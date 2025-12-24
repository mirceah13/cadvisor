'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, FileText, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface Activity {
  id: string
  type: 'submission_created' | 'analysis_completed' | 'finding_reviewed' | 'report_generated'
  title: string
  description: string
  timestamp: string
  link?: string
  status?: 'success' | 'warning' | 'error' | 'info'
}

export function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRecentActivity()
  }, [])

  const fetchRecentActivity = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/v1/dashboard/activity')
      // const data = await response.json()
      
      // Mock data
      const mockActivities: Activity[] = [
        {
          id: '1',
          type: 'analysis_completed',
          title: 'Analysis completed',
          description: 'Residential Building - Phase 2 submission analyzed with 23 findings',
          timestamp: '2 minutes ago',
          link: '/submissions/123',
          status: 'warning'
        },
        {
          id: '2',
          type: 'submission_created',
          title: 'New submission uploaded',
          description: 'Commercial Plaza - Initial submission with 8 files',
          timestamp: '15 minutes ago',
          link: '/submissions/124',
          status: 'info'
        },
        {
          id: '3',
          type: 'finding_reviewed',
          title: 'Finding verified',
          description: 'Fire safety issue marked as resolved in Building A',
          timestamp: '1 hour ago',
          link: '/findings/567',
          status: 'success'
        },
        {
          id: '4',
          type: 'report_generated',
          title: 'Report generated',
          description: 'Compliance report ready for Office Tower submission',
          timestamp: '2 hours ago',
          link: '/reports/89',
          status: 'success'
        },
        {
          id: '5',
          type: 'analysis_completed',
          title: 'Analysis completed',
          description: 'Hospital Renovation - 47 findings identified',
          timestamp: '3 hours ago',
          link: '/submissions/122',
          status: 'error'
        }
      ]

      setTimeout(() => {
        setActivities(mockActivities)
        setLoading(false)
      }, 600)
    } catch (error) {
      console.error('Failed to fetch recent activity:', error)
      setLoading(false)
    }
  }

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'submission_created':
        return <FileText className="h-4 w-4" />
      case 'analysis_completed':
        return <Clock className="h-4 w-4" />
      case 'finding_reviewed':
        return <CheckCircle2 className="h-4 w-4" />
      case 'report_generated':
        return <FileText className="h-4 w-4" />
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest updates from your projects</CardDescription>
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
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 rounded-lg border p-4 hover:bg-accent/50 transition-colors"
              >
                <div className={`rounded-full p-2 ${getStatusColor(activity.status)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{activity.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {activity.timestamp}
                  </p>
                </div>
                {activity.link && (
                  <Link href={activity.link}>
                    <Button variant="ghost" size="sm">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
        
        {!loading && activities.length > 0 && (
          <div className="mt-4 text-center">
            <Link href="/activity">
              <Button variant="outline" size="sm">
                View All Activity
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
