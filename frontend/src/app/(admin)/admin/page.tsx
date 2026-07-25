"use client"

import { motion } from "framer-motion"
import { Users, FolderKanban, FileText, Calendar, AlertTriangle, CheckCircle2, XCircle, Brain } from "lucide-react"

const stats = [
  { label: "Active Members", value: "1", icon: Users },
  { label: "Connected Projects", value: "3", icon: FolderKanban },
  { label: "Reports Generated", value: "0", icon: FileText },
  { label: "Active Schedules", value: "0", icon: Calendar },
]

const attention = [
  { type: "info", message: "Demo mode active — connect real Jira for production use" },
]

export default function AdminDashboardPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">Admin Dashboard</h1>
      <p className="text-sm text-warm-500 mb-8">Organization overview</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white rounded-xl border border-warm-200 p-5">
              <div className="w-9 h-9 rounded-lg bg-warm-100 flex items-center justify-center mb-3">
                <Icon className="w-4.5 h-4.5 text-warm-500" />
              </div>
              <p className="text-2xl font-semibold text-charcoal">{stat.value}</p>
              <p className="text-xs text-warm-500 mt-1">{stat.label}</p>
            </motion.div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-warm-200 p-6">
          <h2 className="text-sm font-semibold text-charcoal mb-4">Attention Required</h2>
          {attention.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-status-done"><CheckCircle2 className="w-4 h-4" />All systems operational</div>
          ) : (
            <div className="space-y-2">
              {attention.map((item, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-warm-50 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-status-progress mt-0.5 shrink-0" />
                  <p className="text-sm text-charcoal-light">{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-warm-200 p-6">
          <h2 className="text-sm font-semibold text-charcoal mb-4">Service Status</h2>
          <div className="space-y-2">
            {[
              { name: "Database", status: "Healthy" },
              { name: "AI (Groq)", status: "Healthy" },
              { name: "Jira", status: "Demo Mode" },
              { name: "Scheduler", status: "Healthy" },
            ].map((service) => (
              <div key={service.name} className="flex items-center justify-between py-2">
                <span className="text-sm text-charcoal">{service.name}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${service.status === "Healthy" ? "bg-status-done/10 text-status-done" : "bg-status-progress/10 text-status-progress"}`}>{service.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
