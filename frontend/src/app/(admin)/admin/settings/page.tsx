"use client"

import { motion } from "framer-motion"
import { Settings } from "lucide-react"

export default function AdminSettingsPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">Organization Settings</h1>
      <p className="text-sm text-warm-500 mb-8">General organization configuration</p>

      <div className="bg-white rounded-xl border border-warm-200 p-6 space-y-5">
        <div>
          <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Organization Name</label>
          <input type="text" defaultValue="Acme Digital" className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
        </div>
        <div>
          <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Default Timezone</label>
          <select defaultValue="UTC" className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm cursor-pointer">
            <option value="UTC">UTC</option>
            <option value="America/New_York">Eastern (US)</option>
            <option value="America/Los_Angeles">Pacific (US)</option>
            <option value="Europe/London">London</option>
            <option value="Asia/Kolkata">India (IST)</option>
            <option value="Asia/Tokyo">Tokyo</option>
          </select>
        </div>
        <button className="px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light cursor-pointer">Save</button>
      </div>

      <div className="mt-8 bg-white rounded-xl border border-status-blocked/20 p-6">
        <h3 className="text-sm font-semibold text-status-blocked mb-2">Danger Zone</h3>
        <p className="text-xs text-warm-500 mb-4">These actions are irreversible. Only the organization Owner can perform them.</p>
        <button className="px-4 py-2 text-sm text-status-blocked bg-status-blocked/5 border border-status-blocked/20 rounded-xl font-medium hover:bg-status-blocked/10 cursor-pointer">Delete Organization</button>
      </div>
    </motion.div>
  )
}
