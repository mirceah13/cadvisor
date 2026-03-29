'use client'

import { useState } from 'react'
import { useLoadingRouter } from '@/hooks/use-loading-router'
import { DashboardNav } from '@/components/dashboard-nav'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api-client'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { LoadingLink } from '@/components/loading-link'

export default function NewProjectPage() {
  const router = useLoadingRouter()
  const { accessToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'building',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await apiClient.post('/projects', formData, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000, // 10 second timeout
      })
      
      // Handle both response.data and direct response
      const project = response.data || response
      
      if (project?.id) {
        router.push(`/projects/${project.id}`)
      } else {
        throw new Error('Invalid response from server')
      }
    } catch (err: any) {
      console.error('Failed to create project:', err)
      
      let errorMessage = 'Failed to create project. Please try again.'
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Please check your connection and try again.'
      } else if (err.response?.data?.detail) {
        errorMessage = typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : 'Server error. Please try again.'
      } else if (err.response?.status === 403) {
        errorMessage = 'You do not have permission to create projects.'
      } else if (err.response?.status === 500) {
        errorMessage = 'Server error. Please contact support if this persists.'
      } else if (!err.response) {
        errorMessage = 'Network error. Please check your connection.'
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DashboardNav />
      <div className="flex-1 p-8 pt-6 container max-w-2xl">
        <PageHeader
          title="Create New Project"
          description="Set up a compliance project to manage your submissions"
          className="mb-8"
        />

        {error && (
          <p className="text-sm text-destructive mb-4">{error}</p>
        )}

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                placeholder="Enter project name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your project..."
                rows={4}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Project Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="building">Building</SelectItem>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="mechanical">Mechanical</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Project'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <LoadingLink href="/projects">Cancel</LoadingLink>
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  )
}

