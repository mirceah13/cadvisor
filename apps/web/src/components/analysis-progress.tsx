'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface AnalysisProgressProps {
  runId: string
  onComplete?: () => void
  onError?: () => void
}

interface ProgressData {
  status: string
  progress: number
  current_step?: string
  checks_completed: number
  total_checks: number
}

const CHECK_NAMES: Record<string, string> = {
  fire_safety: 'Fire Safety',
  accessibility: 'Accessibility',
  structural: 'Structural',
  general_compliance: 'General Compliance',
  commercial_code: 'Commercial Code',
  energy_efficiency: 'Energy Efficiency',
  hvac: 'HVAC',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  building_envelope: 'Building Envelope'
}

export function AnalysisProgress({ runId, onComplete, onError }: AnalysisProgressProps) {
  const { accessToken } = useAuth()
  const [progressData, setProgressData] = useState<ProgressData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isPollingRef = useRef(true)
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)

  // Update refs when callbacks change without triggering re-render
  useEffect(() => {
    onCompleteRef.current = onComplete
    onErrorRef.current = onError
  }, [onComplete, onError])

  useEffect(() => {
    const fetchProgress = async () => {
      if (!accessToken) return

      try {
        const response: any = await apiClient.get(
          `/analysis/runs/${runId}/progress`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        
        const data = response.data || response
        
        // Only update state if data has actually changed
        setProgressData((prev) => {
          if (!prev) return data
          
          const hasChanged = 
            prev.status !== data.status || 
            prev.progress !== data.progress || 
            prev.current_step !== data.current_step ||
            prev.checks_completed !== data.checks_completed ||
            prev.total_checks !== data.total_checks
          
          return hasChanged ? data : prev
        })

        // Stop polling if analysis is complete or failed
        if (data.status === 'completed') {
          isPollingRef.current = false
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          onCompleteRef.current?.()
        } else if (data.status === 'failed') {
          isPollingRef.current = false
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          setError('Analysis failed')
          onErrorRef.current?.()
        }
      } catch (err) {
        console.error('Failed to fetch progress:', err)
        setError('Failed to fetch progress')
        isPollingRef.current = false
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    }

    // Initial fetch
    fetchProgress()

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      if (isPollingRef.current) {
        fetchProgress()
      }
    }, 2000)

    return () => {
      isPollingRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [runId, accessToken])

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">{error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!progressData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading progress...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const currentStepName = progressData.current_step 
    ? CHECK_NAMES[progressData.current_step] || progressData.current_step
    : 'Initializing...'

  return (
    <Card className="border-blue-300 bg-gradient-to-br from-blue-50 to-blue-100/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">Analysis in Progress</CardTitle>
          <Badge variant={progressData.status === 'running' ? 'default' : 'secondary'} className="font-medium">
            {progressData.status === 'running' ? (
              <>
                <Clock className="h-3 w-3 mr-1 animate-pulse" />
                Running
              </>
            ) : progressData.status === 'completed' ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Complete
              </>
            ) : (
              progressData.status
            )}
          </Badge>
        </div>
        <CardDescription className="text-gray-700 font-medium mt-2">
          {progressData.status === 'running' ? (
            <>
              Running compliance checks - {progressData.checks_completed} of {progressData.total_checks} completed
            </>
          ) : progressData.status === 'completed' ? (
            'Analysis completed successfully'
          ) : (
            'Analysis status: ' + progressData.status
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 font-medium">
              {progressData.status === 'running' ? 'Current check:' : 'Status:'}
            </span>
            <span className="font-semibold text-gray-900">{currentStepName}</span>
          </div>
          
          <div className="space-y-2">
            <Progress value={progressData.progress} className="h-3" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Progress</span>
              <span className="text-lg font-bold text-blue-700">{progressData.progress}%</span>
            </div>
          </div>
        </div>

        {progressData.status === 'running' && (
          <div className="flex items-center gap-2 text-sm bg-white/60 rounded-md p-3 border border-blue-200">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-gray-800 font-medium">Analyzing building compliance requirements...</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
