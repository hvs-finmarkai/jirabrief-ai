"use client"

import { useCallback, useState } from "react"
import { motion } from "framer-motion"
import {
  Calendar,
  Plus,
  Clock,
  Repeat,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Pencil,
} from "lucide-react"
import {
  api,
  canManageOrganization,
  errorMessage,
  type JiraProject,
  type OrganizationMember,
  type Profile,
  type Schedule,
  type ScheduleFrequency,
} from "@/lib/api"
import { useAsyncData } from "@/lib/use-async-data"
import {
  EmptyState,
  ErrorState,
  JiraRequiredNotice,
  LoadingRows,
  NoOrganizationState,
} from "@/components/page-states"

/**
 * Matches `MAX_CONSECUTIVE_FAILURES` in app/scheduler/runner.py — the runner
 * disables a schedule once it has failed this many times in a row.
 */
const MAX_CONSECUTIVE_FAILURES = 5

const FREQ_LABELS: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" }

const TYPE_LABELS: Record<string, string> = {
  SPRINT_SUMMARY: "Sprint Summary",
  STATUS_REPORT: "Status Report",
  EXECUTIVE_DIGEST: "Executive Digest",
  RELEASE_NOTES: "Release Notes",
}

/** `calculate_next_run` uses `datetime.weekday()`, so 0 is Monday. */
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern (US)" },
  { value: "America/Los_Angeles", label: "Pacific (US)" },
  { value: "Europe/London", label: "London" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Tokyo", label: "Tokyo" },
]

const INPUT_CLASS =
  "mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
const SELECT_CLASS = `${INPUT_CLASS} cursor-pointer`
const LABEL_CLASS = "text-xs font-medium text-warm-600 uppercase tracking-wide"

interface SchedulesData {
  schedules: Schedule[]
  /** `null` when Jira is not connected or could not be reached. */
  projects: JiraProject[] | null
  profile: Profile
  members: OrganizationMember[]
}

/** The timing fields a schedule's edit form can change (PUT /api/schedules/{id}). */
interface TimingForm {
  frequency: ScheduleFrequency
  day_of_week: number
  day_of_month: number
  time_of_day: string
  timezone: string
  require_approval: boolean
}

function describeCadence(schedule: Schedule | TimingForm): string {
  if (schedule.frequency === "weekly") {
    const day = DAY_LABELS[schedule.day_of_week ?? 0] ?? DAY_LABELS[0]
    return `Weekly on ${day}`
  }
  if (schedule.frequency === "monthly") {
    return `Monthly on day ${schedule.day_of_month ?? 1}`
  }
  return "Daily"
}

