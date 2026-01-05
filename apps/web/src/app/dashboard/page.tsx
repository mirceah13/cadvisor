'use client'

import { DashboardOverview } from '@/components/dashboard/overview'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { FindingSeverityChart } from '@/components/dashboard/finding-severity-chart'
import { DashboardNav } from '@/components/dashboard-nav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Upload, FileText, BarChart3, FolderPlus, Database } from 'lucide-react'
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
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-8 text-primary-foreground shadow-2xl">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000,transparent)]" />
          <div className="relative flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-primary-foreground/90 text-lg max-w-2xl">
                AI-powered CAD compliance analysis for your architectural projects
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="lg" asChild className="shadow-lg hover:shadow-xl transition-all" onClick={() => triggerLoading()}>
                <LoadingLink href="/projects">
                  <FolderPlus className="mr-2 h-5 w-5" />
                  View Projects
                </LoadingLink>
              </Button>
              <Button variant="secondary" size="lg" asChild className="shadow-lg hover:shadow-xl transition-all" onClick={() => triggerLoading()}>
                <LoadingLink href="/submissions/new">
                  <Plus className="mr-2 h-5 w-5" />
                  New Submission
                </LoadingLink>
              </Button>
            </div>
          </div>
        </div>

        <DashboardOverview />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <div className="col-span-4">
            <RecentActivity />
          </div>
          <div className="col-span-3 space-y-6">
            {/* Finding Severity Chart */}
            {stats && (
              <FindingSeverityChart
                critical={stats.findings.critical}
                high={stats.findings.high}
                medium={stats.findings.medium}
                low={stats.findings.low}
              />
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Common tasks and shortcuts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start h-auto py-3 hover:bg-primary/5 hover:border-primary/40 transition-all group" asChild onClick={() => triggerLoading()}>
                  <LoadingLink href="/submissions/new">
                    <div className="flex items-start gap-3 text-left">
                      <Upload className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary group-hover:scale-110 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium group-hover:text-primary transition-colors">Upload Submission</div>
                        <div className="text-xs text-muted-foreground">
                          Upload CAD files for compliance analysis
                        </div>
                      </div>
                    </div>
                  </LoadingLink>
                </Button>
                <Button variant="outline" className="w-full justify-start h-auto py-3 hover:bg-primary/5 hover:border-primary/40 transition-all group" asChild onClick={() => triggerLoading()}>
                  <LoadingLink href="/knowledge-base/upload">
                    <div className="flex items-start gap-3 text-left">
                      <Database className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary group-hover:scale-110 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium group-hover:text-primary transition-colors">Add Knowledge Base Document</div>
                        <div className="text-xs text-muted-foreground">
                          Upload building codes and regulations
                        </div>
                      </div>
                    </div>
                  </LoadingLink>
                </Button>
                <Button variant="outline" className="w-full justify-start h-auto py-3 hover:bg-primary/5 hover:border-primary/40 transition-all group" asChild onClick={() => triggerLoading()}>
                  <LoadingLink href="/projects">
                    <div className="flex items-start gap-3 text-left">
                      <FolderPlus className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary group-hover:scale-110 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium group-hover:text-primary transition-colors">Manage Projects</div>
                        <div className="text-xs text-muted-foreground">
                          View and organize your projects
                        </div>
                      </div>
                    </div>
                  </LoadingLink>
                </Button>
                <Button variant="outline" className="w-full justify-start h-auto py-3 hover:bg-primary/5 hover:border-primary/40 transition-all group" asChild onClick={() => triggerLoading()}>
                  <LoadingLink href="/reports">
                    <div className="flex items-start gap-3 text-left">
                      <BarChart3 className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary group-hover:scale-110 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium group-hover:text-primary transition-colors">View Reports</div>
                        <div className="text-xs text-muted-foreground">
                          Access compliance reports and analytics
                        </div>
                      </div>
                    </div>
                  </LoadingLink>
                </Button>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>Current system health</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-medium">API Service</span>
                  </div>
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">Operational</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-medium">AI Analysis</span>
                  </div>
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">Operational</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-medium">File Storage</span>
                  </div>
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">Operational</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
