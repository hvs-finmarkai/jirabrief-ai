import { createClient } from "@/lib/supabase/client"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

/** localStorage key holding the org id sent as `X-Organization-Id`. */
export const ORG_STORAGE_KEY = "jirabrief-org-id"

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

/** Raised when the signed-in user belongs to no organization yet. */
export class MissingOrganizationError extends ApiError {
  constructor() {
    super("No organization yet. Create one to get started.", 0)
    this.name = "MissingOrganizationError"
  }
}

export function isMissingOrganization(error: unknown): boolean {
  return error instanceof MissingOrganizationError
}

/** FastAPI returns `{detail: string}` or, for validation errors, `{detail: [...]}`. */
function readDetail(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail
    if (typeof detail === "string" && detail) return detail
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) =>
          item && typeof item === "object" && "msg" in item
            ? String((item as { msg: unknown }).msg)
            : null
        )
        .filter((msg): msg is string => Boolean(msg))
      if (messages.length > 0) return messages.join(", ")
    }
  }
  return `Request failed (${status})`
}

function withQuery(
  path: string,
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `${path}?${qs}` : path
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(readDetail(body, response.status), response.status)
  }

  return response.json()
}

/* -------------------------------------------------------------------------- */
/* Auth + organization context                                                 */
/* -------------------------------------------------------------------------- */

async function getAccessToken(): Promise<string> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new ApiError("Your session has expired. Please sign in again.", 401)
  }
  return session.access_token
}

/** Authenticated but not org-scoped (e.g. /api/auth/me, /api/organizations). */
async function authedRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()
  return request<T>(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  })
}

/** Authenticated *and* org-scoped — every endpoint behind `get_current_org_member`. */
async function orgRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const organizationId = await getActiveOrgId()
  return authedRequest<T>(path, {
    ...options,
    headers: { "X-Organization-Id": organizationId, ...options.headers },
  })
}

let organizationsPromise: Promise<Organization[]> | null = null
let activeOrgId: string | null = null

function fetchOrganizations(force = false): Promise<Organization[]> {
  if (force || !organizationsPromise) {
    organizationsPromise = authedRequest<Organization[]>("/api/organizations").catch(
      (error: unknown) => {
        organizationsPromise = null
        throw error
      }
    )
  }
  return organizationsPromise
}

function readStoredOrgId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(ORG_STORAGE_KEY)
  } catch {
    return null
  }
}

/** Persist the selected org and use it for every subsequent org-scoped call. */
export function setActiveOrgId(organizationId: string): void {
  activeOrgId = organizationId
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(ORG_STORAGE_KEY, organizationId)
  } catch {
    // Private browsing / storage disabled — the in-memory value still applies.
  }
}

/** Drop cached org context. Call on sign-out so the next user starts clean. */
export function clearOrgContext(): void {
  activeOrgId = null
  organizationsPromise = null
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(ORG_STORAGE_KEY)
  } catch {
    // Ignore — nothing to clear.
  }
}

/**
 * Resolve the org id for `X-Organization-Id`: the stored one when the user is
 * still a member of it, otherwise the first organization they belong to.
 */
export async function getActiveOrgId(): Promise<string> {
  if (activeOrgId) return activeOrgId

  const organizations = await fetchOrganizations()
  if (organizations.length === 0) throw new MissingOrganizationError()

  const stored = readStoredOrgId()
  const match = stored ? organizations.find((org) => org.id === stored) : undefined
  const chosen = match ? match.id : organizations[0].id

  setActiveOrgId(chosen)
  return chosen
}

/** The full organization record backing the active org id. */
export async function getActiveOrganization(): Promise<Organization> {
  const id = await getActiveOrgId()
  const organizations = await fetchOrganizations()
  const active = organizations.find((org) => org.id === id)
  if (!active) throw new MissingOrganizationError()
  return active
}

/* -------------------------------------------------------------------------- */
/* Demo types (public, unauthenticated endpoints)                              */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Real API types (mirror the backend pydantic models)                         */
/* -------------------------------------------------------------------------- */

/** `app/models/schemas.py::ProfileResponse` */
export interface Profile {
  id: string
  user_id: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

/** `app/models/schemas.py::OrganizationResponse` */
export interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
}

/** `app/models/schemas.py::OrganizationMemberResponse` */
export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: string
  created_at: string
}

