'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { dashboardApi, HealthResponse, ServiceHealth } from '@/lib/api-client'
import { formatDistanceToNow } from 'date-fns'

const POLL_INTERVAL_MS = 30_000

function statusColor(status: ServiceHealth['status']) {
  switch (status) {
    case 'healthy': return 'bg-green-500'
    case 'degraded': return 'bg-amber-400'
    case 'unavailable': return 'bg-destructive'
  }
}

function statusLabel(status: ServiceHealth['status']) {
  switch (status) {
    case 'healthy': return 'Operational'
    case 'degraded': return 'Degraded'
    case 'unavailable': return 'Unavailable'
  }
}

function statusTextColor(status: ServiceHealth['status']) {
  switch (status) {
    case 'healthy': return 'text-green-600 dark:text-green-400'
    case 'degraded': return 'text-amber-600 dark:text-amber-400'
    case 'unavailable': return 'text-destructive'
  }
}

export function SystemStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  const fetch = useCallback(async () => {
    try {
      const data = await dashboardApi.getHealth()
      setHealth(data)
      setCheckedAt(new Date())
    } catch {
      // Keep last known state on error; don't flash nulls
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const id = setInterval(fetch, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetch])

  // Placeholder services while loading (matches expected list)
  const services: ServiceHealth[] = health?.services ?? [
    { name: 'API Service', status: 'healthy' },
    { name: 'Database', status: 'healthy' },
    { name: 'AI Analysis', status: 'healthy' },
    { name: 'File Storage', status: 'healthy' },
  ]

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">System Status</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground"
            onClick={fetch}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {services.map((svc) => (
          <div key={svc.name} className="flex items-center justify-between py-1" title={svc.message ?? undefined}>
            <div className="flex items-center gap-2">
              <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${loading ? 'bg-muted animate-pulse' : statusColor(svc.status)}`} />
              <span className="text-sm text-muted-foreground">{svc.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {svc.latency_ms != null && !loading && (
                <span className="text-xs text-muted-foreground/60">{svc.latency_ms}ms</span>
              )}
              <span className={`text-xs font-medium ${loading ? 'text-muted-foreground' : statusTextColor(svc.status)}`}>
                {loading ? '…' : statusLabel(svc.status)}
              </span>
            </div>
          </div>
        ))}
        {checkedAt && (
          <p className="text-xs text-muted-foreground/50 pt-1">
            Checked {formatDistanceToNow(checkedAt, { addSuffix: true })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
