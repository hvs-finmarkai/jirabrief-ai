"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Calendar,
  Zap,
  FileText,
  BarChart3,
  Briefcase,
  Tag,
  Loader2,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  RefreshCw,
  Shield,
} from "lucide-react"
import Link from "next/link"
import { api, type DemoSprint, type SprintHealth, type ReportResponse, type ReportType } from "@/lib/api"

type Step = "sprints" | "generate" | "report"

const REPORT_TYPES: { type: ReportType; label: string; description: string; icon: typeof FileText }[] = [
  { type: "SPRINT_SUMMARY", label: "Sprint Summary", description: "Completed, in progress, blockers", icon: FileText },
  { type: "STATUS_REPORT", label: "Status Report", description: "State, progress, risks, actions", icon: BarChart3 },
  { type: "EXECUTIVE_DIGEST", label: "Executive Digest", description: "Leadership overview", icon: Briefcase },
  { type: "RELEASE_NOTES", label: "Release Notes", description: "Features, improvements, fixes", icon: Tag },
]

export default function ProjectDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const [projectKey, setProjectKey] = useState("")
  const [projectName, setProjectName] = useState("")
  const [step, setStep] = useState<Step>("sprints")
  const [sprints, setSprints] = useState<DemoSprint[]>([])
  const [selectedSprint, setSelectedSprint] = useState<DemoSprint | null>(null)
  const [health, setHealth] = useState<SprintHealth | null>(null)
  const [selectedType, setSelectedType] = useState<ReportType | null>(null)
  const [report, setReport] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    params.then((p) => {
      setProjectKey(p.key)
      const names: Record<string, string> = { CRM: "CRM Migration", PORTAL: "Customer Portal", MOBILE: "Mobile Application" }
      setProjectName(names[p.key] || p.key)
      loadSprints(p.key)
    })
  }, [params])

  async function loadSprints(key: string) {
    setLoading(true)
    try {
      const data = await api.demo.getSprints(key)
      setSprints(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sprints")
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectSprint(sprint: DemoSprint) {
    setSelectedSprint(sprint)
    try {
      const h = await api.demo.getSprintHealth(sprint.id)
      setHealth(h)
    } catch {
      setHealth(null)
    }
    setStep("generate")
  }

  async function handleGenerate() {
    if (!selectedSprint || !selectedType) return
    setGenerating(true)
    setError(null)
    try {
      const data = await api.demo.generateReport({
        project_key: projectKey,
        sprint_id: selectedSprint.id,
        report_type: selectedType,
      })
      setReport(data)
      setStep("report")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate")
    } finally {
      setGenerating(false)
    }
  }

  function reportToMarkdown(): string {
    if (!report) return ""
    const c = report.content as Record<string, unknown>
    const lines: string[] = [`# ${report.title}`, ""]
    const fields = ["overall_status", "current_state", "progress", "impact"]
    fields.forEach((f) => { if (c[f]) lines.push(`**${f.replace(/_/g, " ")}:** ${c[f]}`, "") })
    const listFields = ["completed", "in_progress", "blockers", "completed_work", "current_work", "new_functionality", "improvements", "fixes", "slipped"]
    listFields.forEach((f) => {
      const items = c[f] as Array<{ key: string; summary: string }> | undefined
      if (items && items.length > 0) {
        lines.push(`## ${f.replace(/_/g, " ")}`, "")
        items.forEach((i) => lines.push(`- **${i.key}**: ${i.summary}`))
        lines.push("")
      }
    })
    const stringFields = ["next_work", "risks", "next_actions", "highlights", "management_asks"]
    stringFields.forEach((f) => {
      const items = c[f] as string[] | undefined
      if (items && items.length > 0) {
        lines.push(`## ${f.replace(/_/g, " ")}`, "")
        items.forEach((i) => lines.push(`- ${i}`))
        lines.push("")
      }
    })
    return lines.join("\n")
  }

  function handleCopy() {
    navigator.clipboard.writeText(reportToMarkdown())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload() {
    const blob = new Blob([reportToMarkdown()], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${report?.report_type.toLowerCase()}-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="text-center py-20"><Loader2 className="w-8 h-8 text-accent animate-spin mx-auto" /></div>
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Link href="/projects" className="flex items-center gap-1 text-sm text-warm-500 hover:text-charcoal mb-4 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />Back to Projects
      </Link>

      <h1 className="text-2xl font-semibold text-charcoal mb-1">{projectName}</h1>
      <p className="text-sm text-warm-500 mb-6">{projectKey} · {sprints.length} sprint{sprints.length !== 1 ? "s" : ""}</p>

      {step === "sprints" && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-warm-600 uppercase tracking-wide mb-3">Select Sprint to Report On</h2>
          {sprints.map((sprint, i) => (
            <motion.button
              key={sprint.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handleSelectSprint(sprint)}
              className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-warm-200 hover:border-accent/30 hover:shadow-sm transition-all group cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-warm-100 flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                <Calendar className="w-5 h-5 text-warm-500 group-hover:text-accent transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-charcoal">{sprint.name}</p>
                <p className="text-xs text-warm-400">{sprint.start_date} — {sprint.end_date}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sprint.state === "active" ? "bg-status-done/10 text-status-done" : "bg-warm-200 text-warm-600"}`}>{sprint.state}</span>
              <ChevronRight className="w-4 h-4 text-warm-300 group-hover:text-accent transition-colors" />
            </motion.button>
          ))}
        </div>
      )}

      {step === "generate" && selectedSprint && (
        <div>
          <button onClick={() => { setStep("sprints"); setHealth(null); setSelectedType(null) }} className="flex items-center gap-1 text-sm text-warm-500 hover:text-charcoal mb-4 transition-colors cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" />Back to sprints
          </button>

          <p className="text-sm text-warm-500 mb-4">{selectedSprint.name}</p>

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
              {health.signals.filter((s) => s.severity === "high").length > 0 && (
                <div className="mt-4 pt-3 border-t border-warm-100">
                  <p className="text-xs font-semibold text-warm-600 uppercase tracking-wide mb-2">Attention</p>
                  {health.signals.filter((s) => s.severity === "high").slice(0, 3).map((s, i) => (
                    <div key={i} className="flex items-start gap-2 mb-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-status-blocked mt-0.5 shrink-0" />
                      <p className="text-xs text-charcoal-light">{s.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <h3 className="text-xs font-semibold text-warm-600 uppercase tracking-wide mb-3">Choose Report Type</h3>
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
        </div>
      )}

      {step === "report" && report && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => { setReport(null); setStep("generate") }} className="flex items-center gap-1 text-sm text-warm-500 hover:text-charcoal transition-colors cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" />Generate another
            </button>
            <div className="flex gap-2">
              <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-warm-600 bg-white border border-warm-200 rounded-lg hover:border-warm-300 cursor-pointer">
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-status-done" /> : <Copy className="w-3.5 h-3.5" />}{copied ? "Copied" : "Copy"}
              </button>
              <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-warm-600 bg-white border border-warm-200 rounded-lg hover:border-warm-300 cursor-pointer">
                <Download className="w-3.5 h-3.5" />.md
              </button>
              <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent bg-accent/5 border border-accent/20 rounded-lg hover:bg-accent/10 cursor-pointer">
                <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />Regenerate
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-warm-200 shadow-sm p-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-warm-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center"><FileText className="w-4.5 h-4.5 text-accent" /></div>
                <div>
                  <h2 className="text-lg font-semibold text-charcoal">{report.title}</h2>
                  <p className="text-xs text-warm-400">{report.ai_provider}/{report.ai_model} · {report.quality.verified_sources} sources verified</p>
                </div>
              </div>
              <Shield className={`w-4 h-4 ${report.quality.status === "PASSED" ? "text-status-done" : "text-status-progress"}`} />
            </div>
            <ReportBody content={report.content as Record<string, unknown>} />
            {report.source_issue_keys.length > 0 && (
              <div className="mt-6 pt-4 border-t border-warm-100">
                <h4 className="text-xs font-semibold text-warm-600 uppercase tracking-wide mb-2">Sources</h4>
                <div className="flex flex-wrap gap-1.5">
                  {report.source_issue_keys.map((key) => <span key={key} className="text-xs font-mono px-2 py-0.5 bg-warm-100 text-warm-600 rounded">{key}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
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
        if (typeof value === "string") return <div key={key} className="p-4 bg-warm-50 rounded-xl"><p className="text-xs text-warm-400 mb-1">{title}</p><p className="text-sm text-charcoal">{value}</p></div>
        if (Array.isArray(value) && value.length === 0) return null
        if (Array.isArray(value) && isItems && typeof value[0] === "object") {
          return (
            <div key={key}>
              <h3 className="text-xs font-semibold text-warm-600 uppercase tracking-wide mb-2">{title}</h3>
              <ul className="space-y-2">
                {(value as Array<{ key: string; summary: string; detail?: string | null }>).map((item) => (
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
              <ul className="space-y-1.5">{(value as string[]).map((item, i) => <li key={i} className="text-sm text-charcoal-light flex gap-2"><span className="text-warm-400 shrink-0">•</span>{item}</li>)}</ul>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}
