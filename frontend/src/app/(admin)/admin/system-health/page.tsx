"use client"

import { motion } from "framer-motion"
import { Activity, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"

const services = [
  { name: "Database (Supabase)", status: "Healthy", detail: "PostgreSQL connected" },
  { name: "API Server", status: "Healthy", detail: "FastAPI running" },
  { name: "AI Provider (Groq)", status: "Healthy", detail: "llama-3.1-8b-instant" },
  { name: "Jira Integration", status: "Demo Mode", detail: "Connect real Jira in Integrations" },
  { name: "Email (Resend)", status: "Not Configured", detail: "Add RESEND_API_KEY" },
  { name: "Slack", status: "Not Configured", detail: "Add webhook in Integrations" },
  { name: "Confluence", status: "Not Configured", detail: "Add credentials in Integrations" },
  { name: "Scheduler", status: "Healthy", detail: "Background processing active" },
]

function StatusIcon({ status }: { status: string }) {
  if (status === "Healthy") return <CheckCircle2 className="w-4 h-4 text-status-done" />
  if (status === "Not Configured") return <XCircle className="w-4 h-4 text-warm-400" />
  return <AlertTriangle className="w-4 h-4 text-status-progress" />
}

export default function AdminSystemHealthPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">System Health</h1>
      <p className="text-sm text-warm-500 mb-8">Operational status of all services</p>

      <div className="bg-white rounded-xl border border-warm-200">
        {services.map((s, i) => (
          <div key={s.name} className={`flex items-center gap-4 px-5 py-4 ${i < services.length - 1 ? "border-b border-warm-50" : ""}`}>
            <StatusIcon status={s.status} />
            <div className="flex-1">
              <p className="text-sm font-medium text-charcoal">{s.name}</p>
              <p className="text-xs text-warm-400">{s.detail}</p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.status === "Healthy" ? "bg-status-done/10 text-status-done" : s.status === "Not Configured" ? "bg-warm-100 text-warm-500" : "bg-status-progress/10 text-status-progress"}`}>{s.status}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
