"use client"

import { motion } from "framer-motion"
import { BarChart3, FileText, Calendar, AlertTriangle } from "lucide-react"

const stats = [
  { label: "Connected Projects", value: "0", icon: BarChart3 },
  { label: "Reports This Month", value: "0", icon: FileText },
  { label: "Scheduled Reports", value: "0", icon: Calendar },
  { label: "Attention Items", value: "0", icon: AlertTriangle },
]

export default function DashboardPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">Overview</h1>
      <p className="text-sm text-warm-500 mb-8">Your reporting dashboard</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => {
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
              <p className="text-2xl font-semibold text-charcoal">{stat.value}</p>
              <p className="text-xs text-warm-500 mt-1">{stat.label}</p>
            </motion.div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-warm-200 p-6">
          <h2 className="text-sm font-semibold text-charcoal mb-4">Recent Reports</h2>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="w-8 h-8 text-warm-300 mb-3" />
            <p className="text-sm text-warm-500">No reports yet</p>
            <p className="text-xs text-warm-400 mt-1">Generate your first report after connecting Jira</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-warm-200 p-6">
          <h2 className="text-sm font-semibold text-charcoal mb-4">Jira Sync Health</h2>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <BarChart3 className="w-8 h-8 text-warm-300 mb-3" />
            <p className="text-sm text-warm-500">No Jira connected</p>
            <p className="text-xs text-warm-400 mt-1">Connect Jira in Integrations to get started</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
