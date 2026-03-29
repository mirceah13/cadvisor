import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { getSession } from 'next-auth/react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        console.log('API Request:', config.method?.toUpperCase(), config.url)
        const session = await getSession()
        
        if (session?.user?.accessToken) {
          config.headers.Authorization = `Bearer ${session.user.accessToken}`
          console.log('Auth token added to request')
        } else {
          console.warn('No session or access token available')
        }

        return config
      },
      (error: AxiosError) => {
        console.error('Request interceptor error:', error)
        return Promise.reject(error)
      }
    )

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => {
        console.log('API Response:', response.status, response.config.url)
        return response
      },
      async (error: AxiosError) => {
        console.error('API Error:', error.message, error.response?.status, error.config?.url)
        
        if (error.response?.status === 401) {
          // Unauthorized - redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login?error=SessionExpired'
          }
        }

        return Promise.reject(error)
      }
    )
  }

  // Generic request methods
  async get<T>(url: string, config = {}) {
    const response = await this.client.get<T>(url, config)
    return response.data
  }

  async post<T>(url: string, data?: any, config = {}) {
    const response = await this.client.post<T>(url, data, config)
    return response.data
  }

  async put<T>(url: string, data?: any, config = {}) {
    const response = await this.client.put<T>(url, data, config)
    return response.data
  }

  async patch<T>(url: string, data?: any, config = {}) {
    const response = await this.client.patch<T>(url, data, config)
    return response.data
  }

  async delete<T>(url: string, config = {}) {
    const response = await this.client.delete<T>(url, config)
    return response.data
  }

  // File upload with multipart/form-data
  async upload<T>(url: string, formData: FormData, onProgress?: (progress: number) => void) {
    const response = await this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      },
    })
    return response.data
  }

  // Download file as blob (for authenticated file downloads)
  async downloadFile(url: string, filename: string) {
    const response = await this.client.get(url, {
      responseType: 'blob',
    })
    
    // Create blob and trigger download
    const blob = new Blob([response.data])
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  }

  // Fetch as blob and open in a new tab (for preview / open-with)
  async openFileInNewTab(url: string) {
    const response = await this.client.get(url, {
      responseType: 'blob',
    })
    const blob = new Blob([response.data], {
      type: response.headers['content-type'] || 'application/octet-stream',
    })
    const objectUrl = window.URL.createObjectURL(blob)
    const tab = window.open(objectUrl, '_blank')
    // Revoke the object URL after a short delay so the tab has time to start loading
    setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000)
    return tab
  }
}

// Export singleton instance
export const apiClient = new ApiClient()

// Export convenience methods
export const api = {
  get: <T>(url: string, config = {}) => apiClient.get<T>(url, config),
  post: <T>(url: string, data?: any, config = {}) => apiClient.post<T>(url, data, config),
  put: <T>(url: string, data?: any, config = {}) => apiClient.put<T>(url, data, config),
  patch: <T>(url: string, data?: any, config = {}) => apiClient.patch<T>(url, data, config),
  delete: <T>(url: string, config = {}) => apiClient.delete<T>(url, config),
  upload: <T>(url: string, formData: FormData, onProgress?: (progress: number) => void) =>
    apiClient.upload<T>(url, formData, onProgress),
  downloadFile: (url: string, filename: string) => apiClient.downloadFile(url, filename),
  openFileInNewTab: (url: string) => apiClient.openFileInNewTab(url),
}

// Dashboard API
export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/dashboard/stats'),
  getActivity: (limit?: number) => api.get<RecentActivity>(`/dashboard/activity${limit ? `?limit=${limit}` : ''}`),
  getHealth: () => api.get<HealthResponse>('/dashboard/health'),
  getTrends: (days?: number) => api.get<TrendsData>(`/dashboard/trends${days ? `?days=${days}` : ''}`),
  getSubmissionTrend: (days?: number) => api.get<SubmissionTrendData>(`/dashboard/submission-trend${days ? `?days=${days}` : ''}`),
}

// Types for dashboard
export interface DashboardStats {
  projects: {
    total: number
    active: number
  }
  submissions: {
    total: number
    pending: number
    analyzed: number
  }
  findings: {
    total: number
    critical: number
    high: number
    medium: number
    low: number
    accepted: number
  }
  usage: {
    submissions_this_month: number
    analyses_today: number
    storage_mb: number
  }
}

