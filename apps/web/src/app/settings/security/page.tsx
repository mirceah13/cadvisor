'use client'

import { useState } from 'react'
import { useLoadingRouter } from '@/hooks/use-loading-router'
import { useAuth } from '@/hooks/use-auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api-client'
import { DashboardNav } from '@/components/dashboard-nav'
import { PageHeader } from '@/components/page-header'

export default function SecurityPage() {
  const router = useLoadingRouter()
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
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
    setFormData({ ...formData, newPassword: password })
    setPasswordStrength(validatePassword(password))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    // Validation
    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match')
      setLoading(false)
      return
    }

    if (passwordStrength.score < 3) {
      setError('Please choose a stronger password')
      setLoading(false)
      return
    }

    try {
      await api.post('/api/v1/auth/change-password', {
        current_password: formData.currentPassword,
        new_password: formData.newPassword
      })

      setSuccess(true)
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })

      // Redirect after success
      setTimeout(() => {
        router.push('/profile')
      }, 2000)
    } catch (error: any) {
      console.error('Password change error:', error)
      setError(error.response?.data?.detail || 'Failed to change password')
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
    <>
      <DashboardNav />
      <div className="flex-1 space-y-6 p-8 pt-6 container max-w-2xl">
        <PageHeader
          title="Security Settings"
          description="Update your password and security preferences"
        />

        <Card className="p-6">
          <h2 className="text-base font-semibold mb-6">Change Password</h2>

          {success && (
            <p className="mb-4 text-sm text-green-600">
              Password changed successfully! Redirecting...
            </p>
          )}

          {error && (
            <p className="mb-4 text-sm text-destructive">{error}</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-muted-foreground mb-1">
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                required
                value={formData.currentPassword}
                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-muted-foreground mb-1">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                required
                value={formData.newPassword}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
              {formData.newPassword && (
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
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-muted-foreground mb-1">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
              {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
                <p className="mt-1 text-xs text-destructive">Passwords do not match</p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={loading}
              >
                {loading ? 'Changing Password...' : 'Change Password'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>

          <div className="mt-8 border-t pt-6">
            <h3 className="text-sm font-semibold mb-2">Password Requirements</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• At least 8 characters long</li>
              <li>• Contains uppercase and lowercase letters</li>
              <li>• Contains at least one number</li>
              <li>• Contains at least one special character</li>
            </ul>
          </div>
        </Card>
      </div>
    </>
  )
}
