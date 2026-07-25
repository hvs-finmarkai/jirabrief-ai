import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Download, Check, ArrowLeft, FileText } from 'lucide-react'
import type { ReportData, ReportItem } from '../types'

interface ReportViewerProps {
  report: ReportData
  onBack: () => void
}

function reportToMarkdown(report: ReportData): string {
  const lines: string[] = [`# ${report.title}`, '']

  function itemsSection(heading: string, items: ReportItem[]) {
    if (items.length === 0) return
    lines.push(`## ${heading}`, '')
    items.forEach((item) => {
      lines.push(`- **${item.key}**: ${item.summary}${item.detail ? ` — ${item.detail}` : ''}`)
    })
    lines.push('')
  }

  function stringSection(heading: string, items: string[]) {
    if (items.length === 0) return
    lines.push(`## ${heading}`, '')
    items.forEach((item) => lines.push(`- ${item}`))
    lines.push('')
  }

  switch (report.type) {
    case 'sprint-summary':
      lines.push(`**Sprint:** ${report.sprintName}`, '')
      itemsSection('Completed', report.completed)
      itemsSection('In Progress', report.inProgress)
      itemsSection('Blockers', report.blockers)
      itemsSection('Slipped / Incomplete', report.slipped)
      stringSection('Next Work', report.nextWork)
      break

    case 'status-report':
      lines.push(`**Current State:** ${report.currentState}`, '')
      lines.push(`**Progress:** ${report.progress}`, '')
      itemsSection('Completed Work', report.completedWork)
      itemsSection('Current Work', report.currentWork)
      itemsSection('Blockers', report.blockers)
      stringSection('Risks', report.risks)
      stringSection('Next Actions', report.nextActions)
      break

    case 'executive-digest':
      lines.push(`**Overall Status:** ${report.overallStatus}`, '')
      lines.push(`**Impact:** ${report.impact}`, '')
      stringSection('Highlights', report.highlights)
      stringSection('Risks', report.risks)
      stringSection('Management Asks', report.managementAsks)
      break

    case 'release-notes':
      itemsSection('New Functionality', report.newFunctionality)
      itemsSection('Improvements', report.improvements)
      itemsSection('Fixes', report.fixes)
      break
  }

  return lines.join('\n')
}

function ReportItemList({ items, accent }: { items: ReportItem[]; accent?: string }) {
  if (items.length === 0) return null
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.key} className="flex gap-3 text-sm">
          <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${accent || 'bg-warm-100 text-warm-600'} shrink-0 self-start mt-0.5`}>
            {item.key}
          </span>
          <span className="text-charcoal-light">
            {item.summary}
            {item.detail && <span className="text-warm-400"> — {item.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-charcoal uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  )
}

function StringList({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-charcoal-light flex gap-2">
          <span className="text-warm-400 shrink-0">•</span>
          {item}
        </li>
      ))}
    </ul>
  )
}

export function ReportViewer({ report, onBack }: ReportViewerProps) {
  const [copied, setCopied] = useState(false)

  const markdown = reportToMarkdown(report)

  function handleCopy() {
    navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload() {
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.type}-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-warm-500 hover:text-charcoal transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Generate another
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-warm-600 bg-white border border-warm-200 rounded-lg hover:border-warm-300 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-status-done" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-warm-600 bg-white border border-warm-200 rounded-lg hover:border-warm-300 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download .md
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-warm-200 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-warm-100">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
            <FileText className="w-4.5 h-4.5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-charcoal">{report.title}</h2>
            <p className="text-xs text-warm-400">Generated by JiraBrief AI</p>
          </div>
        </div>

        <div className="space-y-6">
          {report.type === 'sprint-summary' && (
            <>
              <p className="text-sm text-warm-500">Sprint: <span className="text-charcoal font-medium">{report.sprintName}</span></p>
              {report.completed.length > 0 && (
                <Section title="Completed">
                  <ReportItemList items={report.completed} accent="bg-status-done/10 text-status-done" />
                </Section>
              )}
              {report.inProgress.length > 0 && (
                <Section title="In Progress">
                  <ReportItemList items={report.inProgress} accent="bg-status-progress/10 text-status-progress" />
                </Section>
              )}
              {report.blockers.length > 0 && (
                <Section title="Blockers">
                  <ReportItemList items={report.blockers} accent="bg-status-blocked/10 text-status-blocked" />
                </Section>
              )}
              {report.slipped.length > 0 && (
                <Section title="Slipped / Incomplete">
                  <ReportItemList items={report.slipped} />
                </Section>
              )}
              {report.nextWork.length > 0 && (
                <Section title="Next Work">
                  <StringList items={report.nextWork} />
                </Section>
              )}
            </>
          )}

          {report.type === 'status-report' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-warm-50 rounded-lg">
                  <p className="text-xs text-warm-400 mb-1">Current State</p>
                  <p className="text-sm font-medium text-charcoal">{report.currentState}</p>
                </div>
                <div className="p-3 bg-warm-50 rounded-lg">
                  <p className="text-xs text-warm-400 mb-1">Progress</p>
                  <p className="text-sm font-medium text-charcoal">{report.progress}</p>
                </div>
              </div>
              {report.completedWork.length > 0 && (
                <Section title="Completed Work">
                  <ReportItemList items={report.completedWork} accent="bg-status-done/10 text-status-done" />
                </Section>
              )}
              {report.currentWork.length > 0 && (
                <Section title="Current Work">
                  <ReportItemList items={report.currentWork} accent="bg-status-progress/10 text-status-progress" />
                </Section>
              )}
              {report.blockers.length > 0 && (
                <Section title="Blockers">
                  <ReportItemList items={report.blockers} accent="bg-status-blocked/10 text-status-blocked" />
                </Section>
              )}
              {report.risks.length > 0 && (
                <Section title="Risks">
                  <StringList items={report.risks} />
                </Section>
              )}
              {report.nextActions.length > 0 && (
                <Section title="Next Actions">
                  <StringList items={report.nextActions} />
                </Section>
              )}
            </>
          )}

          {report.type === 'executive-digest' && (
            <>
              <div className="p-4 bg-warm-50 rounded-xl">
                <p className="text-xs text-warm-400 mb-1">Overall Status</p>
                <p className="text-sm font-medium text-charcoal">{report.overallStatus}</p>
              </div>
              {report.highlights.length > 0 && (
                <Section title="Highlights">
                  <StringList items={report.highlights} />
                </Section>
              )}
              {report.risks.length > 0 && (
                <Section title="Risks">
                  <StringList items={report.risks} />
                </Section>
              )}
              <div className="p-4 bg-warm-50 rounded-xl">
                <p className="text-xs text-warm-400 mb-1">Impact</p>
                <p className="text-sm text-charcoal-light">{report.impact}</p>
              </div>
              {report.managementAsks.length > 0 && (
                <Section title="Management Asks">
                  <StringList items={report.managementAsks} />
                </Section>
              )}
            </>
          )}

          {report.type === 'release-notes' && (
            <>
              {report.newFunctionality.length > 0 && (
                <Section title="New Functionality">
                  <ReportItemList items={report.newFunctionality} accent="bg-status-done/10 text-status-done" />
                </Section>
              )}
              {report.improvements.length > 0 && (
                <Section title="Improvements">
                  <ReportItemList items={report.improvements} accent="bg-status-progress/10 text-status-progress" />
                </Section>
              )}
              {report.fixes.length > 0 && (
                <Section title="Fixes">
                  <ReportItemList items={report.fixes} accent="bg-accent/10 text-accent" />
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}
