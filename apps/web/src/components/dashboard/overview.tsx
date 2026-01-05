'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp,
  Clock,
  Users,
  FolderOpen,
  Database
} from 'lucide-react'
import { dashboardApi, DashboardStats } from '@/lib/api-client'
import { useRouter } from 'next/navigation'

export function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await dashboardApi.getStats()
      setStats(data)
    } catch (error: any) {
      console.error('Failed to fetch dashboard stats:', error)
      setError(error?.response?.data?.detail || 'Failed to load dashboard statistics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">
            {error || 'Failed to load dashboard statistics'}
          </p>
          <button
            onClick={fetchDashboardStats}
            className="text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Total Projects',
      value: stats.projects.total,
      description: `${stats.projects.active} active`,
      icon: FolderOpen,
      trend: stats.projects.active > 0 ? `${Math.round((stats.projects.active / stats.projects.total) * 100)}% active` : 'No active projects',
      link: '/projects'
    },
    {
      title: 'Submissions',
      value: stats.submissions.total,
      description: `${stats.submissions.analyzed} analyzed`,
      icon: FileText,
      trend: `${stats.usage.submissions_this_month} this month`,
      link: '/submissions',
      badge: stats.submissions.pending > 0 ? `${stats.submissions.pending} pending` : undefined
    },
    {
      title: 'Total Findings',
      value: stats.findings.total,
      description: `${stats.findings.accepted} accepted`,
      icon: CheckCircle2,
      trend: `${stats.findings.critical + stats.findings.high} need attention`,
      link: '/submissions'
    },
    {
      title: 'Critical Issues',
      value: stats.findings.critical,
      description: `${stats.findings.high} high severity`,
      icon: AlertTriangle,
      trend: stats.findings.critical > 0 ? 'Requires immediate action' : 'No critical issues',
      alert: stats.findings.critical > 0,
      link: '/submissions'
    },
    {
      title: 'Medium Severity',
      value: stats.findings.medium,
      description: 'Findings to review',
      icon: AlertTriangle,
      trend: `${stats.findings.low} low severity`,
      link: '/submissions'
    },
    {
      title: 'Analyses Today',
      value: stats.usage.analyses_today,
      description: 'AI compliance checks',
      icon: TrendingUp,
      trend: `${stats.submissions.analyzed} total completed`,
      link: '/submissions'
    },
    {
      title: 'This Month',
      value: stats.usage.submissions_this_month,
      description: 'Submissions uploaded',
      icon: Clock,
      trend: 'Monthly activity',
      link: '/submissions'
    },
    {
      title: 'Storage Used',
      value: stats.usage.storage_mb < 1024 
        ? `${stats.usage.storage_mb.toFixed(1)} MB`
        : `${(stats.usage.storage_mb / 1024).toFixed(2)} GB`,
      description: 'Files and reports',
      icon: Database,
      trend: stats.usage.storage_mb < 1024 
        ? 'Under 1 GB'
        : `${((stats.usage.storage_mb / 1024 / 50) * 100).toFixed(1)}% of 50 GB limit`,
      link: '/billing'
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {statCards.map((card, index) => {
        const Icon = card.icon
        const isAlert = card.alert
        const isHighlight = index === 0 || index === 1 // Highlight first two cards
        
        return (
          <Card 
            key={index} 
            className={`relative overflow-hidden transition-all hover:shadow-lg cursor-pointer border-l-4 ${
              isAlert 
                ? 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30' 
                : isHighlight
                ? 'border-l-primary bg-primary/5 hover:bg-primary/10'
                : 'border-l-transparent hover:border-l-primary/50'
            }`}
            onClick={() => card.link && router.push(card.link)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${
                isAlert 
                  ? 'bg-red-100 dark:bg-red-900/30' 
                  : isHighlight
                  ? 'bg-primary/10'
                  : 'bg-muted'
              }`}>
                <Icon className={`h-4 w-4 ${
                  isAlert 
                    ? 'text-red-600 dark:text-red-400' 
                    : isHighlight
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                isAlert 
                  ? 'text-red-600 dark:text-red-400' 
                  : isHighlight
                  ? 'text-primary'
                  : ''
              }`}>
                {card.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
              {card.badge && (
                <div className="mt-2">
                  <span className="inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-900/50 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800">
                    {card.badge}
                  </span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2 opacity-70 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {card.trend}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
