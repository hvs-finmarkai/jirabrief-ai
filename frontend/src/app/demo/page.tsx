"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles,
  FolderKanban,
  Calendar,
  FileText,
  BarChart3,
  Briefcase,
  Tag,
  Zap,
  ArrowLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Copy,
  Download,
  RefreshCw,
  CheckCircle2,
  Shield,
} from "lucide-react"
import { api, type DemoProject, type DemoSprint, type ReportResponse, type ReportType, type SprintHealth } from "@/lib/api"

type Step = "projects" | "sprints" | "generate" | "report"

const REPORT_TYPES: { type: ReportType; label: string; description: string; icon: typeof FileText }[] = [
  { type: "SPRINT_SUMMARY", label: "Sprint Summary", description: "Completed, in progress, blockers, next work", icon: FileText },
  { type: "STATUS_REPORT", label: "Status Report", description: "State, progress, risks, actions", icon: BarChart3 },
  { type: "EXECUTIVE_DIGEST", label: "Executive Digest", description: "Non-technical leadership overview", icon: Briefcase },
  { type: "RELEASE_NOTES", label: "Release Notes", description: "Features, improvements, fixes", icon: Tag },
]

export default function DemoPage() {
  const [step, setStep] = useState<Step>("projects")
  const [projects, setProjects] = useState<DemoProject[]>([])
  const [sprints, setSprints] = useState<DemoSprint[]>([])
  const [health, setHealth] = useState<SprintHealth | null>(null)
  const [selectedProject, setSelectedProject] = useState<DemoProject | null>(null)
  const [selectedSprint, setSelectedSprint] = useState<DemoSprint | null>(null)
  const [selectedType, setSelectedType] = useState<ReportType | null>(null)
  const [report, setReport] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    setLoading(true)
    try {
      const data = await api.demo.getProjects()
      setProjects(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects")
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectProject(project: DemoProject) {
    setSelectedProject(project)
    setLoading(true)
    setError(null)
    try {
      const data = await api.demo.getSprints(project.key)
      setSprints(data)
      setStep("sprints")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sprints")
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectSprint(sprint: DemoSprint) {
    setSelectedSprint(sprint)
    setSelectedType(null)
    setLoading(true)
    try {
      const h = await api.demo.getSprintHealth(sprint.id)
      setHealth(h)
    } catch {
      setHealth(null)
    } finally {
      setLoading(false)
      setStep("generate")
    }
  }

  async function handleGenerate() {
    if (!selectedProject || !selectedSprint || !selectedType) return
    setGenerating(true)
    setError(null)
    try {
      const data = await api.demo.generateReport({
        project_key: selectedProject.key,
        sprint_id: selectedSprint.id,
        report_type: selectedType,
      })
      setReport(data)
      setStep("report")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report")
    } finally {
      setGenerating(false)
    }
  }

  function reportToMarkdown(): string {
    if (!report) return ""
    const c = report.content as Record<string, unknown>
    const lines: string[] = [`# ${report.title}`, ""]

    function addItems(heading: string, items: Array<{key: string; summary: string; detail?: string | null}>) {
      if (!items || items.length === 0) return
      lines.push(`## ${heading}`, "")
      items.forEach((i) => lines.push(`- **${i.key}**: ${i.summary}${i.detail ? ` — ${i.detail}` : ""}`))
      lines.push("")
    }

    function addStrings(heading: string, items: string[]) {
      if (!items || items.length === 0) return
      lines.push(`## ${heading}`, "")
      items.forEach((i) => lines.push(`- ${i}`))
      lines.push("")
    }

    if (c["current_state"]) lines.push(`**Status:** ${c["current_state"]}`, "")
    if (c["progress"]) lines.push(`**Progress:** ${c["progress"]}`, "")
    if (c["overall_status"]) lines.push(`**Overall:** ${c["overall_status"]}`, "")
    if (c["impact"]) lines.push(`**Impact:** ${c["impact"]}`, "")

    addItems("Completed", c["completed"] as never[])
    addItems("In Progress", c["in_progress"] as never[])
    addItems("Blockers", c["blockers"] as never[])
    addItems("Slipped", c["slipped"] as never[])
    addItems("Completed Work", c["completed_work"] as never[])
    addItems("Current Work", c["current_work"] as never[])
    addItems("New Functionality", c["new_functionality"] as never[])
    addItems("Improvements", c["improvements"] as never[])
    addItems("Fixes", c["fixes"] as never[])
    addStrings("Next Work", c["next_work"] as string[])
    addStrings("Risks", c["risks"] as string[])
    addStrings("Next Actions", c["next_actions"] as string[])
    addStrings("Highlights", c["highlights"] as string[])
    addStrings("Management Asks", c["management_asks"] as string[])

    return lines.join("\n")
  }

  function handleCopy() {
    navigator.clipboard.writeText(reportToMarkdown())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload(format: "md" | "txt") {
    const content = reportToMarkdown()
    const blob = new Blob([content], { type: format === "md" ? "text/markdown" : "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${report?.report_type.toLowerCase()}-${Date.now()}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-warm-50">
      <div className="border-b border-warm-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-charcoal">Demo Workspace</span>
            <span className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded-full">Acme Digital</span>
          </div>
          <a href="/login" className="text-xs text-warm-500 hover:text-charcoal transition-colors">Sign in for full access →</a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <AnimatePresence mode="wait">
          {loading && !generating && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-20">
              <Loader2 className="w-8 h-8 text-accent animate-spin mb-4" />
              <p className="text-sm text-warm-500">Loading...</p>
            </motion.div>
          )}

          {error && !generating && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-20">
              <AlertCircle className="w-10 h-10 text-status-blocked mx-auto mb-4" />
              <p className="text-sm text-charcoal-light mb-4">{error}</p>
              <button onClick={() => { setError(null); loadProjects() }} className="text-sm text-accent hover:text-accent-hover cursor-pointer">Try again</button>
            </motion.div>
          )}

          {!loading && !error && step === "projects" && (
            <motion.div key="projects" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <h1 className="text-2xl font-semibold text-charcoal mb-1">Select Project</h1>
              <p className="text-sm text-warm-500 mb-6">Choose a project to generate reports for</p>
              <div className="space-y-2">
                {projects.map((p, i) => (
                  <motion.button key={p.key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} onClick={() => handleSelectProject(p)} className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-warm-200 hover:border-accent/30 hover:shadow-sm transition-all group cursor-pointer">
                    <div className="w-10 h-10 rounded-lg bg-warm-100 flex items-center justify-center group-hover:bg-accent/10 transition-colors"><FolderKanban className="w-5 h-5 text-warm-500 group-hover:text-accent transition-colors" /></div>
                    <div className="flex-1 text-left"><p className="text-sm font-medium text-charcoal">{p.name}</p><p className="text-xs text-warm-400">{p.key}</p></div>
                    <ChevronRight className="w-4 h-4 text-warm-300 group-hover:text-accent transition-colors" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {!loading && !error && step === "sprints" && (
            <motion.div key="sprints" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <button onClick={() => setStep("projects")} className="flex items-center gap-1 text-sm text-warm-500 hover:text-charcoal mb-4 transition-colors cursor-pointer"><ArrowLeft className="w-3.5 h-3.5" />Back</button>
              <h1 className="text-2xl font-semibold text-charcoal mb-1">Select Sprint</h1>
              <p className="text-sm text-warm-500 mb-6">{selectedProject?.name}</p>
              <div className="space-y-2">
                {sprints.map((s, i) => (
                  <motion.button key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} onClick={() => handleSelectSprint(s)} className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-warm-200 hover:border-accent/30 hover:shadow-sm transition-all group cursor-pointer">
                    <div className="w-10 h-10 rounded-lg bg-warm-100 flex items-center justify-center group-hover:bg-accent/10 transition-colors"><Calendar className="w-5 h-5 text-warm-500 group-hover:text-accent transition-colors" /></div>
                    <div className="flex-1 text-left"><p className="text-sm font-medium text-charcoal">{s.name}</p><p className="text-xs text-warm-400">{s.start_date} — {s.end_date}</p></div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.state === "active" ? "bg-status-done/10 text-status-done" : "bg-warm-200 text-warm-600"}`}>{s.state}</span>
                    <ChevronRight className="w-4 h-4 text-warm-300 group-hover:text-accent transition-colors" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {!loading && !error && step === "generate" && (
            <motion.div key="generate" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <button onClick={() => setStep("sprints")} className="flex items-center gap-1 text-sm text-warm-500 hover:text-charcoal mb-4 transition-colors cursor-pointer"><ArrowLeft className="w-3.5 h-3.5" />Back</button>
              <h1 className="text-2xl font-semibold text-charcoal mb-1">Generate Report</h1>
              <p className="text-sm text-warm-500 mb-6">{selectedProject?.name} · {selectedSprint?.name}</p>

              {health && (
                <div className="bg-white rounded-xl border border-warm-200 p-5 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-warm-600 uppercase tracking-wide">Sprint Health</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${health.status === "Healthy" ? "bg-status-done/10 text-status-done" : health.status === "On Track" ? "bg-status-progress/10 text-status-progress" : "bg-status-blocked/10 text-status-blocked"}`}>{health.status}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-3 text-center">
                    <div><p className="text-lg font-semibold text-charcoal">{health.metrics.completed}</p><p className="text-xs text-warm-400">Done</p></div>
                    <div><p className="text-lg font-semibold text-charcoal">{health.metrics.in_progress}</p><p className="text-xs text-warm-400">In Progress</p></div>
                    <div><p className="text-lg font-semibold text-charcoal">{health.metrics.to_do}</p><p className="text-xs text-warm-400">To Do</p></div>
                    <div><p className="text-lg font-semibold text-status-blocked">{health.metrics.blocked}</p><p className="text-xs text-warm-400">Blocked</p></div>
                    <div><p className="text-lg font-semibold text-charcoal">{health.metrics.completion_percentage}%</p><p className="text-xs text-warm-400">Complete</p></div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-6">
                {REPORT_TYPES.map((rt) => {
                  const Icon = rt.icon
                  const isSelected = selectedType === rt.type
                  return (
                    <button key={rt.type} onClick={() => setSelectedType(rt.type)} className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${isSelected ? "border-accent bg-accent/5 shadow-sm" : "border-warm-200 bg-white hover:border-warm-300"}`}>
                      <Icon className={`w-5 h-5 mb-2 ${isSelected ? "text-accent" : "text-warm-400"}`} />
                      <p className={`text-sm font-medium ${isSelected ? "text-accent" : "text-charcoal"}`}>{rt.label}</p>
                      <p className="text-xs text-warm-400 mt-0.5">{rt.description}</p>
                    </button>
                  )
                })}
              </div>

              {error && <p className="text-sm text-status-blocked bg-status-blocked/5 rounded-lg px-3 py-2 mb-4">{error}</p>}

              <button onClick={handleGenerate} disabled={!selectedType || generating} className="w-full flex items-center justify-center gap-2 py-3 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                {generating ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><Zap className="w-4 h-4" />Generate Report</>}
              </button>
            </motion.div>
          )}

          {!loading && step === "report" && report && (
            <motion.div key="report" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => { setReport(null); setStep("generate") }} className="flex items-center gap-1 text-sm text-warm-500 hover:text-charcoal transition-colors cursor-pointer"><ArrowLeft className="w-3.5 h-3.5" />Generate another</button>
                <div className="flex gap-2">
                  <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-warm-600 bg-white border border-warm-200 rounded-lg hover:border-warm-300 transition-colors cursor-pointer">
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-status-done" /> : <Copy className="w-3.5 h-3.5" />}{copied ? "Copied" : "Copy"}
                  </button>
                  <button onClick={() => handleDownload("md")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-warm-600 bg-white border border-warm-200 rounded-lg hover:border-warm-300 transition-colors cursor-pointer"><Download className="w-3.5 h-3.5" />.md</button>
                  <button onClick={() => handleDownload("txt")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-warm-600 bg-white border border-warm-200 rounded-lg hover:border-warm-300 transition-colors cursor-pointer"><Download className="w-3.5 h-3.5" />.txt</button>
                  <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent bg-accent/5 border border-accent/20 rounded-lg hover:bg-accent/10 transition-colors cursor-pointer"><RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />Regenerate</button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-warm-200 shadow-sm p-8">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-warm-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center"><FileText className="w-4.5 h-4.5 text-accent" /></div>
                    <div>
                      <h2 className="text-lg font-semibold text-charcoal">{report.title}</h2>
                      <p className="text-xs text-warm-400">{report.project_name} · {report.sprint_name} · Generated by {report.ai_provider}/{report.ai_model}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className={`w-4 h-4 ${report.quality.status === "PASSED" ? "text-status-done" : "text-status-progress"}`} />
                    <span className="text-xs text-warm-500">{report.quality.verified_sources} sources verified</span>
                  </div>
                </div>

                <ReportBody content={report.content} />

                {report.source_issue_keys.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-warm-100">
                    <h4 className="text-xs font-semibold text-warm-600 uppercase tracking-wide mb-2">Sources</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {report.source_issue_keys.map((key) => (
                        <span key={key} className="text-xs font-mono px-2 py-0.5 bg-warm-100 text-warm-600 rounded">{key}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function ReportBody({ content }: { content: Record<string, unknown> }) {
  const sections: Array<{ title: string; key: string; isItems: boolean }> = [
    { title: "Overall Status", key: "overall_status", isItems: false },
    { title: "Current State", key: "current_state", isItems: false },
    { title: "Progress", key: "progress", isItems: false },
    { title: "Impact", key: "impact", isItems: false },
    { title: "Completed", key: "completed", isItems: true },
    { title: "Completed Work", key: "completed_work", isItems: true },
    { title: "In Progress", key: "in_progress", isItems: true },
    { title: "Current Work", key: "current_work", isItems: true },
    { title: "Blockers", key: "blockers", isItems: true },
    { title: "Slipped", key: "slipped", isItems: true },
    { title: "New Functionality", key: "new_functionality", isItems: true },
    { title: "Improvements", key: "improvements", isItems: true },
    { title: "Fixes", key: "fixes", isItems: true },
    { title: "Next Work", key: "next_work", isItems: false },
    { title: "Risks", key: "risks", isItems: false },
    { title: "Next Actions", key: "next_actions", isItems: false },
    { title: "Highlights", key: "highlights", isItems: false },
    { title: "Management Asks", key: "management_asks", isItems: false },
  ]

  return (
    <div className="space-y-5">
      {sections.map(({ title, key, isItems }) => {
        const value = content[key]
        if (!value) return null
        if (typeof value === "string") {
          return (
            <div key={key} className="p-4 bg-warm-50 rounded-xl">
              <p className="text-xs text-warm-400 mb-1">{title}</p>
              <p className="text-sm text-charcoal">{value}</p>
            </div>
          )
        }
        if (Array.isArray(value) && value.length === 0) return null
        if (Array.isArray(value) && isItems && typeof value[0] === "object") {
          return (
            <div key={key}>
              <h3 className="text-xs font-semibold text-warm-600 uppercase tracking-wide mb-2">{title}</h3>
              <ul className="space-y-2">
                {(value as Array<{key: string; summary: string; detail?: string | null}>).map((item) => (
                  <li key={item.key} className="flex gap-3 text-sm">
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-warm-100 text-warm-600 shrink-0 self-start mt-0.5">{item.key}</span>
                    <span className="text-charcoal-light">{item.summary}{item.detail && <span className="text-warm-400"> — {item.detail}</span>}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        }
        if (Array.isArray(value) && value.length > 0) {
          return (
            <div key={key}>
              <h3 className="text-xs font-semibold text-warm-600 uppercase tracking-wide mb-2">{title}</h3>
              <ul className="space-y-1.5">
                {(value as string[]).map((item, i) => (
                  <li key={i} className="text-sm text-charcoal-light flex gap-2"><span className="text-warm-400 shrink-0">•</span>{item}</li>
                ))}
              </ul>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}
