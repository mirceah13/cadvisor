import { DashboardOverview } from '@/components/dashboard/overview'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Overview of your projects and compliance analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/projects/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      <DashboardOverview />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4">
          <RecentActivity />
        </div>
        <div className="col-span-3">
          {/* Placeholder for usage widget or quick actions */}
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold mb-2">Quick Actions</h3>
            <div className="space-y-2">
              <Link href="/submissions/upload" className="block">
                <Button variant="outline" className="w-full justify-start">
                  Upload Submission
                </Button>
              </Link>
              <Link href="/kb/upload" className="block">
                <Button variant="outline" className="w-full justify-start">
                  Add Knowledge Base Document
                </Button>
              </Link>
              <Link href="/reports" className="block">
                <Button variant="outline" className="w-full justify-start">
                  Generate Report
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
