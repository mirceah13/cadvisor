'use client'

import { useState } from 'react'
import { useLoadingRouter } from '@/hooks/use-loading-router'
import Link from 'next/link'
import { LoadingLink } from '@/components/loading-link'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function SignupPage() {
  const router = useLoadingRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    organizationName: '',
    acceptTerms: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: ''
  })

  const validatePassword = (password: string) => {
    let score = 0
    let feedback = []

    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    if (password.length < 8) feedback.push('at least 8 characters')
    if (!/[A-Z]/.test(password)) feedback.push('uppercase letter')
    if (!/[a-z]/.test(password)) feedback.push('lowercase letter')
    if (!/\d/.test(password)) feedback.push('number')
    if (!/[^A-Za-z0-9]/.test(password)) feedback.push('special character')

    return {
      score,
      feedback: feedback.length ? `Add: ${feedback.join(', ')}` : 'Strong password'
    }
  }

  const handlePasswordChange = (password: string) => {
    setFormData({ ...formData, password })
    setPasswordStrength(validatePassword(password))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (passwordStrength.score < 3) {
      setError('Please choose a stronger password')
      setLoading(false)
      return
    }

    if (!formData.acceptTerms) {
      setError('Please accept the terms and conditions')
      setLoading(false)
      return
    }

    try {
      // Create organization and user
      const response = await axios.post(`${API_URL}/api/v1/auth/register`, {
        email: formData.email,
        password: formData.password,
        full_name: formData.fullName,
        organization_name: formData.organizationName
      })

      if (response.data) {
        // Redirect to login with success message
        router.push('/auth/login?registered=true')
      }
    } catch (error: any) {
      console.error('Registration error:', error.response?.data || error.message)
      setError(error.response?.data?.detail || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getPasswordStrengthColor = () => {
    if (passwordStrength.score < 2) return 'bg-red-500'
    if (passwordStrength.score < 4) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md space-y-8 p-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <LoadingLink href="/auth/login" className="font-medium text-primary hover:text-primary/80 transition-colors">
              Sign in
            </LoadingLink>
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-foreground">
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm transition-colors"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="organizationName" className="block text-sm font-medium text-foreground">
                Organization Name
              </label>
              <input
                id="organizationName"
                name="organizationName"
                type="text"
                required
                value={formData.organizationName}
                onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm transition-colors"
                placeholder="Your Company"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm transition-colors"
                placeholder="••••••••"
              />
              {formData.password && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded ${
                          i < passwordStrength.score ? getPasswordStrengthColor() : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{passwordStrength.feedback}</p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm transition-colors"
                placeholder="••••••••"
              />
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="mt-1 text-xs text-destructive">Passwords do not match</p>
              )}
            </div>

            <div className="flex items-start">
              <input
                id="acceptTerms"
                name="acceptTerms"
                type="checkbox"
                checked={formData.acceptTerms}
                onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary/20"
              />
              <label htmlFor="acceptTerms" className="ml-2 block text-sm text-foreground">
                I agree to the{' '}
                <LoadingLink href="/terms" className="text-primary hover:text-primary/80 transition-colors">
                  Terms of Service
                </LoadingLink>{' '}
                and{' '}
                <LoadingLink href="/privacy" className="text-primary hover:text-primary/80 transition-colors">
                  Privacy Policy
                </LoadingLink>
              </label>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-background px-2 text-muted-foreground">Or sign up with</span>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-center text-sm text-muted-foreground">
              Use the <LoadingLink href="/auth/login" className="font-medium text-primary hover:text-primary/80 transition-colors">sign in page</LoadingLink> to register with Google, Apple, or Microsoft
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

