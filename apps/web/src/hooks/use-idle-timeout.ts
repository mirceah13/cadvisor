'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { signOut, useSession } from 'next-auth/react'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000      // 30 minutes idle → sign out
const WARNING_BEFORE_MS = 2 * 60 * 1000     // show warning 2 minutes before
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']

/**
 * Monitors user activity and automatically signs out after IDLE_TIMEOUT_MS of
 * inactivity. Shows a warning dialog 2 minutes before signing out so the user
 * can continue their session.
 */
export function useIdleTimeout() {
  const { data: session } = useSession()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showWarning, setShowWarning] = useState(false)

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningRef.current) clearTimeout(warningRef.current)
  }, [])

  const resetTimers = useCallback(() => {
    if (!session) return
    clearTimers()
    setShowWarning(false)

    warningRef.current = setTimeout(() => {
      setShowWarning(true)
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS)

    timeoutRef.current = setTimeout(() => {
      signOut({ callbackUrl: '/auth/login?reason=idle' })
    }, IDLE_TIMEOUT_MS)
  }, [session, clearTimers])

  // Start / restart on activity
  useEffect(() => {
    if (!session) return

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimers, { passive: true }))
    resetTimers()

    return () => {
      clearTimers()
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimers))
    }
  }, [session, resetTimers, clearTimers])

  const extendSession = useCallback(() => {
    resetTimers()
  }, [resetTimers])

  return { showWarning, extendSession }
}
