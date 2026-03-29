'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { dashboardApi, SubmissionTrendData } from '@/lib/api-client'
import { format, parseISO } from 'date-fns'

interface SubmissionTrendChartProps {
  days: number
}

export function SubmissionTrendChart({ days }: SubmissionTrendChartProps) {
  const [data, setData] = useState<SubmissionTrendData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      setLoading(true)
      const result = await dashboardApi.getSubmissionTrend(days)
      setData(result)
    } catch {
      // fail silently; chart just won't render
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { fetch() }, [fetch])

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[140px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.data.every(d => d.count === 0)) return null

  // Show only every N-th label to avoid crowding
  const labelStep = days <= 14 ? 1 : days <= 30 ? 3 : 7

  const chartData = data.data.map((d, i) => ({
    ...d,
    label: i % labelStep === 0 ? format(parseISO(d.date), days <= 14 ? 'MMM d' : 'MMM d') : '',
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Submission Activity</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData} barCategoryGap="30%">
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide allowDecimals={false} />
            <Tooltip
              formatter={(value) => [value ?? 0, 'Submissions'] as [number, string]}
              labelFormatter={(label: string) => label}
              contentStyle={{
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
              }}
              cursor={{ fill: 'hsl(var(--muted))' }}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.count > 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted))'}
                  fillOpacity={entry.count > 0 ? 0.85 : 0.3}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
