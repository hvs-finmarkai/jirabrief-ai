"use client"

import { motion } from "framer-motion"
import { Plug } from "lucide-react"

export default function IntegrationsPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">Integrations</h1>
      <p className="text-sm text-warm-500 mb-8">Connect external services</p>

      <div className="bg-white rounded-xl border border-warm-200 p-12 text-center">
        <Plug className="w-10 h-10 text-warm-300 mx-auto mb-4" />
        <p className="text-sm text-warm-500 font-medium">No Integrations Connected</p>
        <p className="text-xs text-warm-400 mt-1">Connect Jira, Slack, or email for report delivery</p>
      </div>
    </motion.div>
  )
}
