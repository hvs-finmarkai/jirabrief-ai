"use client"

import { motion } from "framer-motion"
import { FileCode2, FileText, BarChart3, Briefcase, Tag } from "lucide-react"

const templates = [
  { name: "Sprint Summary", type: "SPRINT_SUMMARY", tone: "Concise", icon: FileText, sections: "Completed, In Progress, Blockers, Slipped, Next Work" },
  { name: "Status Report", type: "STATUS_REPORT", tone: "Concise", icon: BarChart3, sections: "Current State, Progress, Completed, Current, Blockers, Risks, Next Actions" },
  { name: "Executive Digest", type: "EXECUTIVE_DIGEST", tone: "Executive", icon: Briefcase, sections: "Overall Status, Highlights, Risks, Impact, Management Asks" },
  { name: "Release Notes", type: "RELEASE_NOTES", tone: "Detailed", icon: Tag, sections: "New Functionality, Improvements, Fixes" },
]

export default function TemplatesPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">Templates</h1>
      <p className="text-sm text-warm-500 mb-8">System report templates</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((t, i) => {
          const Icon = t.icon
          return (
            <motion.div
              key={t.type}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl border border-warm-200 p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Icon className="w-4.5 h-4.5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-charcoal">{t.name}</p>
                  <p className="text-xs text-warm-400">Tone: {t.tone}</p>
                </div>
              </div>
              <p className="text-xs text-warm-500">{t.sections}</p>
              <div className="mt-3 pt-3 border-t border-warm-100 flex items-center justify-between">
                <span className="text-xs text-warm-400 flex items-center gap-1"><FileCode2 className="w-3 h-3" />System Template</span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
