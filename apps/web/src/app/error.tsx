'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-2xl space-y-8 p-8 shadow-xl">
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <svg
              className="h-6 w-6 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground">
            Something went wrong
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            We encountered an error while processing your request.
          </p>
        </div>

        <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-600 dark:text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
                Error Details
              </h3>
              <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                <p className="font-mono text-xs break-all">
                  {error.message || 'An unexpected error occurred'}
                </p>
                {error.digest && (
                  <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                    Error ID: {error.digest}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex flex-col gap-3">
            <Button onClick={reset}>
              Try again
            </Button>
            
            <Button variant="outline" asChild>
              <Link href="/">
                Return to home
              </Link>
            </Button>

            <Button variant="outline" asChild>
              <Link href="/auth/login">
                Go to login
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            If this problem persists, please{' '}
            <Link href="/support" className="font-medium text-primary hover:text-primary/80 transition-colors">
              contact support
            </Link>
          </p>
        </div>
      </Card>
    </div>
  )
}
