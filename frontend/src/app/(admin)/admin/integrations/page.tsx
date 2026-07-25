"use client"

import { motion } from "framer-motion"
import { Plug, CheckCircle2, XCircle } from "lucide-react"

const integrations = [
  { name: "Jira Cloud", status: "Demo Mode", detail: "3 demo projects", connected: true },
  { name: "Email (Resend)", status: "Not Configured", detail: "Add API key", connected: false },
  { name: "Slack", status: "Not Configured", detail: "Add webhook URL", connected: false },
  { name: "Confluence", status: "Not Configured", detail: "Add credentials", connected: false },
]

export default function AdminIntegrationsPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">Integrations</h1>
      <p className="text-sm text-warm-500 mb-8">Manage connected services</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((intg) => (
          <div key={intg.name} className="bg-white rounded-xl border border-warm-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Plug className="w-5 h-5 text-warm-500" />
                <p className="text-sm font-medium text-charcoal">{intg.name}</p>
              </div>
              {intg.connected ? <CheckCircle2 className="w-4 h-4 text-status-done" /> : <XCircle className="w-4 h-4 text-warm-300" />}
            </div>
            <p className="text-xs text-warm-400 mb-3">{intg.detail}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${intg.connected ? "bg-status-done/10 text-status-done" : "bg-warm-100 text-warm-500"}`}>{intg.status}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
