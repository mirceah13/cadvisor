'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLoadingRouter } from '@/hooks/use-loading-router'
import Link from 'next/link'
import axios from 'axios'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

function VerifyEmailContent() {
  const router = useLoadingRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMsg('Missing verification token.')
      return
    }

    const verify = async () => {
      try {
        await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/verify-email`, { token })
        setStatus('success')
        setTimeout(() => router.push('/auth/login?message=email-verified'), 3000)
      } catch (err: any) {
        setErrorMsg(err.response?.data?.detail || 'Verification failed. The link may have expired.')
        setStatus('error')
      }
    }

    verify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (status === 'verifying') {
    return (
      <div className="text-center space-y-3">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Verifying your email…</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="rounded-md border p-6 text-center space-y-2">
        <p className="text-sm font-medium text-foreground">Email verified successfully</p>
        <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-center">
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">{errorMsg}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Need a new verification link?{' '}
        <Link href="/auth/login" className="text-primary hover:underline">Sign in</Link>
        {' '}to request one.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/auth/login">Back to sign in</Link>
      </Button>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md space-y-8 p-8">
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">Verify your email</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            We&apos;re confirming your email address.
          </p>
        </div>
        <Suspense fallback={null}>
          <VerifyEmailContent />
        </Suspense>
      </Card>
    </div>
  )
}
