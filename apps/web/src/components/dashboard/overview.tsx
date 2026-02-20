'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp,
  FolderOpen,
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-lg" />
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

const noCritical = stats.findings.critical === 0

  const statCards = [
    {
      title: 'Projects',
      value: stats.projects.total,
      description: `${stats.projects.active} active`,
      badge: undefined as string | undefined,
      trend: stats.projects.active > 0
        ? `${Math.round((stats.projects.active / Math.max(stats.projects.total, 1)) * 100)}% active`
        : 'No active projects',
      icon: FolderOpen,
      gradient: 'from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20',
      border: 'border-blue-200/60 dark:border-blue-900/40',
      circle: 'bg-blue-500/10',
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-600 dark:text-blue-400',
      valueColor: 'text-blue-700 dark:text-blue-300',
      link: '/projects',
    },
    {
      title: 'Submissions',
      value: stats.submissions.total,
      description: `${stats.submissions.analyzed} analyzed`,
      badge: stats.submissions.pending > 0 ? `${stats.submissions.pending} pending` : undefined,
      trend: `${stats.usage.submissions_this_month} this month`,
      icon: FileText,
      gradient: 'from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20',
      border: 'border-purple-200/60 dark:border-purple-900/40',
      circle: 'bg-purple-500/10',
      iconBg: 'bg-purple-500/15',
      iconColor: 'text-purple-600 dark:text-purple-400',
      valueColor: 'text-purple-700 dark:text-purple-300',
      link: '/submissions',
    },
    {
      title: 'Total Findings',
      value: stats.findings.total,
      description: `${stats.findings.accepted} accepted`,
      badge: undefined as string | undefined,
      trend: `${stats.findings.critical + stats.findings.high} need attention`,
      icon: CheckCircle2,
      gradient: 'from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20',
      border: 'border-amber-200/60 dark:border-amber-900/40',
      circle: 'bg-amber-500/10',
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-600 dark:text-amber-400',
      valueColor: 'text-amber-700 dark:text-amber-300',
      link: '/submissions',
    },
    {
      title: 'Critical Issues',
      value: stats.findings.critical,
      description: `${stats.findings.high} high severity`,
      badge: undefined as string | undefined,
      trend: noCritical ? 'No critical issues' : 'Requires immediate action',
      icon: AlertTriangle,
      gradient: noCritical
        ? 'from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20'
        : 'from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20',
      border: noCritical
        ? 'border-emerald-200/60 dark:border-emerald-900/40'
        : 'border-red-200/60 dark:border-red-900/40',
      circle: noCritical ? 'bg-emerald-500/10' : 'bg-red-500/10',
      iconBg: noCritical ? 'bg-emerald-500/15' : 'bg-red-500/15',
      iconColor: noCritical ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
      valueColor: noCritical ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300',
      link: '/submissions',
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((card, index) => {
        const Icon = card.icon
        return (
          <Card
            key={index}
            className={`relative overflow-hidden bg-gradient-to-br ${card.gradient} border ${card.border} hover:shadow-lg transition-all cursor-pointer`}
            onClick={() => router.push(card.link)}
          >
            <div className={`absolute top-0 right-0 w-24 h-24 ${card.circle} rounded-full -mr-12 -mt-12 pointer-events-none`} />
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <div className={`p-2 rounded-lg ${card.iconBg} shrink-0`}>
                <Icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className={`text-3xl font-bold ${card.valueColor}`}>{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
              {card.badge && (
                <Badge className="mt-2 bg-primary/10 text-primary hover:bg-primary/20 text-xs border-0">{card.badge}</Badge>
              )}
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 shrink-0" />
                {card.trend}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
