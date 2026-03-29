'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
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
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="rounded-md border bg-card p-6 text-center py-8">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-3">
          {error || 'Failed to load dashboard statistics'}
        </p>
        <button onClick={fetchDashboardStats} className="text-sm text-primary hover:underline">
          Try again
        </button>
      </div>
    )
  }

  const noCritical = stats.findings.critical === 0

  const statCards = [
    {
      title: 'Projects',
      value: stats.projects.total,
      sub: `${stats.projects.active} active`,
      icon: FolderOpen,
      link: '/projects',
    },
    {
      title: 'Submissions',
      value: stats.submissions.total,
      sub: `${stats.submissions.analyzed} analyzed · ${stats.usage.submissions_this_month} this month`,
      icon: FileText,
      link: '/submissions',
    },
    {
      title: 'Total Findings',
      value: stats.findings.total,
      sub: `${stats.findings.critical + stats.findings.high + stats.findings.medium} need attention`,
      icon: CheckCircle2,
      link: '/submissions',
    },
    {
      title: 'Critical Issues',
      value: stats.findings.critical,
      sub: noCritical ? 'None — looking good' : `${stats.findings.high} high severity`,
      icon: AlertTriangle,
      link: '/submissions',
      alert: !noCritical,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((card) => {
        const Icon = card.icon
        return (
          <Card
            key={card.title}
            className="cursor-pointer hover:border-border/80 transition-colors"
            onClick={() => router.push(card.link)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {card.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${card.alert ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-semibold ${card.alert ? 'text-destructive' : 'text-foreground'}`}>
                {card.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
