"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  FileText,
  Search,
  Plus,
  ChevronRight,
  ArrowLeft,
  Shield,
  ShieldAlert,
  Loader2,
  GitCompare,
  Pencil,
  Sparkles,
  X,
} from "lucide-react"
import Link from "next/link"
import {
  api,
  canManageOrganization,
  errorMessage,
  type JiraProject,
  type JiraSprint,
  type OrganizationMember,
  type Profile,
  type ReportComparison,
  type ReportType,
  type StoredReport,
} from "@/lib/api"
import { useAsyncData } from "@/lib/use-async-data"
import {
  EmptyState,
  ErrorState,
  JiraRequiredNotice,
  LoadingRows,
  NoOrganizationState,
} from "@/components/page-states"
import {
  BULLET_FIELDS,
  NARRATIVE_FIELDS,
  ReportContentView,
  asStrings,
} from "@/components/report-content"

const APPROVAL_STYLES: Record<string, string> = {
  DRAFT: "bg-warm-200 text-warm-600",
  IN_REVIEW: "bg-status-progress/10 text-status-progress",
  APPROVED: "bg-status-done/10 text-status-done",
  SENT: "bg-accent/10 text-accent",
}

const APPROVAL_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In Review",
  APPROVED: "Approved",
  SENT: "Sent",
}

const TYPE_LABELS: Record<string, string> = {
  SPRINT_SUMMARY: "Sprint Summary",
  STATUS_REPORT: "Status Report",
  EXECUTIVE_DIGEST: "Executive Digest",
  RELEASE_NOTES: "Release Notes",
}

/**
 * Mirrors `update_approval`'s transition table in app/reports/storage.py.
 * The backend rejects anything else, so the UI only offers legal moves.
 */
const APPROVAL_TRANSITIONS: Record<string, { status: string; label: string; primary: boolean }[]> = {
  DRAFT: [{ status: "IN_REVIEW", label: "Submit for review", primary: true }],
  IN_REVIEW: [
    { status: "APPROVED", label: "Approve", primary: true },
    { status: "DRAFT", label: "Return to draft", primary: false },
  ],
  APPROVED: [
    { status: "SENT", label: "Mark as sent", primary: true },
    { status: "DRAFT", label: "Return to draft", primary: false },
  ],
  SENT: [],
}

const QUALITY_STYLES: Record<string, string> = {
  PASSED: "text-status-done",
  PASSED_WITH_WARNINGS: "text-status-progress",
  FAILED_VALIDATION: "text-status-blocked",
}

interface RoleData {
  profile: Profile
  members: OrganizationMember[]
}

/** The content a report is currently presenting: edits win over the generated pass. */
function effectiveContent(report: StoredReport): Record<string, unknown> {
  return (report.edited_content ?? report.generated_content ?? {}) as Record<string, unknown>
}

/**
 * `quality_details` is stored as a free-form dict, not a validated QualityResult,
 * so every field is treated as possibly absent.
 */
function qualityCounts(report: StoredReport) {
  const quality = report.quality_details as Partial<Record<string, unknown>> | null
  if (!quality) return null
  const list = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
  const count = (value: unknown): number => (typeof value === "number" ? value : 0)
  return {
    verifiedSources: count(quality.verified_sources),
    totalReferences: count(quality.total_references),
    warnings: list(quality.warnings),
    errors: list(quality.errors),
  }
}

