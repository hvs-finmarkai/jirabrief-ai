"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Calendar, Plus, Clock, Repeat, ToggleLeft, ToggleRight, Trash2 } from "lucide-react"

interface ScheduleItem {
  id: string
  project_name: string
  report_type: string
  frequency: string
  time_of_day: string
  timezone: string
  enabled: boolean
  next_run_at: string | null
  last_run_status: string | null
}

const FREQ_LABELS: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" }
const TYPE_LABELS: Record<string, string> = { SPRINT_SUMMARY: "Sprint Summary", STATUS_REPORT: "Status Report", EXECUTIVE_DIGEST: "Executive Digest", RELEASE_NOTES: "Release Notes" }

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [reportType, setReportType] = useState("SPRINT_SUMMARY")
  const [frequency, setFrequency] = useState("weekly")
  const [timeOfDay, setTimeOfDay] = useState("09:00")
  const [tz, setTz] = useState("UTC")

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const newSchedule: ScheduleItem = {
      id: crypto.randomUUID(),
      project_name: projectName,
      report_type: reportType,
      frequency,
      time_of_day: timeOfDay,
      timezone: tz,
      enabled: true,
      next_run_at: new Date(Date.now() + 86400000).toISOString(),
      last_run_status: null,
    }
    setSchedules([newSchedule, ...schedules])
    setShowCreate(false)
    setProjectName("")
  }

  function toggleEnabled(id: string) {
    setSchedules(schedules.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  function deleteSchedule(id: string) {
    setSchedules(schedules.filter((s) => s.id !== id))
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-charcoal mb-1">Schedules</h1>
          <p className="text-sm text-warm-500">Automate report generation and delivery</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors cursor-pointer">
          <Plus className="w-4 h-4" />New Schedule
        </button>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl border border-warm-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-charcoal mb-4">Create Schedule</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Project Name</label>
              <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} required placeholder="CRM Migration" className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Report Type</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer">
                <option value="SPRINT_SUMMARY">Sprint Summary</option>
                <option value="STATUS_REPORT">Status Report</option>
                <option value="EXECUTIVE_DIGEST">Executive Digest</option>
                <option value="RELEASE_NOTES">Release Notes</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Frequency</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Time</label>
              <input type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Timezone</label>
              <select value={tz} onChange={(e) => setTz(e.target.value)} className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer">
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern (US)</option>
                <option value="America/Los_Angeles">Pacific (US)</option>
                <option value="Europe/London">London</option>
                <option value="Asia/Kolkata">India (IST)</option>
                <option value="Asia/Tokyo">Tokyo</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors cursor-pointer">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-warm-500 bg-warm-100 rounded-xl hover:bg-warm-200 transition-colors cursor-pointer">Cancel</button>
            </div>
          </form>
        </motion.div>
      )}

      {schedules.length === 0 && !showCreate ? (
        <div className="bg-white rounded-xl border border-warm-200 p-12 text-center">
          <Calendar className="w-10 h-10 text-warm-300 mx-auto mb-4" />
          <p className="text-sm text-warm-500 font-medium">No Schedules</p>
          <p className="text-xs text-warm-400 mt-1">Create a schedule to automate report generation</p>
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => (
            <div key={s.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-warm-200">
              <div className="w-9 h-9 rounded-lg bg-warm-100 flex items-center justify-center">
                <Repeat className="w-4 h-4 text-warm-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-charcoal">{s.project_name} — {TYPE_LABELS[s.report_type]}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-warm-400 flex items-center gap-1"><Clock className="w-3 h-3" />{FREQ_LABELS[s.frequency]} at {s.time_of_day} {s.timezone}</span>
                  {s.next_run_at && <span className="text-xs text-warm-400">Next: {new Date(s.next_run_at).toLocaleDateString()}</span>}
                </div>
              </div>
              <button onClick={() => toggleEnabled(s.id)} className="cursor-pointer" title={s.enabled ? "Disable" : "Enable"}>
                {s.enabled ? <ToggleRight className="w-6 h-6 text-status-done" /> : <ToggleLeft className="w-6 h-6 text-warm-300" />}
              </button>
              <button onClick={() => deleteSchedule(s.id)} className="p-1.5 text-warm-400 hover:text-status-blocked transition-colors rounded-md hover:bg-status-blocked/5 cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
