'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { LoadingLink } from '@/components/loading-link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

const errorMessages: Record<string, string> = {
  Configuration: 'OAuth provider is not configured. Please use email/password login instead.',
  AccessDenied: 'You do not have permission to access this resource.',
  Verification: 'The verification token has expired or has already been used.',
  OAuthSignin: 'OAuth provider is not configured. Please use email/password login.',
  OAuthCallback: 'OAuth login failed. The provider may not be configured correctly.',
  OAuthCreateAccount: 'Could not create OAuth provider user in the database.',
  EmailCreateAccount: 'Could not create email provider user in the database.',
  Callback: 'OAuth login failed. Please try email/password login instead.',
  OAuthAccountNotLinked: 'Email already exists with a different sign-in method.',
  EmailSignin: 'Failed to send the email with the magic link.',
  CredentialsSignin: 'Invalid email or password. Please check your credentials and try again.',
  SessionRequired: 'Please sign in to access this page.',
  default: 'An unexpected error occurred during authentication. Please try again or use email/password login.'
}

function AuthErrorPageInner() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error') || 'default'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md space-y-6 p-8">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Authentication Error
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {errorMessages[error] || errorMessages.default}
          </p>
        </div>

        <div className="space-y-3">
          <Button className="w-full" asChild>
            <LoadingLink href="/auth/login">Try signing in again</LoadingLink>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <LoadingLink href="/">Return to home</LoadingLink>
          </Button>
          {(error === 'CredentialsSignin' || error === 'OAuthAccountNotLinked') && (
            <Button variant="outline" className="w-full" asChild>
              <LoadingLink href="/auth/forgot-password">Reset password</LoadingLink>
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Need help?{' '}
          <LoadingLink href="/support" className="text-primary hover:text-primary/80">
            Contact support
          </LoadingLink>
        </p>
      </Card>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <AuthErrorPageInner />
    </Suspense>
  )
}
