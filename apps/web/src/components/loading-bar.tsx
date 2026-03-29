'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export function LoadingBar() {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const pathname = usePathname()

  useEffect(() => {
    setLoading(true)
    setProgress(20)

    const timer1 = setTimeout(() => setProgress(40), 100)
    const timer2 = setTimeout(() => setProgress(60), 200)
    const timer3 = setTimeout(() => setProgress(80), 300)
    const timer4 = setTimeout(() => {
      setProgress(100)
      setTimeout(() => {
        setLoading(false)
        setProgress(0)
      }, 200)
    }, 500)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      clearTimeout(timer4)
    }
  }, [pathname])

  if (!loading && progress === 0) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 h-1 z-50 transition-all duration-300 ease-out"
      style={{
        width: `${progress}%`,
        background: '#C96442',
      }}
    />
  )
}