/** Mirrors the backend's `require_role("OWNER", "ADMIN")` gate. */
export function canManageOrganization(role: string | null | undefined): boolean {
  return role === "OWNER" || role === "ADMIN"
}

/** `app/jira/routes.py::JiraConnectionResponse` */
export interface JiraConnection {
  id: string
  connection_name: string
  jira_site_url: string
  jira_email: string
  status: string
  last_connected_at: string | null
}

/** `app/jira/routes.py::JiraProjectResponse` */
export interface JiraProject {
  id: string
  key: string
  name: string
  lead: string
}

/** `app/jira/routes.py::JiraSprintResponse` */
export interface JiraSprint {
  id: number
  name: string
  state: string
  start_date: string | null
  end_date: string | null
}

/** `app/jira/routes.py::SyncStatusResponse` */
export interface JiraSyncStatus {
  status: string
  last_sync: string | null
  issues_synced: number
  message: string | null
}

/** `app/reports/storage.py::StoredReport` */
export interface StoredReport {
  id: string
  organization_id: string
  project_key: string
  project_name: string
  sprint_name: string | null
  sprint_id: string | null
  report_type: string
  title: string
  status: string
  approval_status: string
  overall_status: string | null
  generated_content: ReportContent
  edited_content: ReportContent | null
  ai_provider: string
  ai_model: string
  quality_status: string | null
  quality_details: QualityResult | null
  custom_instructions: string | null
  source_issue_keys: string[]
  generated_by: string | null
  approved_by: string | null
  approved_at: string | null
  generated_at: string
  created_at: string
}

/** `app/reports/storage.py::ReportTemplate` */
export interface ReportTemplate {
  id: string
  name: string
  report_type: string
  tone: string
  length: string
  enabled_sections: string[] | null
  additional_instructions: string | null
  is_system: boolean
}

/** `app/reports/storage.py::ComparisonResult` */
export interface ReportComparison {
  newly_completed: string[]
  new_blockers: string[]
  resolved_blockers: string[]
  status_changes: string[]
  new_risks: string[]
  removed_risks: string[]
}

export type ScheduleFrequency = "daily" | "weekly" | "monthly"

/** `app/schedules/service.py::Schedule` */
export interface Schedule {
  id: string
  organization_id: string
  project_key: string
  project_name: string
  sprint_id: string | null
  report_type: string
  template_id: string | null
  frequency: ScheduleFrequency
  day_of_week: number | null
  day_of_month: number | null
  time_of_day: string
  timezone: string
  require_approval: boolean
  enabled: boolean
  next_run_at: string | null
  last_run_at: string | null
  last_run_status: string | null
  failure_count: number
  created_by: string | null
  created_at: string
}

/** `app/schedules/service.py::ScheduleCreateRequest` */
export interface ScheduleCreateRequest {
  project_key: string
  project_name: string
  sprint_id?: string | null
  report_type: string
  template_id?: string | null
  frequency: ScheduleFrequency
  day_of_week?: number | null
  day_of_month?: number | null
  time_of_day?: string
  timezone?: string
  require_approval?: boolean
}

/** `app/schedules/service.py::ScheduleUpdateRequest` */
export interface ScheduleUpdateRequest {
  frequency?: ScheduleFrequency
  day_of_week?: number | null
  day_of_month?: number | null
  time_of_day?: string
  timezone?: string
  require_approval?: boolean
  enabled?: boolean
}

export type DeliveryChannelType = "email" | "slack" | "confluence"

/**
 * `app/delivery/routes.py::list_channels`
 *
 * `config` comes back with every credential already masked server-side
 * (`***1234`). Treat it as read-only display data and never render the
 * credential fields (`api_key`, `api_token`, `webhook_url`, ...).
 */
export interface DeliveryChannel {
  id: string
  name: string
  channel_type: string
  enabled: boolean
  config?: Record<string, unknown>
}

/** `app/delivery/providers.py::DeliveryResult` */
export interface DeliveryResult {
  success: boolean
  error_code: string | null
  error_message: string | null
}

/** `app/delivery/providers.py::DeliveryLog` */
export interface DeliveryLog {
  id: string
  organization_id: string
  report_id: string | null
  channel_id: string | null
  channel_type: string
  status: string
  attempt_count: number
  error_code: string | null
  error_message: string | null
  sent_at: string | null
  created_at: string
}

