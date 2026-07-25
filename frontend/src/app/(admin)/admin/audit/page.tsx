"use client"

import { motion } from "framer-motion"
import { Shield } from "lucide-react"

export default function AdminAuditPage() {
  const logs = [
    { event: "USER_SIGNED_IN", actor: "Current User", time: "Just now", detail: "Signed in" },
    { event: "ORGANIZATION_CREATED", actor: "System", time: "On setup", detail: "Acme Digital created" },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">Audit Logs</h1>
      <p className="text-sm text-warm-500 mb-8">Organization activity history</p>

      <div className="bg-white rounded-xl border border-warm-200">
        <div className="grid grid-cols-4 px-5 py-3 border-b border-warm-100 text-xs font-medium text-warm-500 uppercase tracking-wide">
          <span>Event</span><span>Actor</span><span>Time</span><span>Detail</span>
        </div>
        {logs.map((log, i) => (
          <div key={i} className="grid grid-cols-4 px-5 py-3 border-b border-warm-50 text-sm">
            <span className="font-mono text-xs text-charcoal">{log.event}</span>
            <span className="text-warm-600">{log.actor}</span>
            <span className="text-warm-400">{log.time}</span>
            <span className="text-warm-500">{log.detail}</span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-center py-12">
            <Shield className="w-8 h-8 text-warm-300 mx-auto mb-3" />
            <p className="text-sm text-warm-500">No audit events yet</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
