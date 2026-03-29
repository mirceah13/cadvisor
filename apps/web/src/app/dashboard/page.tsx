'use client'

import { DashboardOverview } from '@/components/dashboard/overview'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { FindingSeverityChart } from '@/components/dashboard/finding-severity-chart'
import { SubmissionTrendChart } from '@/components/dashboard/submission-trend-chart'
import { SystemStatus } from '@/components/dashboard/system-status'
import { DashboardNav } from '@/components/dashboard-nav'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Plus, Upload, BarChart3, FolderPlus, Database } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingLink } from '@/components/loading-link'
import { triggerLoading } from '@/components/global-loading-spinner'
import { useEffect, useState, useCallback, useRef, Component, ReactNode } from 'react'
import { dashboardApi, DashboardStats, TrendsData } from '@/lib/api-client'

// ── Simple error boundary ────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
          Something went wrong loading this section.
        </div>
      )
    }
    return this.props.children
  }
}

// ── Date range options ────────────────────────────────────────
type Range = 7 | 30 | 90
const RANGES: { label: string; value: Range }[] = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
]

const STATS_POLL_MS = 30_000

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [trends, setTrends] = useState<TrendsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<Range>(30)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      setError(null)
      const [statsData, trendsData] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getTrends(range),
      ])
      setStats(statsData)
      setTrends(trendsData)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load dashboard statistics')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    setLoading(true)
    fetchAll()

    // Auto-refresh stats every 30 s
    intervalRef.current = setInterval(fetchAll, STATS_POLL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchAll])

  return (
    <>
      <DashboardNav />
      <div className="flex-1 space-y-8 p-8 pt-6 container max-w-7xl">
        <PageHeader
          title="Dashboard"
          description="CAD compliance analysis for your architectural projects"
          actions={
            <>
              {/* Date range selector */}
              <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-1">
                {RANGES.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setRange(value)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      range === value
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" asChild onClick={() => triggerLoading()}>
                <LoadingLink href="/projects">
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Projects
                </LoadingLink>
              </Button>
              <Button size="sm" asChild onClick={() => triggerLoading()}>
                <LoadingLink href="/submissions/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Submission
                </LoadingLink>
              </Button>
            </>
          }
        />

        <ErrorBoundary>
          <DashboardOverview
            stats={stats}
            trends={trends}
            loading={loading}
            error={error}
            onRetry={fetchAll}
          />
        </ErrorBoundary>

        <div className="grid gap-6 lg:grid-cols-7 items-start">
          <div className="lg:col-span-4">
            <ErrorBoundary>
              <RecentActivity />
            </ErrorBoundary>
          </div>
          <div className="lg:col-span-3 space-y-6">
            <ErrorBoundary>
              {stats && (
                <FindingSeverityChart
                  critical={stats.findings.critical}
                  high={stats.findings.high}
                  medium={stats.findings.medium}
                  low={stats.findings.low}
                />
              )}
            </ErrorBoundary>

            <ErrorBoundary>
              <SubmissionTrendChart days={range} />
            </ErrorBoundary>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-0">
                {[
                  { href: '/submissions/new', icon: Upload, label: 'New Submission', desc: 'Upload CAD files for analysis' },
                  { href: '/knowledge-base/upload', icon: Database, label: 'Add to Knowledge Base', desc: 'Upload building codes' },
                  { href: '/projects', icon: FolderPlus, label: 'Manage Projects', desc: 'View and organize projects' },
                  { href: '/reports', icon: BarChart3, label: 'View Reports', desc: 'Compliance reports and analytics' },
                ].map(({ href, icon: Icon, label, desc }) => (
                  <Button
                    key={href}
                    variant="ghost"
                    className="w-full justify-start h-auto py-2.5 px-3 hover:bg-muted"
                    asChild
                    onClick={() => triggerLoading()}
                  >
                    <LoadingLink href={href}>
                      <Icon className="h-4 w-4 mr-3 text-muted-foreground shrink-0" />
                      <div className="text-left">
                        <div className="text-sm font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground">{desc}</div>
                      </div>
                    </LoadingLink>
                  </Button>
                ))}
              </CardContent>
            </Card>

            <ErrorBoundary>
              <SystemStatus />
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </>
  )
}
