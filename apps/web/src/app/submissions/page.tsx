'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DashboardNav } from '@/components/dashboard-nav'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Upload, FileText, AlertCircle } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api-client'
import { formatDistanceToNow } from 'date-fns'

interface Submission {
  id: number
  name: string
  status: string
  created_at: string
  project?: {
    id: number
    name: string
  }
  findings_summary?: {
    total: number
    critical: number
  }
}

export default function SubmissionsPage() {
  const { accessToken } = useAuth()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!accessToken) return

      try {
        const response = await apiClient.get('/submissions', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        setSubmissions(response.data)
      } catch (error) {
        console.error('Failed to fetch submissions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSubmissions()
  }, [accessToken])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'pending_review':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  return (
    <>
      <DashboardNav />
      <div className="flex-1 space-y-8 p-8 pt-6 container">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Submissions</h2>
            <p className="text-muted-foreground">
              Track and manage your CAD file submissions for compliance analysis
            </p>
          </div>
          <Button asChild>
            <Link href="/submissions/new">
              <Plus className="mr-2 h-4 w-4" />
              New Submission
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </Card>
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No submissions yet</h3>
              <p className="text-muted-foreground mb-4">
                Upload your first CAD file for compliance analysis
              </p>
              <Button asChild>
                <Link href="/submissions/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Submission
                </Link>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <Link key={submission.id} href={`/submissions/${submission.id}`}>
                <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold text-lg">{submission.name}</h3>
                        <Badge className={getStatusColor(submission.status)}>
                          {submission.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      {submission.project && (
                        <p className="text-sm text-muted-foreground mt-1 ml-8">
                          Project: {submission.project.name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 ml-8">
                        Submitted{' '}
                        {formatDistanceToNow(new Date(submission.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    {submission.findings_summary && (
                      <div className="flex gap-4 text-sm">
                        <div className="text-center">
                          <div className="font-semibold">{submission.findings_summary.total}</div>
                          <div className="text-muted-foreground text-xs">Findings</div>
                        </div>
                        {submission.findings_summary.critical > 0 && (
                          <div className="text-center flex items-center gap-1 text-red-600">
                            <AlertCircle className="h-4 w-4" />
                            <div className="font-semibold">
                              {submission.findings_summary.critical}
                            </div>
                            <div className="text-xs">Critical</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
