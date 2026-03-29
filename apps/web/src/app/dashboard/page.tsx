'use client'

import { DashboardOverview } from '@/components/dashboard/overview'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { FindingSeverityChart } from '@/components/dashboard/finding-severity-chart'
import { DashboardNav } from '@/components/dashboard-nav'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Upload, BarChart3, FolderPlus, Database } from 'lucide-react'
import { LoadingLink } from '@/components/loading-link'
import { triggerLoading } from '@/components/global-loading-spinner'
import { useEffect, useState } from 'react'
import { dashboardApi, DashboardStats } from '@/lib/api-client'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await dashboardApi.getStats()
        setStats(data)
      } catch (error) {
        console.error('Failed to fetch stats for chart:', error)
      }
    }
    fetchStats()
  }, [])

  return (
    <>
      <DashboardNav />
      <div className="flex-1 space-y-8 p-8 pt-6 container max-w-7xl">
        <PageHeader
          title="Dashboard"
          description="CAD compliance analysis for your architectural projects"
          actions={
            <>
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

        <DashboardOverview />

        <div className="grid gap-6 lg:grid-cols-7 items-start">
          <div className="lg:col-span-4">
            <RecentActivity />
          </div>
          <div className="lg:col-span-3 space-y-6">
            {stats && (stats.findings.critical + stats.findings.high + stats.findings.medium + stats.findings.low) > 0 && (
              <FindingSeverityChart
                critical={stats.findings.critical}
                high={stats.findings.high}
                medium={stats.findings.medium}
                low={stats.findings.low}
              />
            )}

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

            {/* System Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {['API Service', 'AI Analysis', 'File Storage'].map((service) => (
                  <div key={service} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      <span className="text-sm text-muted-foreground">{service}</span>
                    </div>
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">Operational</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
