"use client"

import { useCallback } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { BarChart3, FileText, Calendar, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react"
import { api, type JiraConnection, type StoredReport } from "@/lib/api"
import { useAsyncData } from "@/lib/use-async-data"
import { ErrorState, LoadingCards, LoadingRows, NoOrganizationState } from "@/components/page-states"

const TYPE_LABELS: Record<string, string> = {
  SPRINT_SUMMARY: "Sprint Summary",
  STATUS_REPORT: "Status Report",
  EXECUTIVE_DIGEST: "Executive Digest",
  RELEASE_NOTES: "Release Notes",
}

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

/** `null` means that widget's endpoint failed — render "—" rather than a wrong 0. */
interface DashboardData {
  reports: StoredReport[] | null
  scheduleCount: number | null
  projectCount: number | null
  attentionCount: number | null
  connection: JiraConnection | null
}

function startOfMonth(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
}

export default function DashboardPage() {
  const fetcher = useCallback(async (): Promise<DashboardData> => {
    // Resolve the org first so "no organization" surfaces once, cleanly.
    const connection = await api.jira.getConnection()

    // One failing widget must not blank the whole dashboard.
    const [reportsResult, schedulesResult, notificationsResult, projectsResult] =
      await Promise.allSettled([
        api.reports.list({ limit: 100 }),
        api.schedules.list(),
        api.notifications.list(true),
        connection ? api.jira.getProjects() : Promise.resolve([]),
      ])

    return {
      connection,
      reports: reportsResult.status === "fulfilled" ? reportsResult.value : null,
      scheduleCount: schedulesResult.status === "fulfilled" ? schedulesResult.value.length : null,
      attentionCount:
        notificationsResult.status === "fulfilled" ? notificationsResult.value.length : null,
      projectCount: projectsResult.status === "fulfilled" ? projectsResult.value.length : null,
    }
  }, [])

  const { data, loading, error, missingOrg, reload } = useAsyncData(
    fetcher,
    "Failed to load your dashboard"
  )

  const partial =
    data !== null &&
    [data.reports, data.scheduleCount, data.attentionCount, data.projectCount].some(
      (value) => value === null
    )

  const reports = data?.reports ?? []
  const reportsThisMonth =
    data?.reports === null || data?.reports === undefined
      ? null
      : data.reports.filter((r) => new Date(r.generated_at).getTime() >= startOfMonth()).length

  const stats = [
    { label: "Connected Projects", value: data?.projectCount ?? null, icon: BarChart3 },
    { label: "Reports This Month", value: reportsThisMonth, icon: FileText },
    { label: "Scheduled Reports", value: data?.scheduleCount ?? null, icon: Calendar },
    { label: "Attention Items", value: data?.attentionCount ?? null, icon: AlertTriangle },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">Overview</h1>
      <p className="text-sm text-warm-500 mb-8">Your reporting dashboard</p>

      {missingOrg ? (
        <NoOrganizationState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          {partial && !loading && (
            <div className="flex items-center justify-between gap-3 mb-6 px-4 py-3 bg-status-progress/5 border border-status-progress/20 rounded-xl">
              <p className="text-xs text-status-progress">Some dashboard data could not be loaded.</p>
              <button onClick={reload} className="text-xs text-accent hover:text-accent-hover cursor-pointer">
                Retry
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {loading ? (
              <LoadingCards cards={4} />
            ) : (
              stats.map((stat, i) => {
                const Icon = stat.icon
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white rounded-xl border border-warm-200 p-5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-warm-100 flex items-center justify-center">
                        <Icon className="w-4.5 h-4.5 text-warm-500" />
                      </div>
                    </div>
                    <p className="text-2xl font-semibold text-charcoal">
                      {stat.value === null ? "—" : stat.value}
                    </p>
                    <p className="text-xs text-warm-500 mt-1">{stat.label}</p>
                  </motion.div>
                )
              })
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-warm-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-charcoal">Recent Reports</h2>
                {reports.length > 0 && (
                  <Link href="/reports" className="text-xs text-accent hover:text-accent-hover">
                    View all
                  </Link>
                )}
              </div>

              {loading ? (
                <LoadingRows rows={3} />
              ) : data?.reports === null ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="w-8 h-8 text-warm-300 mb-3" />
                  <p className="text-sm text-warm-500">Reports unavailable</p>
                  <p className="text-xs text-warm-400 mt-1">The reports service did not respond</p>
                </div>
              ) : reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="w-8 h-8 text-warm-300 mb-3" />
                  <p className="text-sm text-warm-500">No reports yet</p>
                  <p className="text-xs text-warm-400 mt-1">
                    {data?.connection
                      ? "Generate your first report from a connected project"
                      : "Generate your first report after connecting Jira"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reports.slice(0, 5).map((report, i) => (
                    <motion.div
                      key={report.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-3 p-3 rounded-lg border border-warm-100 hover:border-warm-200 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-warm-100 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-warm-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-charcoal truncate">{report.title}</p>
                        <p className="text-xs text-warm-400 mt-0.5">
                          {report.project_key} · {TYPE_LABELS[report.report_type] || report.report_type} ·{" "}
                          {new Date(report.generated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${APPROVAL_STYLES[report.approval_status] || APPROVAL_STYLES.DRAFT}`}
                      >
                        {APPROVAL_LABELS[report.approval_status] || report.approval_status}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-warm-200 p-6">
              <h2 className="text-sm font-semibold text-charcoal mb-4">Jira Sync Health</h2>

              {loading ? (
                <LoadingRows rows={2} />
              ) : !data?.connection ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <BarChart3 className="w-8 h-8 text-warm-300 mb-3" />
                  <p className="text-sm text-warm-500">No Jira connected</p>
                  <p className="text-xs text-warm-400 mt-1">Connect Jira in Integrations to get started</p>
                  <Link
                    href="/integrations"
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors"
                  >
                    Connect Jira
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-warm-50 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">
                        {data.connection.connection_name}
                      </p>
                      <p className="text-xs text-warm-400 truncate">{data.connection.jira_site_url}</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-status-done font-medium shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {data.connection.status === "active" ? "Connected" : data.connection.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-warm-50 rounded-lg">
                      <p className="text-lg font-semibold text-charcoal">
                        {data.projectCount === null ? "—" : data.projectCount}
                      </p>
                      <p className="text-xs text-warm-400">Projects visible</p>
                    </div>
                    <div className="p-3 bg-warm-50 rounded-lg">
                      <p className="text-sm font-medium text-charcoal">
                        {data.connection.last_connected_at
                          ? new Date(data.connection.last_connected_at).toLocaleDateString()
                          : "Never"}
                      </p>
                      <p className="text-xs text-warm-400">Last connected</p>
                    </div>
                  </div>
                  {data.projectCount === null && (
                    <p className="text-xs text-status-progress">
                      Could not reach Jira to list projects. Check the connection in Integrations.
                    </p>
                  )}
                  <Link href="/projects" className="inline-block text-xs text-accent hover:text-accent-hover">
                    View projects
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}
