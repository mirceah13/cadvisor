'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { triggerLoading } from '@/components/global-loading-spinner'

interface FindingSeverityChartProps {
  critical: number
  high: number
  medium: number
  low: number
}

export function FindingSeverityChart({ critical, high, medium, low }: FindingSeverityChartProps) {
  const router = useRouter()
  const total = critical + high + medium + low

  if (total === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Finding Distribution</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-center py-6">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
          <p className="text-sm text-muted-foreground">No findings detected</p>
        </CardContent>
      </Card>
    )
  }

  const pct = (n: number) => (n / total) * 100

  const severities = [
    { label: 'Critical', key: 'critical', value: critical, bar: 'bg-red-500',    dot: 'bg-red-500',    text: 'text-red-600 dark:text-red-400' },
    { label: 'High',     key: 'high',     value: high,     bar: 'bg-orange-400', dot: 'bg-orange-400', text: 'text-orange-600 dark:text-orange-400' },
    { label: 'Medium',   key: 'medium',   value: medium,   bar: 'bg-amber-400',  dot: 'bg-amber-400',  text: 'text-amber-600 dark:text-amber-400' },
    { label: 'Low',      key: 'low',      value: low,      bar: 'bg-slate-400',  dot: 'bg-slate-400',  text: 'text-slate-600 dark:text-slate-400' },
  ]

  const navigate = (severity: string) => {
    triggerLoading()
    router.push(`/submissions?severity=${severity}`)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Finding Distribution</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Segmented bar — clicking a segment navigates to filtered view */}
        <div className="h-2 w-full rounded-full overflow-hidden bg-muted flex gap-px">
          {severities.map(({ label, key, value, bar }) =>
            value > 0 ? (
              <button
                key={label}
                className={`${bar} h-full cursor-pointer hover:opacity-80 transition-opacity`}
                style={{ width: `${pct(value)}%` }}
                title={`${label}: ${value} — click to filter`}
                onClick={() => navigate(key)}
              />
            ) : null
          )}
        </div>

        {/* Legend rows — each row is clickable */}
        <div className="space-y-1">
          {severities.map(({ label, key, value, dot, text }) => (
            <button
              key={label}
              className="w-full flex items-center justify-between rounded-md px-1 py-1 hover:bg-muted transition-colors disabled:pointer-events-none"
              onClick={() => navigate(key)}
              disabled={value === 0}
            >
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${dot}`} />
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${text}`}>{value}</span>
                <span className="text-xs text-muted-foreground w-10 text-right">{pct(value).toFixed(0)}%</span>
              </div>
            </button>
          ))}
        </div>

        <div className="pt-2 border-t flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total findings</span>
          <span className="text-sm font-semibold">{total}</span>
        </div>
      </CardContent>
    </Card>
  )
}
