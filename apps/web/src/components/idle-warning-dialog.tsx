'use client'

import { useIdleTimeout } from '@/hooks/use-idle-timeout'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { signOut } from 'next-auth/react'

export function IdleWarningDialog() {
  const { showWarning, extendSession } = useIdleTimeout()

  if (!showWarning) return null

  return (
    <AlertDialog open={showWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Session expiring soon</AlertDialogTitle>
          <AlertDialogDescription>
            You have been inactive for a while. You will be signed out in 2 minutes.
            Click &ldquo;Stay signed in&rdquo; to continue your session.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={() => signOut({ callbackUrl: '/auth/login?reason=idle' })}
            className="border border-border bg-background text-foreground hover:bg-muted"
          >
            Sign out
          </AlertDialogAction>
          <AlertDialogAction onClick={extendSession}>
            Stay signed in
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