/** `app/notifications/service.py::NotificationEvent` */
export interface NotificationEvent {
  id: string
  organization_id: string
  user_id: string
  event_type: string
  title: string
  body: string | null
  read: boolean
  created_at: string
}

/* -------------------------------------------------------------------------- */
/* Client                                                                      */
/* -------------------------------------------------------------------------- */

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

  auth: {
    /** GET /api/auth/me */
    me(): Promise<Profile> {
      return authedRequest("/api/auth/me")
    },
  },

  organizations: {
    /** GET /api/organizations */
    list(): Promise<Organization[]> {
      return fetchOrganizations(true)
    },
    /** POST /api/organizations */
    async create(body: { name: string }): Promise<Organization> {
      const org = await authedRequest<Organization>("/api/organizations", {
        method: "POST",
        body: JSON.stringify(body),
      })
      setActiveOrgId(org.id)
      await fetchOrganizations(true).catch(() => undefined)
      return org
    },
    /** GET /api/organizations/{org_id}/members */
    async listMembers(organizationId?: string): Promise<OrganizationMember[]> {
      const id = organizationId ?? (await getActiveOrgId())
      return orgRequest(`/api/organizations/${id}/members`)
    },
    /** DELETE /api/organizations/{org_id}/members/{member_id} — OWNER/ADMIN only */
    async removeMember(memberId: string, organizationId?: string): Promise<{ removed: boolean }> {
      const id = organizationId ?? (await getActiveOrgId())
      return orgRequest(`/api/organizations/${id}/members/${memberId}`, { method: "DELETE" })
    },
    /** The active org record, resolved from the stored org id. */
    active(): Promise<Organization> {
      return getActiveOrganization()
    },
    /** Switch the active organization. */
    setActive(organizationId: string): void {
      setActiveOrgId(organizationId)
    },
  },

  jira: {
    /** GET /api/jira/connection — `null` when the org has never connected. */
    getConnection(): Promise<JiraConnection | null> {
      return orgRequest("/api/jira/connection")
    },
    /** POST /api/jira/connect — OWNER/ADMIN only. The token is write-only. */
    connect(body: {
      connection_name: string
      jira_site_url: string
      email: string
      api_token: string
    }): Promise<JiraConnection> {
      return orgRequest("/api/jira/connect", {
        method: "POST",
        body: JSON.stringify(body),
      })
    },
    /** DELETE /api/jira/disconnect — OWNER/ADMIN only */
    disconnect(): Promise<{ disconnected: boolean }> {
      return orgRequest("/api/jira/disconnect", { method: "DELETE" })
    },
    /** GET /api/jira/projects */
    getProjects(): Promise<JiraProject[]> {
      return orgRequest("/api/jira/projects")
    },
    /** GET /api/jira/projects/{project_key}/sprints */
    getSprints(projectKey: string): Promise<JiraSprint[]> {
      return orgRequest(`/api/jira/projects/${encodeURIComponent(projectKey)}/sprints`)
    },
    /** GET /api/jira/issues?project_key=&sprint_id= */
    getIssues(projectKey: string, sprintId?: number): Promise<Record<string, unknown>[]> {
      return orgRequest(withQuery("/api/jira/issues", { project_key: projectKey, sprint_id: sprintId }))
    },
    /** POST /api/jira/sync?project_key=&sprint_id= */
    sync(projectKey: string, sprintId?: number): Promise<JiraSyncStatus> {
      return orgRequest(
        withQuery("/api/jira/sync", { project_key: projectKey, sprint_id: sprintId }),
        { method: "POST" }
      )
    },
    /** POST /api/jira/reports/generate?project_key=&sprint_id=&report_type= */
    generateReport(params: {
      project_key: string
      sprint_id?: number
      report_type?: ReportType
    }): Promise<ReportResponse> {
      return orgRequest(withQuery("/api/jira/reports/generate", { ...params }), { method: "POST" })
    },
  },

  reports: {
    /** GET /api/reports */
    list(params: {
      project_key?: string
      report_type?: string
      approval_status?: string
      limit?: number
      offset?: number
    } = {}): Promise<StoredReport[]> {
      return orgRequest(withQuery("/api/reports", { ...params }))
    },
    /** GET /api/reports/{report_id} */
    get(reportId: string): Promise<StoredReport> {
      return orgRequest(`/api/reports/${reportId}`)
    },
    /** GET /api/reports/templates */
    templates(): Promise<ReportTemplate[]> {
      return orgRequest("/api/reports/templates")
    },
    /** PUT /api/reports/{report_id}/edit */
    edit(reportId: string, editedContent: Record<string, unknown>): Promise<StoredReport> {
      return orgRequest(`/api/reports/${reportId}/edit`, {
        method: "PUT",
        body: JSON.stringify({ edited_content: editedContent }),
      })
    },
    /** PUT /api/reports/{report_id}/approval — OWNER/ADMIN only */
    setApproval(reportId: string, status: string): Promise<StoredReport> {
      return orgRequest(`/api/reports/${reportId}/approval`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      })
    },
    /** POST /api/reports/{a}/compare/{b} */
    compare(reportAId: string, reportBId: string): Promise<ReportComparison> {
      return orgRequest(`/api/reports/${reportAId}/compare/${reportBId}`, { method: "POST" })
    },
  },

  schedules: {
    /** GET /api/schedules */
    list(): Promise<Schedule[]> {
      return orgRequest("/api/schedules")
    },
    /** POST /api/schedules */
    create(body: ScheduleCreateRequest): Promise<Schedule> {
      return orgRequest("/api/schedules", { method: "POST", body: JSON.stringify(body) })
    },
    /** GET /api/schedules/{schedule_id} */
    get(scheduleId: string): Promise<Schedule> {
      return orgRequest(`/api/schedules/${scheduleId}`)
    },
    /** PUT /api/schedules/{schedule_id} */
    update(scheduleId: string, body: ScheduleUpdateRequest): Promise<Schedule> {
      return orgRequest(`/api/schedules/${scheduleId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      })
    },
    /** DELETE /api/schedules/{schedule_id} — OWNER/ADMIN only */
    remove(scheduleId: string): Promise<{ deleted: boolean }> {
      return orgRequest(`/api/schedules/${scheduleId}`, { method: "DELETE" })
    },
  },

  delivery: {
    /** GET /api/delivery/channels */
    listChannels(): Promise<DeliveryChannel[]> {
      return orgRequest("/api/delivery/channels")
    },
    /** POST /api/delivery/channels — OWNER/ADMIN only */
    createChannel(body: {
      channel_type: DeliveryChannelType
      name: string
      config: Record<string, unknown>
    }): Promise<{ id: string; name: string; channel_type: string }> {
      return orgRequest("/api/delivery/channels", { method: "POST", body: JSON.stringify(body) })
    },
    /** DELETE /api/delivery/channels/{channel_id} — OWNER/ADMIN only */
    deleteChannel(channelId: string): Promise<{ deleted: boolean }> {
      return orgRequest(`/api/delivery/channels/${channelId}`, { method: "DELETE" })
    },
    /** POST /api/delivery/test — OWNER/ADMIN only */
    test(body: {
      channel_type: DeliveryChannelType
      config: Record<string, unknown>
    }): Promise<DeliveryResult> {
      return orgRequest("/api/delivery/test", { method: "POST", body: JSON.stringify(body) })
    },
    /** POST /api/delivery/send */
    send(body: {
      channel_type: DeliveryChannelType
      config: Record<string, unknown>
      report_id?: string | null
      subject: string
      content: string
    }): Promise<DeliveryLog> {
      return orgRequest("/api/delivery/send", { method: "POST", body: JSON.stringify(body) })
    },
    /** GET /api/delivery/logs */
    logs(reportId?: string): Promise<DeliveryLog[]> {
      return orgRequest(withQuery("/api/delivery/logs", { report_id: reportId }))
    },
  },

  notifications: {
    /** GET /api/notifications */
    list(unreadOnly = false): Promise<NotificationEvent[]> {
      return orgRequest(withQuery("/api/notifications", { unread_only: unreadOnly || undefined }))
    },
    /** PUT /api/notifications/{notification_id}/read */
    markRead(notificationId: string): Promise<{ read: boolean }> {
      return orgRequest(`/api/notifications/${notificationId}/read`, { method: "PUT" })
    },
    /** PUT /api/notifications/read-all */
    markAllRead(): Promise<{ marked_read: number }> {
      return orgRequest("/api/notifications/read-all", { method: "PUT" })
    },
  },
}

/** Normalises anything thrown by the client into a user-facing message. */
export function errorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}
