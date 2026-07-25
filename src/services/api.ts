import type {
  JiraCredentials,
  JiraProject,
  JiraSprint,
  JiraIssue,
  ReportRequest,
  ReportData,
} from '../types'

const BASE_URL = '/api'

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: 'An unexpected error occurred' }))
    throw new ApiError(body.detail || `Request failed (${response.status})`, response.status)
  }

  return response.json()
}

export const api = {
  health(): Promise<{ status: string }> {
    return request('/health')
  },

  connectJira(credentials: JiraCredentials): Promise<{ connected: boolean }> {
    return request('/jira/connect', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  },

  connectDemo(): Promise<{ connected: boolean }> {
    return request('/jira/connect', {
      method: 'POST',
      body: JSON.stringify({ demo: true }),
    })
  },

  getProjects(): Promise<JiraProject[]> {
    return request('/jira/projects')
  },

  getSprints(projectKey: string): Promise<JiraSprint[]> {
    return request(`/jira/projects/${projectKey}/sprints`)
  },

  getIssues(projectKey: string, sprintId?: number): Promise<JiraIssue[]> {
    const params = sprintId ? `?sprint_id=${sprintId}` : ''
    return request(`/jira/issues${params}&project_key=${projectKey}`)
  },

  generateReport(request_body: ReportRequest): Promise<ReportData> {
    return request('/reports/generate', {
      method: 'POST',
      body: JSON.stringify(request_body),
    })
  },
}
