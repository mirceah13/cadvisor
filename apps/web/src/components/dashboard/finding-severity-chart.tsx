'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, CheckCircle2, AlertCircle, Info } from 'lucide-react'

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
        <CardHeader>
          <CardTitle>Finding Distribution</CardTitle>
          <CardDescription>No findings to display</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
            <p>No findings detected</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const criticalPercent = (critical / total) * 100
  const highPercent = (high / total) * 100
  const mediumPercent = (medium / total) * 100
  const lowPercent = (low / total) * 100

  const severityData = [
    {
      label: 'Critical',
      value: critical,
      percent: criticalPercent,
      color: 'bg-red-500',
      textColor: 'text-red-600 dark:text-red-400',
      icon: AlertTriangle,
      bgLight: 'bg-red-100 dark:bg-red-950'
    },
    {
      label: 'High',
      value: high,
      percent: highPercent,
      color: 'bg-orange-500',
      textColor: 'text-orange-600 dark:text-orange-400',
      icon: AlertCircle,
      bgLight: 'bg-orange-100 dark:bg-orange-950'
    },
    {
      label: 'Medium',
      value: medium,
      percent: mediumPercent,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600 dark:text-yellow-400',
      icon: AlertCircle,
      bgLight: 'bg-yellow-100 dark:bg-yellow-950'
    },
    {
      label: 'Low',
      value: low,
      percent: lowPercent,
      color: 'bg-blue-500',
      textColor: 'text-blue-600 dark:text-blue-400',
      icon: Info,
      bgLight: 'bg-blue-100 dark:bg-blue-950'
    }
  ]

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <AlertTriangle className="h-4 w-4 text-primary" />
          </div>
          Finding Distribution
        </CardTitle>
        <CardDescription>Breakdown by severity level</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar visualization */}
        <div className="relative h-10 w-full rounded-lg overflow-hidden bg-muted flex shadow-inner">
          {criticalPercent > 0 && (
            <div
              className="bg-gradient-to-r from-red-500 to-red-600 h-full transition-all hover:opacity-90"
              style={{ width: `${criticalPercent}%` }}
              title={`Critical: ${critical} (${criticalPercent.toFixed(1)}%)`}
            />
          )}
          {highPercent > 0 && (
            <div
              className="bg-gradient-to-r from-orange-500 to-orange-600 h-full transition-all hover:opacity-90"
              style={{ width: `${highPercent}%` }}
              title={`High: ${high} (${highPercent.toFixed(1)}%)`}
            />
          )}
          {mediumPercent > 0 && (
            <div
              className="bg-gradient-to-r from-yellow-500 to-yellow-600 h-full transition-all hover:opacity-90"
              style={{ width: `${mediumPercent}%` }}
              title={`Medium: ${medium} (${mediumPercent.toFixed(1)}%)`}
            />
          )}
          {lowPercent > 0 && (
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all hover:opacity-90"
              style={{ width: `${lowPercent}%` }}
              title={`Low: ${low} (${lowPercent.toFixed(1)}%)`}
            />
          )}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-3">
          {severityData.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className={`flex items-center gap-3 p-3 rounded-lg ${item.bgLight} border transition-all hover:shadow-md cursor-pointer ${
                  item.label === 'Critical' ? 'border-red-200 dark:border-red-900' :
                  item.label === 'High' ? 'border-orange-200 dark:border-orange-900' :
                  item.label === 'Medium' ? 'border-yellow-200 dark:border-yellow-900' :
                  'border-blue-200 dark:border-blue-900'
                }`}
              >
                <div className={`rounded-lg p-2 ${item.color} shadow-sm`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  <p className={`text-lg font-bold ${item.textColor}`}>
                    {item.value}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.percent.toFixed(1)}%
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Total */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5">
            <span className="text-sm font-semibold">Total Findings</span>
            <span className="text-2xl font-bold text-primary">{total}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
