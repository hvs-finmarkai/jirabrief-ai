"use client"

import { useCallback } from "react"
import { motion } from "framer-motion"
import { FileCode2 } from "lucide-react"
import { api, type ReportTemplate } from "@/lib/api"
import { useAsyncData } from "@/lib/use-async-data"
import { EmptyState, ErrorState, LoadingRows, NoOrganizationState } from "@/components/page-states"

const TYPE_LABELS: Record<string, string> = {
  SPRINT_SUMMARY: "Sprint Summary",
  STATUS_REPORT: "Status Report",
  EXECUTIVE_DIGEST: "Executive Digest",
  RELEASE_NOTES: "Release Notes",
}

function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export default function TemplatesPage() {
  const fetcher = useCallback((): Promise<ReportTemplate[]> => api.reports.templates(), [])
  const { data, loading, error, missingOrg, reload } = useAsyncData(fetcher, "Failed to load templates")

  const templates = data ?? []
  const custom = templates.filter((t) => !t.is_system)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">Templates</h1>
      <p className="text-sm text-warm-500 mb-6">Customize report templates</p>

      {missingOrg ? (
        <NoOrganizationState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <LoadingRows rows={4} />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileCode2}
          title="No Templates"
          description="No report templates are available for this organization"
        />
      ) : (
        <>
          {custom.length === 0 && (
            <p className="text-xs text-warm-400 mb-4">
              Showing the built-in system templates. Custom templates added for your organization appear here too.
            </p>
          )}

          <div className="space-y-2">
            {templates.map((template, i) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="p-4 bg-white rounded-xl border border-warm-200 hover:border-warm-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-warm-100 flex items-center justify-center shrink-0">
                    <FileCode2 className="w-4.5 h-4.5 text-warm-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal truncate">{template.name}</p>
                    <p className="text-xs text-warm-400 mt-0.5">
                      {TYPE_LABELS[template.report_type] || template.report_type} · {humanize(template.tone)} tone ·{" "}
                      {humanize(template.length)}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${template.is_system ? "bg-warm-200 text-warm-600" : "bg-accent/10 text-accent"}`}
                  >
                    {template.is_system ? "System" : "Custom"}
                  </span>
                </div>

                {template.enabled_sections && template.enabled_sections.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pl-13">
                    {template.enabled_sections.map((section) => (
                      <span key={section} className="text-xs px-2 py-0.5 bg-warm-100 text-warm-600 rounded">
                        {humanize(section)}
                      </span>
                    ))}
                  </div>
                )}

                {template.additional_instructions && (
                  <p className="text-xs text-warm-500 mt-3 pl-13">{template.additional_instructions}</p>
                )}
              </motion.div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  )
}
