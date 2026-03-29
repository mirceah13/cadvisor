'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'

interface FindingSeverityChartProps {
  critical: number
  high: number
  medium: number
  low: number
}

export function FindingSeverityChart({ critical, high, medium, low }: FindingSeverityChartProps) {
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
    { label: 'Critical', value: critical, bar: 'bg-red-500',    dot: 'bg-red-500',    text: 'text-red-600 dark:text-red-400' },
    { label: 'High',     value: high,     bar: 'bg-orange-400', dot: 'bg-orange-400', text: 'text-orange-600 dark:text-orange-400' },
    { label: 'Medium',   value: medium,   bar: 'bg-amber-400',  dot: 'bg-amber-400',  text: 'text-amber-600 dark:text-amber-400' },
    { label: 'Low',      value: low,      bar: 'bg-slate-400',  dot: 'bg-slate-400',  text: 'text-slate-600 dark:text-slate-400' },
  ]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Finding Distribution</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Segmented bar */}
        <div className="h-2 w-full rounded-full overflow-hidden bg-muted flex gap-px">
          {severities.map(({ label, value, bar }) =>
            value > 0 ? (
              <div
                key={label}
                className={`${bar} h-full`}
                style={{ width: `${pct(value)}%` }}
                title={`${label}: ${value}`}
              />
            ) : null
          )}
        </div>

        {/* Legend rows */}
        <div className="space-y-2">
          {severities.map(({ label, value, dot, text }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${dot}`} />
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${text}`}>{value}</span>
                <span className="text-xs text-muted-foreground w-10 text-right">{pct(value).toFixed(0)}%</span>
              </div>
            </div>
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