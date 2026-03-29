'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  HardDrive,
  Plus,
} from 'lucide-react'
import { DashboardStats, TrendsData } from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import { LoadingLink } from '@/components/loading-link'
import { Button } from '@/components/ui/button'
import { triggerLoading } from '@/components/global-loading-spinner'

interface DashboardOverviewProps {
  stats: DashboardStats | null
  trends: TrendsData | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

function TrendBadge({ changePct }: { changePct: number | null }) {
  if (changePct === null) return null
  const abs = Math.abs(changePct)
  if (abs < 0.5) return <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" /> {abs}%</span>
  if (changePct > 0) return <span className="flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400"><TrendingUp className="h-3 w-3" /> {abs}%</span>
  return <span className="flex items-center gap-0.5 text-xs text-destructive"><TrendingDown className="h-3 w-3" /> {abs}%</span>
}

export function DashboardOverview({ stats, trends, loading, error, onRetry }: DashboardOverviewProps) {
  const router = useRouter()

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
        <button onClick={onRetry} className="text-sm text-primary hover:underline">
          Try again
        </button>
      </div>
    )
  }

  // Empty state for new users
  if (stats.projects.total === 0) {
    return (
      <div className="rounded-lg border bg-card p-8">
        <div className="mx-auto max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Zap className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Get started with CADVisor</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Create your first project and upload CAD files to begin compliance analysis.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button size="sm" asChild onClick={() => triggerLoading()}>
              <LoadingLink href="/projects/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </LoadingLink>
            </Button>
            <Button size="sm" variant="outline" asChild onClick={() => triggerLoading()}>
              <LoadingLink href="/submissions/new">
                <FileText className="mr-2 h-4 w-4" />
                New Submission
              </LoadingLink>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const noCritical = stats.findings.critical === 0
  const needAttention = stats.findings.critical + stats.findings.high
  const needReview = stats.findings.medium

  const attentionSub = needAttention > 0
    ? `${needAttention} critical/high need attention`
    : needReview > 0
    ? `${needReview} medium need review`
    : 'No urgent issues'

  const statCards = [
    {
      title: 'Projects',
      value: stats.projects.total,
      sub: `${stats.projects.active} active`,
      icon: FolderOpen,
      link: '/projects',
      trend: trends?.active_projects.change_pct ?? null,
    },
    {
      title: 'Submissions',
      value: stats.submissions.total,
      sub: `${stats.submissions.analyzed} analyzed · ${stats.usage.submissions_this_month} this month`,
      icon: FileText,
      link: '/submissions',
      trend: trends?.submissions.change_pct ?? null,
    },
    {
      title: 'Total Findings',
      value: stats.findings.total,
      sub: attentionSub,
      icon: CheckCircle2,
      link: '/submissions',
      trend: trends?.findings.change_pct ?? null,
    },
    {
      title: 'Critical Issues',
      value: stats.findings.critical,
      sub: noCritical ? 'None — looking good' : `${stats.findings.high} high severity`,
      icon: AlertTriangle,
      link: '/submissions',
      alert: !noCritical,
      trend: null,
    },
  ]

  const usageCards = [
    {
      title: 'Analyses Today',
      value: stats.usage.analyses_today,
      sub: `${stats.submissions.pending} submission${stats.submissions.pending !== 1 ? 's' : ''} pending`,
      icon: Zap,
      link: '/submissions',
    },
    {
      title: 'Storage Used',
      value: `${stats.usage.storage_mb < 1024
        ? `${stats.usage.storage_mb.toFixed(1)} MB`
        : `${(stats.usage.storage_mb / 1024).toFixed(2)} GB`}`,
      sub: `${stats.findings.accepted} findings accepted`,
      icon: HardDrive,
      link: null,
      isText: true,
    },
  ]

  return (
    <div className="space-y-4">
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
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">{card.sub}</p>
                  <TrendBadge changePct={card.trend} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {usageCards.map((card) => {
          const Icon = card.icon
          const inner = (
            <Card
              key={card.title}
              className={card.link ? 'cursor-pointer hover:border-border/80 transition-colors' : ''}
              onClick={card.link ? () => router.push(card.link!) : undefined}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {card.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold text-foreground">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
              </CardContent>
            </Card>
          )
          return inner
        })}
      </div>
    </div>
  )
}
