const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: "An unexpected error occurred" }))
    throw new Error(body.detail || `Request failed (${response.status})`)
  }

  return response.json()
}

export interface DemoProject {
  id: string
  key: string
  name: string
  jira_project_id: string
}

export interface DemoSprint {
  id: string
  jira_sprint_id: number
  name: string
  state: string
  start_date: string | null
  end_date: string | null
}

export interface SprintHealth {
  status: string
  metrics: {
    total_issues: number
    completed: number
    in_progress: number
    to_do: number
    blocked: number
    overdue: number
    high_priority: number
    unassigned_high_priority: number
    completion_percentage: number
  }
  signals: Array<{
    type: string
    severity: string
    issue_key: string | null
    description: string
  }>
}

export interface ReportItem {
  key: string
  summary: string
  detail?: string | null
}

export interface ReportContent {
  type: string
  title: string
  [key: string]: unknown
}

export interface QualityResult {
  status: string
  verified_sources: number
  total_references: number
  warnings: string[]
  errors: string[]
}

export interface ReportResponse {
  id: string
  report_type: string
  title: string
  status: string
  overall_status: string | null
  content: ReportContent
  quality: QualityResult
  source_issue_keys: string[]
  ai_provider: string
  ai_model: string
  generated_at: string
  sprint_name: string
  project_name: string
  project_key: string
}

export type ReportType = "SPRINT_SUMMARY" | "STATUS_REPORT" | "EXECUTIVE_DIGEST" | "RELEASE_NOTES"

export const api = {
  demo: {
    getProjects(): Promise<DemoProject[]> {
      return request("/api/demo/projects")
    },
    getSprints(projectKey: string): Promise<DemoSprint[]> {
      return request(`/api/demo/projects/${projectKey}/sprints`)
    },
    getSprintHealth(sprintId: string): Promise<SprintHealth> {
      return request(`/api/demo/sprints/${sprintId}/health`)
    },
    generateReport(body: {
      project_key: string
      sprint_id: string
      report_type: ReportType
      custom_instructions?: string
    }): Promise<ReportResponse> {
      return request("/api/demo/reports/generate", {
        method: "POST",
        body: JSON.stringify(body),
      })
    },
    getAiHealth(): Promise<{ available: boolean; provider: string; model: string }> {
      return request("/api/demo/ai/health")
    },
    listReports(reportType?: string): Promise<ReportResponse[]> {
      const params = reportType ? `?report_type=${reportType}` : ""
      return request(`/api/demo/reports${params}`)
    },
  },
}