export default function ReportsPage() {
  const [typeFilter, setTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [showGenerate, setShowGenerate] = useState(false)
  const [generatedNotice, setGeneratedNotice] = useState<string | null>(null)

  const listFetcher = useCallback(
    (): Promise<StoredReport[]> =>
      api.reports.list({
        report_type: typeFilter || undefined,
        approval_status: statusFilter || undefined,
        limit: 100,
      }),
    [typeFilter, statusFilter]
  )

  const {
    data: reportsData,
    loading,
    error,
    missingOrg,
    reload,
    setData: setReports,
  } = useAsyncData(listFetcher, "Failed to load reports")

  const roleFetcher = useCallback(async (): Promise<RoleData> => {
    const [profile, members] = await Promise.all([api.auth.me(), api.organizations.listMembers()])
    return { profile, members }
  }, [])

  const { data: roleData, error: roleError } = useAsyncData(roleFetcher, "Failed to load your role")

  const role =
    roleData?.members.find((m) => m.user_id === roleData.profile.user_id)?.role ?? null
  // Approval is require_role("OWNER","ADMIN") — fail closed if the role is unknown.
  const canApprove = canManageOrganization(role)
  // Editing is require_role("OWNER","ADMIN","MEMBER"), so only VIEWER is excluded.
  const canEdit = role !== "VIEWER"

  const reports = reportsData ?? []
  const selected = selectedId ? reports.find((r) => r.id === selectedId) ?? null : null

  const filtered = searchQuery
    ? reports.filter(
        (r) =>
          r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.project_key.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : reports

  /** Replace one report in the cached list after a mutation. */
  const applyUpdate = useCallback(
    (updated: StoredReport) => {
      setReports((prev) => (prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev))
    },
    [setReports]
  )

  function toggleCompare(reportId: string) {
    setCompareIds((prev) => {
      if (prev.includes(reportId)) return prev.filter((id) => id !== reportId)
      if (prev.length >= 2) return [prev[1], reportId]
      return [...prev, reportId]
    })
  }

  if (selected) {
    return (
      <ReportDetail
        report={selected}
        canApprove={canApprove}
        canEdit={canEdit}
        roleUnknown={role === null}
        onBack={() => setSelectedId(null)}
        onUpdated={applyUpdate}
      />
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-charcoal mb-1">Reports</h1>
          <p className="text-sm text-warm-500">View and manage generated reports</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/schedules"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-warm-600 bg-white border border-warm-200 rounded-xl hover:border-warm-300 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Schedule
          </Link>
          <button
            onClick={() => {
              setShowGenerate(true)
              setGeneratedNotice(null)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Generate report
          </button>
        </div>
      </div>

      {missingOrg ? (
        <NoOrganizationState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reports..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-warm-200 rounded-xl text-sm text-charcoal placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-warm-200 rounded-xl text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
            >
              <option value="">All Types</option>
              <option value="SPRINT_SUMMARY">Sprint Summary</option>
              <option value="STATUS_REPORT">Status Report</option>
              <option value="EXECUTIVE_DIGEST">Executive Digest</option>
              <option value="RELEASE_NOTES">Release Notes</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-warm-200 rounded-xl text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="APPROVED">Approved</option>
              <option value="SENT">Sent</option>
            </select>
          </div>

          {showGenerate && (
            <GenerateReportPanel
              onCancel={() => setShowGenerate(false)}
              onGenerated={(title) => {
                setShowGenerate(false)
                setGeneratedNotice(`Generated "${title}".`)
                reload()
              }}
            />
          )}

          {generatedNotice && (
            <p className="text-sm text-status-done bg-status-done/5 rounded-lg px-3 py-2 mb-4">
              {generatedNotice}
            </p>
          )}

          {roleError && (
            <p className="text-xs text-warm-400 mb-4">
              Could not confirm your role, so approval actions are hidden.
            </p>
          )}

          {compareIds.length > 0 && (
            <ComparePanel
              reports={reports}
              compareIds={compareIds}
              onClear={() => setCompareIds([])}
            />
          )}

          {loading ? (
            <LoadingRows rows={4} />
          ) : reports.length === 0 ? (
            typeFilter || statusFilter ? (
              <EmptyState
                icon={FileText}
                title="No Reports Yet"
                description="No reports match the current filters"
              />
            ) : (
              <div className="bg-white rounded-xl border border-warm-200 p-12 text-center">
                <FileText className="w-10 h-10 text-warm-300 mx-auto mb-4" />
                <p className="text-sm text-warm-500 font-medium">No Reports Yet</p>
                <p className="text-xs text-warm-400 mt-1">
                  Generate one now from a Jira sprint, or schedule them to run automatically
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => {
                      setShowGenerate(true)
                      setGeneratedNotice(null)
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate report
                  </button>
                  <Link
                    href="/schedules"
                    className="px-4 py-2 text-sm font-medium text-warm-600 bg-warm-100 rounded-xl hover:bg-warm-200 transition-colors"
                  >
                    Create a schedule
                  </Link>
                </div>
              </div>
            )
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No Matches"
              description={`No report matches "${searchQuery}"`}
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((report, i) => {
                const isComparing = compareIds.includes(report.id)
                return (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex items-center gap-4 p-4 bg-white rounded-xl border transition-all group ${isComparing ? "border-accent" : "border-warm-200 hover:border-warm-300 hover:shadow-sm"}`}
                  >
                    <button
                      onClick={() => toggleCompare(report.id)}
                      title={isComparing ? "Remove from comparison" : "Add to comparison"}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer ${isComparing ? "bg-accent/10" : "bg-warm-100 hover:bg-warm-200"}`}
                    >
                      {isComparing ? (
                        <GitCompare className="w-4.5 h-4.5 text-accent" />
                      ) : (
                        <FileText className="w-4.5 h-4.5 text-warm-500" />
                      )}
                    </button>
                    <button
                      onClick={() => setSelectedId(report.id)}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <p className="text-sm font-medium text-charcoal truncate">{report.title}</p>
                      <p className="text-xs text-warm-400 mt-0.5">
                        {report.project_key} · {TYPE_LABELS[report.report_type] || report.report_type} ·{" "}
                        {new Date(report.generated_at).toLocaleDateString()}
                        {report.edited_content && " · edited"}
                      </p>
                    </button>
                    {report.quality_status && report.quality_status !== "PASSED" && (
                      <ShieldAlert
                        className={`w-4 h-4 shrink-0 ${QUALITY_STYLES[report.quality_status] || "text-warm-400"}`}
                      />
                    )}
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${APPROVAL_STYLES[report.approval_status] || APPROVAL_STYLES.DRAFT}`}
                    >
                      {APPROVAL_LABELS[report.approval_status] || report.approval_status}
                    </span>
                    <button onClick={() => setSelectedId(report.id)} className="cursor-pointer">
                      <ChevronRight className="w-4 h-4 text-warm-300 group-hover:text-accent transition-colors" />
                    </button>
                  </motion.div>
                )
              })}
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/* Generation                                                                  */
/* -------------------------------------------------------------------------- */

interface JiraPickerData {
  connected: boolean
  projects: JiraProject[]
}

/** Ticks while generation is in flight so a slow AI call never looks hung. */
function ElapsedSeconds() {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  return <>{seconds}s</>
}

/**
 * Generates a report straight from Jira. `POST /api/jira/reports/generate` takes
 * query params (not a body) and now persists the report, so the caller only has
 * to refetch the list afterwards.
 */
function GenerateReportPanel({
  onCancel,
  onGenerated,
}: {
  onCancel: () => void
  onGenerated: (title: string) => void
}) {
  const [projectKey, setProjectKey] = useState("")
  const [sprintValue, setSprintValue] = useState("")
  const [reportType, setReportType] = useState<ReportType>("SPRINT_SUMMARY")
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const projectsFetcher = useCallback(async (): Promise<JiraPickerData> => {
    const connection = await api.jira.getConnection()
    if (!connection) return { connected: false, projects: [] }
    return { connected: true, projects: await api.jira.getProjects() }
  }, [])

  const {
    data: jira,
    loading: projectsLoading,
    error: projectsError,
    missingOrg,
    reload: reloadProjects,
  } = useAsyncData(projectsFetcher, "Failed to load Jira projects")

  const projects = jira?.projects ?? []
  // Derived rather than stored, so the first project is selected as soon as the
  // list arrives without setting state from an effect.
  const selectedProjectKey = projectKey || projects[0]?.key || ""

  const sprintsFetcher = useCallback(async (): Promise<JiraSprint[]> => {
    if (!selectedProjectKey) return []
    return api.jira.getSprints(selectedProjectKey)
  }, [selectedProjectKey])

  const { data: sprintsData, loading: sprintsLoading, error: sprintsError } = useAsyncData(
    sprintsFetcher,
    "Failed to load sprints"
  )
  const sprints = sprintsData ?? []

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProjectKey) {
      setError("Select a Jira project")
      return
    }

    setGenerating(true)
    setError(null)
    try {
      const report = await api.jira.generateReport({
        project_key: selectedProjectKey,
        sprint_id: sprintValue ? Number(sprintValue) : undefined,
        report_type: reportType,
      })
      onGenerated(report.title)
    } catch (err) {
      setError(errorMessage(err, "Failed to generate report"))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-warm-200 p-6 mb-6"
    >
      <h3 className="text-sm font-semibold text-charcoal mb-4">Generate Report</h3>

      {missingOrg ? (
        <NoOrganizationState />
      ) : projectsError ? (
        <ErrorState message={projectsError} onRetry={reloadProjects} />
      ) : projectsLoading ? (
        <LoadingRows rows={2} />
      ) : !jira?.connected || projects.length === 0 ? (
        <JiraRequiredNotice
          message="A report is generated from a Jira project, so Jira needs to be connected before you can generate one."
          onCancel={onCancel}
        />
      ) : (
        <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Project</label>
            <select
              value={selectedProjectKey}
              onChange={(e) => {
                setProjectKey(e.target.value)
                setSprintValue("")
              }}
              disabled={generating}
              className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer disabled:opacity-50"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.key}>
                  {project.name} ({project.key})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Sprint</label>
            <select
              value={sprintValue}
              onChange={(e) => setSprintValue(e.target.value)}
              disabled={generating || sprintsLoading}
              className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer disabled:opacity-50"
            >
              <option value="">
                {sprintsLoading ? "Loading sprints..." : "All open issues (no sprint)"}
              </option>
              {sprints.map((sprint) => (
                <option key={sprint.id} value={String(sprint.id)}>
                  {sprint.name} ({sprint.state})
                </option>
              ))}
            </select>
            {sprintsError && <p className="text-xs text-status-progress mt-1">{sprintsError}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              disabled={generating}
              className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer disabled:opacity-50"
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="sm:col-span-3 text-sm text-status-blocked bg-status-blocked/5 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {generating && (
            <div className="sm:col-span-3 flex items-center gap-3 px-3 py-3 bg-warm-50 rounded-lg">
              <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
              <div>
                <p className="text-sm text-charcoal">
                  Reading Jira and writing the report... <ElapsedSeconds />
                </p>
                <p className="text-xs text-warm-400 mt-0.5">
                  This can take a minute or so when an AI provider is configured. Leaving this page
                  cancels the wait, not the generation.
                </p>
              </div>
            </div>
          )}

          <div className="sm:col-span-3 flex gap-2">
            <button
              type="submit"
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors disabled:opacity-40 cursor-pointer"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {generating ? "Generating..." : "Generate"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={generating}
              className="px-4 py-2 text-sm text-warm-500 bg-warm-100 rounded-xl hover:bg-warm-200 transition-colors disabled:opacity-40 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/* Comparison                                                                  */
/* -------------------------------------------------------------------------- */

function ComparePanel({
  reports,
  compareIds,
  onClear,
}: {
  reports: StoredReport[]
  compareIds: string[]
  onClear: () => void
}) {
  const [result, setResult] = useState<ReportComparison | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [aId, bId] = compareIds
  const a = reports.find((r) => r.id === aId)
  const b = bId ? reports.find((r) => r.id === bId) : undefined

  async function runCompare() {
    if (!aId || !bId) return
    setBusy(true)
    setError(null)
    try {
      setResult(await api.reports.compare(aId, bId))
    } catch (err) {
      setError(errorMessage(err, "Failed to compare reports"))
    } finally {
      setBusy(false)
    }
  }

  const sections: { label: string; values: string[] }[] = result
    ? [
        { label: "Newly Completed", values: result.newly_completed },
        { label: "New Blockers", values: result.new_blockers },
        { label: "Resolved Blockers", values: result.resolved_blockers },
        { label: "Status Changes", values: result.status_changes },
        { label: "New Risks", values: result.new_risks },
        { label: "Removed Risks", values: result.removed_risks },
      ].filter((section) => section.values.length > 0)
    : []

  return (
    <div className="bg-white rounded-xl border border-warm-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-charcoal">Compare Reports</h3>
        <button
          onClick={onClear}
          className="p-1.5 text-warm-400 hover:text-charcoal transition-colors rounded-md hover:bg-warm-50 cursor-pointer"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-1 mb-4">
        <p className="text-xs text-warm-500">
          <span className="text-warm-400">Base:</span> {a ? a.title : "—"}
        </p>
        <p className="text-xs text-warm-500">
          <span className="text-warm-400">Against:</span>{" "}
          {b ? b.title : "select a second report"}
        </p>
      </div>

      {error && <p className="text-sm text-status-blocked bg-status-blocked/5 rounded-lg px-3 py-2 mb-3">{error}</p>}

      <button
        onClick={runCompare}
        disabled={!bId || busy}
        className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors disabled:opacity-40 cursor-pointer"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
        Compare
      </button>

      {result && (
        <div className="mt-4 pt-4 border-t border-warm-100">
          {sections.length === 0 ? (
            <p className="text-sm text-warm-400">No differences between these two reports.</p>
          ) : (
            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section.label}>
                  <h4 className="text-xs font-semibold text-warm-600 uppercase tracking-wide mb-2">
                    {section.label}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {section.values.map((value) => (
                      <span
                        key={value}
                        className="text-xs px-2 py-0.5 bg-warm-100 text-warm-600 rounded"
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Detail + approval workflow                                                  */
/* -------------------------------------------------------------------------- */

function ReportDetail({
  report,
  canApprove,
  canEdit,
  roleUnknown,
  onBack,
  onUpdated,
}: {
  report: StoredReport
  canApprove: boolean
  canEdit: boolean
  roleUnknown: boolean
  onBack: () => void
  onUpdated: (report: StoredReport) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const transitions = APPROVAL_TRANSITIONS[report.approval_status] ?? []
  const quality = qualityCounts(report)
  const content = effectiveContent(report)

  async function handleTransition(status: string, label: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      onUpdated(await api.reports.setApproval(report.id, status))
      setNotice(`${label} — done`)
    } catch (err) {
      setError(errorMessage(err, "Failed to update approval status"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-warm-500 hover:text-charcoal mb-4 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to reports
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-charcoal mb-1 truncate">{report.title}</h1>
          <p className="text-sm text-warm-500">
            {report.project_name} ({report.project_key})
            {report.sprint_name ? ` · ${report.sprint_name}` : ""} ·{" "}
            {TYPE_LABELS[report.report_type] || report.report_type}
          </p>
        </div>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${APPROVAL_STYLES[report.approval_status] || APPROVAL_STYLES.DRAFT}`}
        >
          {APPROVAL_LABELS[report.approval_status] || report.approval_status}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-warm-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-charcoal mb-4">Approval</h2>

        <ApprovalTrail report={report} />

        {error && <p className="text-sm text-status-blocked bg-status-blocked/5 rounded-lg px-3 py-2 mt-3">{error}</p>}
        {notice && <p className="text-sm text-status-done bg-status-done/5 rounded-lg px-3 py-2 mt-3">{notice}</p>}

        {transitions.length === 0 ? (
          <p className="text-xs text-warm-400 mt-3">
            This report has been sent. Its approval status can no longer change.
          </p>
        ) : !canApprove ? (
          <p className="text-xs text-warm-400 mt-3">
            {roleUnknown
              ? "Your role could not be confirmed, so approval actions are unavailable."
              : "Only owners and admins can move a report through approval."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 mt-4">
            {transitions.map((transition) => (
              <button
                key={transition.status}
                onClick={() => handleTransition(transition.status, transition.label)}
                disabled={busy}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 cursor-pointer ${transition.primary ? "bg-charcoal text-white hover:bg-charcoal-light" : "text-warm-600 bg-warm-100 hover:bg-warm-200"}`}
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {transition.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-warm-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-charcoal">Quality &amp; Traceability</h2>
          <span
            className={`flex items-center gap-1.5 text-xs font-medium ${QUALITY_STYLES[report.quality_status ?? ""] || "text-warm-400"}`}
          >
            <Shield className="w-3.5 h-3.5" />
            {report.quality_status ? report.quality_status.replaceAll("_", " ") : "Not checked"}
          </span>
        </div>

        {quality ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-warm-50 rounded-lg">
                <p className="text-lg font-semibold text-charcoal">{quality.verifiedSources}</p>
                <p className="text-xs text-warm-400">Verified sources</p>
              </div>
              <div className="p-3 bg-warm-50 rounded-lg">
                <p className="text-lg font-semibold text-charcoal">{quality.totalReferences}</p>
                <p className="text-xs text-warm-400">Total references</p>
              </div>
              <div className="p-3 bg-warm-50 rounded-lg">
                <p className="text-lg font-semibold text-status-progress">{quality.warnings.length}</p>
                <p className="text-xs text-warm-400">Warnings</p>
              </div>
              <div className="p-3 bg-warm-50 rounded-lg">
                <p className="text-lg font-semibold text-status-blocked">{quality.errors.length}</p>
                <p className="text-xs text-warm-400">Errors</p>
              </div>
            </div>

            {quality.errors.length > 0 && (
              <ul className="mt-3 space-y-1">
                {quality.errors.map((message, i) => (
                  <li key={i} className="text-xs text-status-blocked flex gap-2">
                    <span className="shrink-0">•</span>
                    {message}
                  </li>
                ))}
              </ul>
            )}
            {quality.warnings.length > 0 && (
              <ul className="mt-2 space-y-1">
                {quality.warnings.map((message, i) => (
                  <li key={i} className="text-xs text-status-progress flex gap-2">
                    <span className="shrink-0">•</span>
                    {message}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-warm-400">No quality result was stored for this report.</p>
        )}

        <div className="mt-4 pt-4 border-t border-warm-100">
          <h4 className="text-xs font-semibold text-warm-600 uppercase tracking-wide mb-2">
            Source Issues ({report.source_issue_keys.length})
          </h4>
          {report.source_issue_keys.length === 0 ? (
            <p className="text-xs text-warm-400">No source issues were recorded.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {report.source_issue_keys.map((key) => (
                <span key={key} className="text-xs font-mono px-2 py-0.5 bg-warm-100 text-warm-600 rounded">
                  {key}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-warm-400 mt-3">
            Generated {new Date(report.generated_at).toLocaleString()} by {report.ai_provider}/
            {report.ai_model}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-warm-200 shadow-sm p-8">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-warm-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <FileText className="w-4.5 h-4.5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-charcoal">Content</h2>
              <p className="text-xs text-warm-400">
                {report.edited_content ? "Showing edited version" : "Showing generated version"}
              </p>
            </div>
          </div>
          {!editing && canEdit && report.approval_status !== "SENT" && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-warm-600 bg-white border border-warm-200 rounded-lg hover:border-warm-300 transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <ReportEditor
            report={report}
            onCancel={() => setEditing(false)}
            onSaved={(updated) => {
              onUpdated(updated)
              setEditing(false)
            }}
          />
        ) : (
          <ReportContentView content={content} />
        )}
      </div>
    </motion.div>
  )
}

function ApprovalTrail({ report }: { report: StoredReport }) {
  const steps = ["DRAFT", "IN_REVIEW", "APPROVED", "SENT"]
  const currentIndex = steps.indexOf(report.approval_status)

  return (
    <div>
      <div className="flex items-center gap-2">
        {steps.map((step, i) => {
          const reached = currentIndex >= 0 && i <= currentIndex
          return (
            <div key={step} className="flex items-center gap-2 flex-1 last:flex-none">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${reached ? APPROVAL_STYLES[step] : "bg-warm-100 text-warm-400"}`}
              >
                {APPROVAL_LABELS[step]}
              </span>
              {i < steps.length - 1 && (
                <span
                  className={`h-px flex-1 ${currentIndex > i ? "bg-accent/30" : "bg-warm-200"}`}
                />
              )}
            </div>
          )
        })}
      </div>
      {report.approved_at && (
        <p className="text-xs text-warm-400 mt-3">
          Approved {new Date(report.approved_at).toLocaleString()}
          {report.approved_by ? ` by ${report.approved_by}` : ""}
        </p>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Editing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Edits the narrative and bullet sections of a report. Issue-backed item lists
 * are passed through untouched so traceability to Jira keys is never lost.
 */
function ReportEditor({
  report,
  onCancel,
  onSaved,
}: {
  report: StoredReport
  onCancel: () => void
  onSaved: (report: StoredReport) => void
}) {
  const original = effectiveContent(report)

  const [narrative, setNarrative] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const { key } of NARRATIVE_FIELDS) {
      if (typeof original[key] === "string") initial[key] = original[key] as string
    }
    return initial
  })

  const [bullets, setBullets] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const { key } of BULLET_FIELDS) {
      if (Array.isArray(original[key])) initial[key] = asStrings(original[key]).join("\n")
    }
    return initial
  })

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const narrativeFields = NARRATIVE_FIELDS.filter(({ key }) => key in narrative)
  const bulletFields = BULLET_FIELDS.filter(({ key }) => key in bullets)

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      const merged: Record<string, unknown> = { ...original }
      for (const [key, value] of Object.entries(narrative)) {
        merged[key] = value
      }
      for (const [key, value] of Object.entries(bullets)) {
        merged[key] = value
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      }
      onSaved(await api.reports.edit(report.id, merged))
    } catch (err) {
      setError(errorMessage(err, "Failed to save changes"))
    } finally {
      setBusy(false)
    }
  }

  if (narrativeFields.length === 0 && bulletFields.length === 0) {
    return (
      <div>
        <p className="text-sm text-warm-400">
          This report has no editable narrative sections. Issue-backed lists are read-only.
        </p>
        <button
          onClick={onCancel}
          className="mt-4 px-4 py-2 text-sm text-warm-500 bg-warm-100 rounded-xl hover:bg-warm-200 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {narrativeFields.map(({ key, label }) => (
        <div key={key}>
          <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">{label}</label>
          <textarea
            value={narrative[key]}
            onChange={(e) => setNarrative({ ...narrative, [key]: e.target.value })}
            rows={2}
            className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
      ))}

      {bulletFields.map(({ key, label }) => (
        <div key={key}>
          <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">
            {label} <span className="normal-case text-warm-400">(one per line)</span>
          </label>
          <textarea
            value={bullets[key]}
            onChange={(e) => setBullets({ ...bullets, [key]: e.target.value })}
            rows={4}
            className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
      ))}

      {error && <p className="text-sm text-status-blocked bg-status-blocked/5 rounded-lg px-3 py-2">{error}</p>}

      <p className="text-xs text-warm-400">
        Saving stores an edited version alongside the generated one. The original is never overwritten.
      </p>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={busy}
          className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors disabled:opacity-40 cursor-pointer"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Save changes
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="px-4 py-2 text-sm text-warm-500 bg-warm-100 rounded-xl hover:bg-warm-200 transition-colors disabled:opacity-40 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