export interface ActivityItem {
  id: string
  type: string
  title: string
  description: string
  timestamp: string
  link?: string
  status?: string
}

export interface RecentActivity {
  activities: ActivityItem[]
}

export interface ServiceHealth {
  name: string
  status: 'healthy' | 'degraded' | 'unavailable'
  latency_ms?: number
  message?: string
}

export interface HealthResponse {
  services: ServiceHealth[]
  overall: 'healthy' | 'degraded' | 'unavailable'
}

export interface TrendValue {
  current: number
  previous: number
  change_pct: number | null
}

export interface TrendsData {
  days: number
  submissions: TrendValue
  findings: TrendValue
  active_projects: TrendValue
}

export interface DayDataPoint {
  date: string
  count: number
}

export interface SubmissionTrendData {
  days: number
  data: DayDataPoint[]
}

// Types for projects
export interface Project {
  id: string
  name: string
  description?: string | null
  building_type?: string | null
  org_id: string
  created_at: string
  updated_at: string
  last_analysis_at?: string | null
  _count?: {
    submissions: number
    analyzed: number
  }
}

export interface ProjectSubmission {
  id: string
  name: string
  status: string
  created_at: string
  findings_count: number
}

export interface ProjectFindingsSummary {
  critical: number
  high: number
  medium: number
  low: number
  total: number
}

// Projects API
export const projectsApi = {
  list: (params?: { search?: string; building_type?: string; sort?: string; order?: string }) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString() : ''
    return api.get<Project[]>(`/projects${qs}`)
  },
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (data: { name: string; description?: string; type?: string }) =>
    api.post<Project>('/projects', data),
  update: (id: string, data: { name?: string; description?: string; type?: string }) =>
    api.put<Project>(`/projects/${id}`, data),
  remove: (id: string) => api.delete(`/projects/${id}`),
  getSubmissions: (id: string) => api.get<ProjectSubmission[]>(`/projects/${id}/submissions`),
  getFindingsSummary: (id: string) => api.get<ProjectFindingsSummary>(`/projects/${id}/findings-summary`),
}

// Types for submissions
export interface FindingsSummary {
  total: number
  critical: number
  high: number
  medium: number
  low: number
}

export interface SubmissionListItem {
  id: string
  name: string
  description?: string | null
  status: string
  project_id: string
  project_name?: string | null
  created_at: string
  updated_at: string
  files_count: number
  findings_summary?: FindingsSummary | null
}

export interface SubmissionDetail extends SubmissionListItem {
  building_type?: string | null
  profile?: any | null
}

export interface SubmissionAnalysisRun {
  id: string
  submission_id: string
  status: string
  findings_count?: number
  checks_completed: string[]
  error_message?: string
  created_at: string
}

export interface SubmissionFinding {
  id: string
  severity: string
  category: string
  title: string
  description: string
  status: string
  location?: string
  recommendation?: string
  metadata?: any
  created_at: string
}

// Submissions API
export const submissionsApi = {
  list: (params?: { project_id?: string; status?: string }) => {
    const qs = params
      ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString()
      : ''
    return api.get<SubmissionListItem[]>(`/submissions${qs}`)
  },
  get: (id: string) => api.get<SubmissionDetail>(`/submissions/${id}`),
  create: (data: { name: string; description?: string; project_id: string }) =>
    api.post<SubmissionDetail>('/submissions', data),
  update: (id: string, data: { name?: string; description?: string; status?: string }) =>
    api.put<SubmissionDetail>(`/submissions/${id}`, data),
  remove: (id: string) => api.delete(`/submissions/${id}`),
  getProcessingStatus: (id: string) => api.get<any>(`/submissions/${id}/processing-status`),
  getAnalysisRuns: (id: string) => api.get<SubmissionAnalysisRun[]>(`/analysis/submissions/${id}/runs`),
  getFindings: (id: string, runId?: string) => {
    const qs = runId ? `?analysis_run_id=${runId}` : ''
    return api.get<SubmissionFinding[]>(`/analysis/submissions/${id}/findings${qs}`)
  },
}