export default function SchedulesPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const fetcher = useCallback(async (): Promise<SchedulesData> => {
    const [schedules, connection, profile, members] = await Promise.all([
      api.schedules.list(),
      api.jira.getConnection().catch(() => null),
      api.auth.me(),
      api.organizations.listMembers(),
    ])

    // Projects are only reachable through a live Jira connection; a failure
    // here must not stop existing schedules from rendering.
    const projects = connection ? await api.jira.getProjects().catch(() => null) : null

    return { schedules, projects, profile, members }
  }, [])

  const { data, loading, error, missingOrg, reload, setData } = useAsyncData(
    fetcher,
    "Failed to load schedules"
  )

  const schedules = data?.schedules ?? []
  const projects = data?.projects ?? null
  const role = data ? data.members.find((m) => m.user_id === data.profile.user_id)?.role ?? null : null
  const canDelete = canManageOrganization(role)

  function replaceSchedule(updated: Schedule) {
    setData((prev) =>
      prev
        ? { ...prev, schedules: prev.schedules.map((s) => (s.id === updated.id ? updated : s)) }
        : prev
    )
  }

  async function handleToggle(schedule: Schedule) {
    setBusyId(schedule.id)
    setActionError(null)
    try {
      replaceSchedule(await api.schedules.update(schedule.id, { enabled: !schedule.enabled }))
    } catch (err) {
      setActionError(errorMessage(err, "Failed to update schedule"))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(schedule: Schedule) {
    setBusyId(schedule.id)
    setActionError(null)
    try {
      await api.schedules.remove(schedule.id)
      setData((prev) =>
        prev ? { ...prev, schedules: prev.schedules.filter((s) => s.id !== schedule.id) } : prev
      )
    } catch (err) {
      setActionError(errorMessage(err, "Failed to delete schedule"))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-charcoal mb-1">Schedules</h1>
          <p className="text-sm text-warm-500">Automate report generation and delivery</p>
        </div>
        {!loading && !error && !missingOrg && (
          <button
            onClick={() => {
              setShowCreate(true)
              setActionError(null)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Schedule
          </button>
        )}
      </div>

      {missingOrg ? (
        <NoOrganizationState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <LoadingRows rows={3} />
      ) : (
        <>
          {showCreate && (
            <CreateScheduleForm
              projects={projects}
              onCancel={() => setShowCreate(false)}
              onCreated={(schedule) => {
                setData((prev) =>
                  prev ? { ...prev, schedules: [schedule, ...prev.schedules] } : prev
                )
                setShowCreate(false)
              }}
            />
          )}

          {actionError && (
            <p className="text-sm text-status-blocked bg-status-blocked/5 rounded-lg px-3 py-2 mb-4">
              {actionError}
            </p>
          )}

          {schedules.length === 0 && !showCreate ? (
            <EmptyState
              icon={Calendar}
              title="No Schedules"
              description="Create a schedule to automate report generation"
            />
          ) : (
            <div className="space-y-2">
              {schedules.map((schedule) =>
                editingId === schedule.id ? (
                  <EditScheduleForm
                    key={schedule.id}
                    schedule={schedule}
                    onCancel={() => setEditingId(null)}
                    onSaved={(updated) => {
                      replaceSchedule(updated)
                      setEditingId(null)
                    }}
                  />
                ) : (
                  <ScheduleRow
                    key={schedule.id}
                    schedule={schedule}
                    busy={busyId === schedule.id}
                    canDelete={canDelete}
                    onEdit={() => {
                      setEditingId(schedule.id)
                      setActionError(null)
                    }}
                    onToggle={() => handleToggle(schedule)}
                    onDelete={() => handleDelete(schedule)}
                  />
                )
              )}
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/* Row                                                                         */
/* -------------------------------------------------------------------------- */

function ScheduleRow({
  schedule,
  busy,
  canDelete,
  onEdit,
  onToggle,
  onDelete,
}: {
  schedule: Schedule
  busy: boolean
  canDelete: boolean
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const autoDisabled = !schedule.enabled && schedule.failure_count >= MAX_CONSECUTIVE_FAILURES
  const failing = schedule.enabled && schedule.failure_count > 0

  return (
    <div className="p-4 bg-white rounded-xl border border-warm-200">
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 rounded-lg bg-warm-100 flex items-center justify-center shrink-0">
          <Repeat className="w-4 h-4 text-warm-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-charcoal truncate">
            {schedule.project_name} — {TYPE_LABELS[schedule.report_type] || schedule.report_type}
          </p>
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-0.5">
            <span className="text-xs text-warm-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {describeCadence(schedule)} at {schedule.time_of_day} {schedule.timezone}
            </span>
            {schedule.enabled && schedule.next_run_at && (
              <span className="text-xs text-warm-400">
                Next: {new Date(schedule.next_run_at).toLocaleString()}
              </span>
            )}
            {schedule.last_run_at && (
              <span className="text-xs text-warm-400">
                Last: {new Date(schedule.last_run_at).toLocaleString()}
              </span>
            )}
            {schedule.last_run_status && (
              <span
                className={`text-xs font-medium flex items-center gap-1 ${schedule.last_run_status === "SUCCESS" ? "text-status-done" : "text-status-blocked"}`}
              >
                {schedule.last_run_status === "SUCCESS" ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                {schedule.last_run_status}
              </span>
            )}
            {schedule.require_approval && (
              <span className="text-xs text-warm-400">Needs approval</span>
            )}
          </div>
        </div>

        <button
          onClick={onEdit}
          disabled={busy}
          className="p-1.5 text-warm-400 hover:text-charcoal transition-colors rounded-md hover:bg-warm-50 disabled:opacity-40 cursor-pointer"
          title="Edit schedule"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onToggle}
          disabled={busy}
          className="disabled:opacity-40 cursor-pointer"
          title={schedule.enabled ? "Disable" : "Enable"}
        >
          {busy ? (
            <Loader2 className="w-6 h-6 text-warm-400 animate-spin" />
          ) : schedule.enabled ? (
            <ToggleRight className="w-6 h-6 text-status-done" />
          ) : (
            <ToggleLeft className="w-6 h-6 text-warm-300" />
          )}
        </button>
        {canDelete && (
          <button
            onClick={onDelete}
            disabled={busy}
            className="p-1.5 text-warm-400 hover:text-status-blocked transition-colors rounded-md hover:bg-status-blocked/5 disabled:opacity-40 cursor-pointer"
            title="Delete schedule"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {autoDisabled && (
        <div className="mt-3 px-3 py-2 bg-status-blocked/5 border border-status-blocked/20 rounded-lg">
          <p className="text-xs text-status-blocked flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>
              Automatically disabled after {schedule.failure_count} consecutive failures. Fix the
              underlying issue, then re-enable it — re-enabling clears the failure count and gives
              it a clean slate.
            </span>
          </p>
        </div>
      )}

      {failing && (
        <div className="mt-3 px-3 py-2 bg-status-progress/5 border border-status-progress/20 rounded-lg">
          <p className="text-xs text-status-progress flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>
              {schedule.failure_count} consecutive{" "}
              {schedule.failure_count === 1 ? "failure" : "failures"}. This schedule is disabled
              automatically after {MAX_CONSECUTIVE_FAILURES}.
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Create                                                                      */
/* -------------------------------------------------------------------------- */

function CreateScheduleForm({
  projects,
  onCancel,
  onCreated,
}: {
  projects: JiraProject[] | null
  onCancel: () => void
  onCreated: (schedule: Schedule) => void
}) {
  const [projectKey, setProjectKey] = useState(projects?.[0]?.key ?? "")
  const [reportType, setReportType] = useState("SPRINT_SUMMARY")
  const [timing, setTiming] = useState<TimingForm>({
    frequency: "weekly",
    day_of_week: 0,
    day_of_month: 1,
    time_of_day: "09:00",
    timezone: "UTC",
    require_approval: false,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasProjects = projects !== null && projects.length > 0

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const project = projects?.find((p) => p.key === projectKey)
    if (!project) {
      setError("Select a Jira project")
      return
    }

    setBusy(true)
    setError(null)
    try {
      onCreated(
        await api.schedules.create({
          project_key: project.key,
          project_name: project.name,
          report_type: reportType,
          frequency: timing.frequency,
          day_of_week: timing.frequency === "weekly" ? timing.day_of_week : null,
          day_of_month: timing.frequency === "monthly" ? timing.day_of_month : null,
          time_of_day: timing.time_of_day,
          timezone: timing.timezone,
          require_approval: timing.require_approval,
        })
      )
    } catch (err) {
      setError(errorMessage(err, "Failed to create schedule"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-warm-200 p-6 mb-6"
    >
      <h3 className="text-sm font-semibold text-charcoal mb-4">Create Schedule</h3>

      {!hasProjects ? (
        <JiraRequiredNotice
          message="A schedule runs against a Jira project, so Jira needs to be connected before you can create one."
          onCancel={onCancel}
        />
      ) : (
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLASS}>Project</label>
            <select
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value)}
              required
              className={SELECT_CLASS}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.key}>
                  {project.name} ({project.key})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL_CLASS}>Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className={SELECT_CLASS}
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <TimingFields timing={timing} onChange={setTiming} />

          {error && (
            <p className="sm:col-span-2 text-sm text-status-blocked bg-status-blocked/5 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors disabled:opacity-40 cursor-pointer"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Create
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
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
/* Edit                                                                        */
/* -------------------------------------------------------------------------- */

function EditScheduleForm({
  schedule,
  onCancel,
  onSaved,
}: {
  schedule: Schedule
  onCancel: () => void
  onSaved: (schedule: Schedule) => void
}) {
  const [timing, setTiming] = useState<TimingForm>({
    frequency: schedule.frequency,
    day_of_week: schedule.day_of_week ?? 0,
    day_of_month: schedule.day_of_month ?? 1,
    time_of_day: schedule.time_of_day,
    timezone: schedule.timezone,
    require_approval: schedule.require_approval,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onSaved(
        await api.schedules.update(schedule.id, {
          frequency: timing.frequency,
          day_of_week: timing.frequency === "weekly" ? timing.day_of_week : undefined,
          day_of_month: timing.frequency === "monthly" ? timing.day_of_month : undefined,
          time_of_day: timing.time_of_day,
          timezone: timing.timezone,
          require_approval: timing.require_approval,
        })
      )
    } catch (err) {
      setError(errorMessage(err, "Failed to update schedule"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-accent/30 p-6"
    >
      <h3 className="text-sm font-semibold text-charcoal mb-1">
        Edit {schedule.project_name} — {TYPE_LABELS[schedule.report_type] || schedule.report_type}
      </h3>
      <p className="text-xs text-warm-400 mb-4">
        The project and report type are fixed once a schedule exists. Delete and recreate it to
        change those.
      </p>

      <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TimingFields timing={timing} onChange={setTiming} />

        {error && (
          <p className="sm:col-span-2 text-sm text-status-blocked bg-status-blocked/5 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="sm:col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors disabled:opacity-40 cursor-pointer"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Save changes
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm text-warm-500 bg-warm-100 rounded-xl hover:bg-warm-200 transition-colors disabled:opacity-40 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/* Shared timing fields                                                        */
/* -------------------------------------------------------------------------- */

function TimingFields({
  timing,
  onChange,
}: {
  timing: TimingForm
  onChange: (timing: TimingForm) => void
}) {
  return (
    <>
      <div>
        <label className={LABEL_CLASS}>Frequency</label>
        <select
          value={timing.frequency}
          onChange={(e) => onChange({ ...timing, frequency: e.target.value as ScheduleFrequency })}
          className={SELECT_CLASS}
        >
          {Object.entries(FREQ_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {timing.frequency === "weekly" && (
        <div>
          <label className={LABEL_CLASS}>Day of Week</label>
          <select
            value={timing.day_of_week}
            onChange={(e) => onChange({ ...timing, day_of_week: Number(e.target.value) })}
            className={SELECT_CLASS}
          >
            {DAY_LABELS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      {timing.frequency === "monthly" && (
        <div>
          <label className={LABEL_CLASS}>Day of Month</label>
          <select
            value={timing.day_of_month}
            onChange={(e) => onChange({ ...timing, day_of_month: Number(e.target.value) })}
            className={SELECT_CLASS}
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={LABEL_CLASS}>Time</label>
        <input
          type="time"
          value={timing.time_of_day}
          onChange={(e) => onChange({ ...timing, time_of_day: e.target.value })}
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <label className={LABEL_CLASS}>Timezone</label>
        <select
          value={timing.timezone}
          onChange={(e) => onChange({ ...timing, timezone: e.target.value })}
          className={SELECT_CLASS}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2 flex items-center gap-2">
        <input
          id="require-approval"
          type="checkbox"
          checked={timing.require_approval}
          onChange={(e) => onChange({ ...timing, require_approval: e.target.checked })}
          className="w-4 h-4 rounded border-warm-300 accent-accent cursor-pointer"
        />
        <label htmlFor="require-approval" className="text-sm text-charcoal-light cursor-pointer">
          Hold for approval before delivering
        </label>
      </div>
    </>
  )
}
