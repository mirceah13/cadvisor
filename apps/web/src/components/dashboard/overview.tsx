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
  FolderOpen
} from 'lucide-react'

interface DashboardStats {
  projects: {
    total: number
    active: number
  }
  submissions: {
    total: number
    pending: number
    analyzed: number
  }
  findings: {
    total: number
    critical: number
    high: number
    verified: number
  }
  usage: {
    submissions_this_month: number
    analyses_today: number
    storage_gb: number
  }
}

export function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      // TODO: Replace with actual API calls
      // const response = await fetch('/api/v1/dashboard/stats')
      // const data = await response.json()
      
      // Mock data for now
      const mockStats: DashboardStats = {
        projects: { total: 12, active: 5 },
        submissions: { total: 48, pending: 3, analyzed: 45 },
        findings: { total: 287, critical: 12, high: 45, verified: 198 },
        usage: { submissions_this_month: 8, analyses_today: 2, storage_gb: 15.3 }
      }
      
      setTimeout(() => {
        setStats(mockStats)
        setLoading(false)
      }, 800)
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Failed to load dashboard stats</p>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Total Projects',
      value: stats.projects.total,
      description: `${stats.projects.active} active`,
      icon: FolderOpen,
      trend: '+2 this month'
    },
    {
      title: 'Submissions',
      value: stats.submissions.total,
      description: `${stats.submissions.pending} pending analysis`,
      icon: FileText,
      trend: `${stats.usage.submissions_this_month} this month`
    },
    {
      title: 'Total Findings',
      value: stats.findings.total,
      description: `${stats.findings.verified} verified`,
      icon: CheckCircle2,
      trend: `${stats.findings.critical + stats.findings.high} need attention`
    },
    {
      title: 'Critical Issues',
      value: stats.findings.critical,
      description: `${stats.findings.high} high severity`,
      icon: AlertTriangle,
      trend: 'Requires immediate action',
      alert: stats.findings.critical > 0
    },
    {
      title: 'Analyses Today',
      value: stats.usage.analyses_today,
      description: 'AI compliance checks',
      icon: TrendingUp,
      trend: `${stats.submissions.analyzed} total completed`
    },
    {
      title: 'Storage Used',
      value: `${stats.usage.storage_gb.toFixed(1)} GB`,
      description: 'Files and reports',
      icon: Clock,
      trend: '50 GB limit'
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {statCards.map((card, index) => {
        const Icon = card.icon
        return (
          <Card key={index} className={card.alert ? 'border-red-200 dark:border-red-900' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${card.alert ? 'text-red-500' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${card.alert ? 'text-red-600 dark:text-red-400' : ''}`}>
                {card.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
              <p className="text-xs text-muted-foreground mt-2 opacity-70">
                {card.trend}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
