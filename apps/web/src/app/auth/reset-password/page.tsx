'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLoadingRouter } from '@/hooks/use-loading-router'
import Link from 'next/link'
import axios from 'axios'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

function ResetPasswordForm() {
  const router = useLoadingRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')

    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/reset-password`, {
        token,
        new_password: password,
      })
      setSuccess(true)
      setTimeout(() => router.push('/auth/login'), 2500)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reset password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">Invalid reset link. Please request a new one.</p>
        <Link href="/auth/forgot-password" className="mt-3 inline-block text-sm text-primary hover:underline">
          Request new reset link
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="rounded-md border p-6 text-center space-y-2">
        <p className="text-sm font-medium text-foreground">Password reset successfully</p>
        <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
      </div>
    )
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">New password</label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm"
          placeholder="••••••••"
        />
      </div>
      <div>
        <label htmlFor="confirm" className="block text-sm font-medium text-foreground mb-2">Confirm new password</label>
        <input
          id="confirm"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm"
          placeholder="••••••••"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Resetting…' : 'Reset password'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/auth/login" className="text-primary hover:underline">Back to sign in</Link>
      </p>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md space-y-8 p-8">
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">Set new password</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Choose a strong password with uppercase, lowercase, a number and a special character.
          </p>
        </div>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </Card>
    </div>
  )
}
