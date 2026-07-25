"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { FolderKanban, RefreshCw, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/api"

interface Project {
  id: string
  key: string
  name: string
  jira_project_id: string
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    setLoading(true)
    try {
      const data = await api.demo.getProjects()
      setProjects(data)
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  const healthMap: Record<string, { label: string; className: string }> = {
    CRM: { label: "Needs Attention", className: "bg-status-blocked/10 text-status-blocked" },
    PORTAL: { label: "On Track", className: "bg-status-progress/10 text-status-progress" },
    MOBILE: { label: "Healthy", className: "bg-status-done/10 text-status-done" },
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">Projects</h1>
      <p className="text-sm text-warm-500 mb-8">Your connected Jira projects</p>

      {loading ? (
        <div className="text-center py-12"><RefreshCw className="w-6 h-6 text-warm-300 animate-spin mx-auto" /></div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-warm-200 p-12 text-center">
          <FolderKanban className="w-10 h-10 text-warm-300 mx-auto mb-4" />
          <p className="text-sm text-warm-500 font-medium">No Projects</p>
          <p className="text-xs text-warm-400 mt-1">Connect Jira in Integrations</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project, i) => {
            const health = healthMap[project.key] || { label: "Unknown", className: "bg-warm-200 text-warm-600" }
            return (
              <motion.div
                key={project.key}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/projects/${project.key}`} className="flex items-center gap-4 p-5 bg-white rounded-xl border border-warm-200 hover:border-accent/30 hover:shadow-sm transition-all group">
                  <div className="w-11 h-11 rounded-lg bg-warm-100 flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                    <FolderKanban className="w-5 h-5 text-warm-500 group-hover:text-accent transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-charcoal">{project.name}</p>
                    <p className="text-xs text-warm-400 mt-0.5">{project.key} · Last synced: just now</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${health.className}`}>{health.label}</span>
                  <ChevronRight className="w-4 h-4 text-warm-300 group-hover:text-accent transition-colors" />
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
