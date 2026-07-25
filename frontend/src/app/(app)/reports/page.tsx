"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { FileText, Filter, Search, Plus, ChevronRight, CheckCircle2, Clock, Send } from "lucide-react"
import Link from "next/link"
import { api, type ReportResponse } from "@/lib/api"

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-warm-200 text-warm-600",
  IN_REVIEW: "bg-status-progress/10 text-status-progress",
  APPROVED: "bg-status-done/10 text-status-done",
  SENT: "bg-accent/10 text-accent",
}

const TYPE_LABELS: Record<string, string> = {
  SPRINT_SUMMARY: "Sprint Summary",
  STATUS_REPORT: "Status Report",
  EXECUTIVE_DIGEST: "Executive Digest",
  RELEASE_NOTES: "Release Notes",
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    loadReports()
  }, [typeFilter])

  async function loadReports() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter) params.set("report_type", typeFilter)
      const data = await api.demo.listReports(typeFilter || undefined)
      setReports(data)
    } catch {
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  const filteredReports = searchQuery
    ? reports.filter((r) => r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.project_key.toLowerCase().includes(searchQuery.toLowerCase()))
    : reports

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-charcoal mb-1">Reports</h1>
          <p className="text-sm text-warm-500">View and manage generated reports</p>
        </div>
        <Link href="/demo" className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors">
          <Plus className="w-4 h-4" />Generate Report
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reports..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-warm-200 rounded-xl text-sm text-charcoal placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-warm-200 rounded-xl text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
        >
          <option value="">All Types</option>
          <option value="SPRINT_SUMMARY">Sprint Summary</option>
          <option value="STATUS_REPORT">Status Report</option>
          <option value="EXECUTIVE_DIGEST">Executive Digest</option>
          <option value="RELEASE_NOTES">Release Notes</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12"><p className="text-sm text-warm-500">Loading reports...</p></div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-white rounded-xl border border-warm-200 p-12 text-center">
          <FileText className="w-10 h-10 text-warm-300 mx-auto mb-4" />
          <p className="text-sm text-warm-500 font-medium">No Reports Yet</p>
          <p className="text-xs text-warm-400 mt-1">Generate a report from the Demo workspace or connect Jira</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredReports.map((report, i) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border border-warm-200 hover:border-warm-300 hover:shadow-sm transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-warm-100 flex items-center justify-center">
                <FileText className="w-4.5 h-4.5 text-warm-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-charcoal truncate">{report.title}</p>
                <p className="text-xs text-warm-400 mt-0.5">
                  {report.project_key} · {TYPE_LABELS[report.report_type] || report.report_type} · {new Date(report.generated_at).toLocaleDateString()}
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES["DRAFT"]}`}>Draft</span>
              <ChevronRight className="w-4 h-4 text-warm-300 group-hover:text-accent transition-colors" />
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
