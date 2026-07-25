"use client"

import { motion } from "framer-motion"
import { FileText } from "lucide-react"

export default function AdminReportSettingsPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">Report Settings</h1>
      <p className="text-sm text-warm-500 mb-8">Organization-wide report defaults</p>

      <div className="bg-white rounded-xl border border-warm-200 p-6 space-y-5">
        <div>
          <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Default Tone</label>
          <select defaultValue="concise" className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm cursor-pointer">
            <option value="concise">Concise</option>
            <option value="executive">Executive</option>
            <option value="detailed">Detailed</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Require Quality Validation</label>
          <div className="mt-2 flex items-center gap-2">
            <input type="checkbox" defaultChecked className="rounded border-warm-300 text-accent focus:ring-accent" />
            <span className="text-sm text-charcoal">Reports must pass quality validation before marking as Ready</span>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Require Approval Before Delivery</label>
          <div className="mt-2 flex items-center gap-2">
            <input type="checkbox" className="rounded border-warm-300 text-accent focus:ring-accent" />
            <span className="text-sm text-charcoal">Scheduled reports require approval before sending</span>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Organization Instructions</label>
          <textarea placeholder="e.g., Focus on client dependencies and delivery risks..." className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-accent/20" />
          <p className="text-xs text-warm-400 mt-1">Applied to all reports. Cannot override security or factuality rules.</p>
        </div>
        <button className="px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light cursor-pointer">Save Settings</button>
      </div>
    </motion.div>
  )
}
