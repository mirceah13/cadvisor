'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DashboardNav } from '@/components/dashboard-nav'
import { PageHeader } from '@/components/page-header'

export default function ProfilePage() {
  const { user, isLoading } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    email: user?.email || ''
  })

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    )
  }

  const handleSave = async () => {
    // TODO: Implement profile update API call
    setIsEditing(false)
  }

  return (
    <>
      <DashboardNav />
      <div className="flex-1 space-y-6 p-8 pt-6 container max-w-3xl">
        <PageHeader
          title="Profile Settings"
          description="Manage your account information and preferences"
        />

        <div className="space-y-6">
          {/* Profile Information */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Personal Information</h2>
              <Button
                variant={isEditing ? 'default' : 'outline'}
                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              >
                {isEditing ? 'Save Changes' : 'Edit'}
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Full Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                  />
                ) : (
                  <p className="text-sm text-foreground">{user?.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Email Address
                </label>
                <p className="text-sm text-foreground">{user?.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Contact support to change your email address
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Role
                </label>
                <p className="text-sm text-foreground capitalize">{user?.role}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Organization ID
                </label>
                <p className="text-sm text-foreground">{user?.organizationId}</p>
              </div>
            </div>
          </Card>

          {/* Security Settings */}
          <Card className="p-6">
            <h2 className="text-base font-semibold mb-4">Security</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Password
                </label>
                <Button variant="outline" asChild>
                  <a href="/settings/security">Change Password</a>
                </Button>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Two-Factor Authentication
                </label>
                <p className="text-sm text-muted-foreground mb-2">
                  Add an extra layer of security to your account
                </p>
                <Button variant="outline" disabled>
                  Enable 2FA (Coming Soon)
                </Button>
              </div>
            </div>
          </Card>

          {/* Account Actions */}
          <Card className="p-6">
            <h2 className="text-base font-semibold mb-4">Account Actions</h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-1">Delete Account</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Permanently delete your account and all associated data
                </p>
                <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  Delete Account
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
