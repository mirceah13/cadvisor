'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export function GlobalLoadingSpinner() {
  const [isLoading, setIsLoading] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    setIsLoading(false)
  }, [pathname, searchParams])

  // Listen for custom loading events
  useEffect(() => {
    const handleLoadingStart = () => setIsLoading(true)
    const handleLoadingEnd = () => setIsLoading(false)

    window.addEventListener('loadingStart', handleLoadingStart)
    window.addEventListener('loadingEnd', handleLoadingEnd)

    return () => {
      window.removeEventListener('loadingStart', handleLoadingStart)
      window.removeEventListener('loadingEnd', handleLoadingEnd)
    }
  }, [])

  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative">
        {/* Outer spinning circle */}
        <div className="h-20 w-20 rounded-full border-4 border-primary/20 animate-pulse" />
        
        {/* Main spinner */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
        </div>
        
        {/* Inner pulsing dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-3 w-3 rounded-full bg-primary animate-ping" />
        </div>
      </div>
    </div>
  )
}

// Helper function to trigger loading
export const triggerLoading = () => {
  window.dispatchEvent(new Event('loadingStart'))
  // Auto-hide after 10 seconds as fallback
  setTimeout(() => {
    window.dispatchEvent(new Event('loadingEnd'))
  }, 10000)
}

export const stopLoading = () => {
  window.dispatchEvent(new Event('loadingEnd'))
}
