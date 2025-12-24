'use client'

import { useEffect, useState } from 'react'
import { DashboardNav } from '@/components/dashboard-nav'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api-client'
import { CreditCard, Calendar, TrendingUp, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'

interface Subscription {
  id: number
  plan: string
  status: string
  trial_ends_at: string | null
  current_period_start: string
  current_period_end: string
  limits: {
    projects: number
    submissions_per_month: number
    storage_gb: number
  }
}

interface Usage {
  projects_used: number
  submissions_this_month: number
  storage_used_gb: number
}

export default function BillingPage() {
  const { accessToken } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBillingInfo = async () => {
      if (!accessToken) return

      try {
        const [subRes, usageRes] = await Promise.all([
          apiClient.get('/billing/subscription', {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          apiClient.get('/billing/usage', {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ])
        setSubscription(subRes.data)
        setUsage(usageRes.data)
      } catch (error) {
        console.error('Failed to fetch billing info:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBillingInfo()
  }, [accessToken])

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'professional':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'enterprise':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'trial':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.min((used / limit) * 100, 100)
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  if (loading) {
    return (
      <>
        <DashboardNav />
        <div className="flex-1 p-8 pt-6 container">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <DashboardNav />
      <div className="flex-1 space-y-8 p-8 pt-6 container max-w-4xl">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Billing & Subscription</h2>
          <p className="text-muted-foreground">
            Manage your subscription and monitor usage
          </p>
        </div>

        {/* Current Plan */}
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-semibold">Current Plan</h3>
                <Badge className={getPlanColor(subscription?.plan || 'trial')}>
                  {subscription?.plan?.toUpperCase()}
                </Badge>
                {subscription?.status === 'active' && (
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Active
                  </Badge>
                )}
              </div>
              {subscription?.trial_ends_at && (
                <p className="text-sm text-muted-foreground">
                  Trial ends on {format(new Date(subscription.trial_ends_at), 'PPP')}
                </p>
              )}
              {subscription?.current_period_end && (
                <p className="text-sm text-muted-foreground">
                  <Calendar className="inline h-3 w-3 mr-1" />
                  Renews on {format(new Date(subscription.current_period_end), 'PPP')}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Change Plan</Button>
              <Button>
                <CreditCard className="mr-2 h-4 w-4" />
                Update Payment Method
              </Button>
            </div>
          </div>
        </Card>

        {/* Usage */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Usage This Month</h3>
          
          <Card className="p-6">
            <div className="space-y-6">
              {/* Projects */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Projects</span>
                  <span className="text-sm text-muted-foreground">
                    {usage?.projects_used || 0} / {subscription?.limits?.projects || 0}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getUsageColor(
                      getUsagePercentage(
                        usage?.projects_used || 0,
                        subscription?.limits?.projects || 1
                      )
                    )}`}
                    style={{
                      width: `${getUsagePercentage(
                        usage?.projects_used || 0,
                        subscription?.limits?.projects || 1
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Submissions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Submissions</span>
                  <span className="text-sm text-muted-foreground">
                    {usage?.submissions_this_month || 0} /{' '}
                    {subscription?.limits?.submissions_per_month || 0}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getUsageColor(
                      getUsagePercentage(
                        usage?.submissions_this_month || 0,
                        subscription?.limits?.submissions_per_month || 1
                      )
                    )}`}
                    style={{
                      width: `${getUsagePercentage(
                        usage?.submissions_this_month || 0,
                        subscription?.limits?.submissions_per_month || 1
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Storage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Storage</span>
                  <span className="text-sm text-muted-foreground">
                    {usage?.storage_used_gb?.toFixed(2) || 0} GB /{' '}
                    {subscription?.limits?.storage_gb || 0} GB
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getUsageColor(
                      getUsagePercentage(
                        usage?.storage_used_gb || 0,
                        subscription?.limits?.storage_gb || 1
                      )
                    )}`}
                    style={{
                      width: `${getUsagePercentage(
                        usage?.storage_used_gb || 0,
                        subscription?.limits?.storage_gb || 1
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Billing History */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Billing History</h3>
          <Card className="p-6">
            <p className="text-muted-foreground text-center py-8">
              No billing history available yet
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}
