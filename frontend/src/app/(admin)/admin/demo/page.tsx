"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, RefreshCw, Loader2 } from "lucide-react"

export default function AdminDemoPage() {
  const [resetting, setResetting] = useState(false)
  const [done, setDone] = useState(false)

  function handleReset() {
    setResetting(true)
    setTimeout(() => { setResetting(false); setDone(true); setTimeout(() => setDone(false), 3000) }, 1000)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">Demo Management</h1>
      <p className="text-sm text-warm-500 mb-8">Manage the demo workspace</p>

      <div className="bg-white rounded-xl border border-warm-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-5 h-5 text-accent" />
          <div>
            <p className="text-sm font-medium text-charcoal">Demo Workspace — Acme Digital</p>
            <p className="text-xs text-warm-400">3 projects, 4 sprints, ~20 issues with realistic data</p>
          </div>
        </div>

        <p className="text-sm text-warm-500 mb-4">Reset clears all generated demo reports. Demo seed data (projects, sprints, issues) is rebuilt automatically. This never affects real customer data.</p>

        {done && <p className="text-sm text-status-done mb-4">Demo data reset successfully ✓</p>}

        <button onClick={handleReset} disabled={resetting} className="flex items-center gap-2 px-4 py-2 bg-status-blocked/10 text-status-blocked border border-status-blocked/20 rounded-xl text-sm font-medium hover:bg-status-blocked/15 disabled:opacity-50 cursor-pointer">
          {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Reset Demo Data
        </button>
      </div>
    </motion.div>
  )
}
