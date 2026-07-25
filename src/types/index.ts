export interface JiraCredentials {
  url: string
  email: string
  token: string
}

export interface JiraProject {
  key: string
  name: string
  lead: string
}

export interface JiraSprint {
  id: number
  name: string
  state: 'active' | 'closed' | 'future'
  startDate: string | null
  endDate: string | null
}

export interface JiraIssue {
  key: string
  summary: string
  status: string
  priority: string
  assignee: string | null
  issueType: string
  created: string
  updated: string
  labels: string[]
  comments: JiraComment[]
  blockedBy: string | null
}

export interface JiraComment {
  author: string
  body: string
  created: string
}

export type ReportType = 'sprint-summary' | 'status-report' | 'executive-digest' | 'release-notes'

export interface ReportRequest {
  projectKey: string
  sprintId: number | null
  reportType: ReportType
}

export interface SprintSummaryReport {
  type: 'sprint-summary'
  title: string
  sprintName: string
  completed: ReportItem[]
  inProgress: ReportItem[]
  blockers: ReportItem[]
  slipped: ReportItem[]
  nextWork: string[]
}

export interface StatusReportData {
  type: 'status-report'
  title: string
  currentState: string
  progress: string
  completedWork: ReportItem[]
  currentWork: ReportItem[]
  blockers: ReportItem[]
  risks: string[]
  nextActions: string[]
}

export interface ExecutiveDigestData {
  type: 'executive-digest'
  title: string
  overallStatus: string
  highlights: string[]
  risks: string[]
  impact: string
  managementAsks: string[]
}

export interface ReleaseNotesData {
  type: 'release-notes'
  title: string
  newFunctionality: ReportItem[]
  improvements: ReportItem[]
  fixes: ReportItem[]
}

export interface ReportItem {
  key: string
  summary: string
  detail?: string
}

export type ReportData = SprintSummaryReport | StatusReportData | ExecutiveDigestData | ReleaseNotesData

export interface ApiError {
  detail: string
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface AppState {
  connectionStatus: ConnectionStatus
  isDemoMode: boolean
  projects: JiraProject[]
  selectedProject: JiraProject | null
  sprints: JiraSprint[]
  selectedSprint: JiraSprint | null
  selectedReportType: ReportType | null
  report: ReportData | null
  isGenerating: boolean
  error: string | null
}
