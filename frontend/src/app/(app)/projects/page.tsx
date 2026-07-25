"use client"

import { useCallback, useState } from "react"
import { motion } from "framer-motion"
import { FolderKanban, Search, RefreshCw, Loader2, User } from "lucide-react"
import { api, type JiraProject } from "@/lib/api"
import { useAsyncData } from "@/lib/use-async-data"
import { EmptyState, ErrorState, LoadingRows, NoOrganizationState } from "@/components/page-states"

interface ProjectsData {
  connected: boolean
  projects: JiraProject[]
}

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState("")

  const fetcher = useCallback(async (): Promise<ProjectsData> => {
    const connection = await api.jira.getConnection()
    if (!connection) return { connected: false, projects: [] }
    return { connected: true, projects: await api.jira.getProjects() }
  }, [])

  const { data, loading, error, missingOrg, reload } = useAsyncData(fetcher, "Failed to load projects")

  const connected = data?.connected ?? false
  const projects = data?.projects ?? []

  const filtered = searchQuery
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.key.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : projects

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-charcoal mb-1">Projects</h1>
          <p className="text-sm text-warm-500">Manage your connected Jira projects</p>
        </div>
        {connected && !error && (
          <button
            onClick={reload}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-warm-600 bg-white border border-warm-200 rounded-xl hover:border-warm-300 transition-colors disabled:opacity-40 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        )}
      </div>

      {missingOrg ? (
        <NoOrganizationState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <LoadingRows rows={4} />
      ) : !connected ? (
        <EmptyState
          icon={FolderKanban}
          title="No Projects Connected"
          description="Connect Jira in Integrations to select projects"
          actionLabel="Go to Integrations"
          actionHref="/integrations"
        />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No Projects Found"
          description="Your Jira account has no projects visible to this connection"
        />
      ) : (
        <>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-warm-200 rounded-xl text-sm text-charcoal placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No Matches"
              description={`No project matches "${searchQuery}"`}
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((project, i) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-warm-200 hover:border-warm-300 hover:shadow-sm transition-all"
                >
                  <div className="w-9 h-9 rounded-lg bg-warm-100 flex items-center justify-center shrink-0">
                    <FolderKanban className="w-4.5 h-4.5 text-warm-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal truncate">{project.name}</p>
                    <p className="text-xs text-warm-400 mt-0.5">{project.key}</p>
                  </div>
                  {project.lead && (
                    <span className="flex items-center gap-1.5 text-xs text-warm-500 shrink-0">
                      <User className="w-3.5 h-3.5 text-warm-400" />
                      {project.lead}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}
