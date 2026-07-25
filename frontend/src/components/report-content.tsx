"use client"

/** Narrative fields rendered as a single block of prose. */
export const NARRATIVE_FIELDS: { key: string; label: string }[] = [
  { key: "overall_status", label: "Overall Status" },
  { key: "current_state", label: "Current State" },
  { key: "progress", label: "Progress" },
  { key: "impact", label: "Impact" },
]

/** Fields holding a flat list of strings. */
export const BULLET_FIELDS: { key: string; label: string }[] = [
  { key: "next_work", label: "Next Work" },
  { key: "risks", label: "Risks" },
  { key: "next_actions", label: "Next Actions" },
  { key: "highlights", label: "Highlights" },
  { key: "management_asks", label: "Management Asks" },
]

/** Fields holding issue-backed items ({key, summary, detail}). */
export const ITEM_FIELDS: { key: string; label: string }[] = [
  { key: "completed", label: "Completed" },
  { key: "completed_work", label: "Completed Work" },
  { key: "in_progress", label: "In Progress" },
  { key: "current_work", label: "Current Work" },
  { key: "blockers", label: "Blockers" },
  { key: "slipped", label: "Slipped" },
  { key: "new_functionality", label: "New Functionality" },
  { key: "improvements", label: "Improvements" },
  { key: "fixes", label: "Fixes" },
]

export interface ContentItem {
  key: string
  summary: string
  detail?: string | null
}

export function asItems(value: unknown): ContentItem[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is ContentItem =>
      typeof item === "object" && item !== null && "key" in item && "summary" in item
  )
}

export function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

/**
 * Renders a stored report's content dictionary. Mirrors the section ordering
 * used by the demo workspace so a real report reads identically to a demo one.
 */
export function ReportContentView({ content }: { content: Record<string, unknown> }) {
  const narrative = NARRATIVE_FIELDS.filter(({ key }) => typeof content[key] === "string" && content[key])
  const items = ITEM_FIELDS.filter(({ key }) => asItems(content[key]).length > 0)
  const bullets = BULLET_FIELDS.filter(({ key }) => asStrings(content[key]).length > 0)

  if (narrative.length === 0 && items.length === 0 && bullets.length === 0) {
    return <p className="text-sm text-warm-400">This report has no content sections.</p>
  }

  return (
    <div className="space-y-5">
      {narrative.map(({ key, label }) => (
        <div key={key} className="p-4 bg-warm-50 rounded-xl">
          <p className="text-xs text-warm-400 mb-1">{label}</p>
          <p className="text-sm text-charcoal">{String(content[key])}</p>
        </div>
      ))}

      {items.map(({ key, label }) => (
        <div key={key}>
          <h3 className="text-xs font-semibold text-warm-600 uppercase tracking-wide mb-2">{label}</h3>
          <ul className="space-y-2">
            {asItems(content[key]).map((item) => (
              <li key={item.key} className="flex gap-3 text-sm">
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-warm-100 text-warm-600 shrink-0 self-start mt-0.5">
                  {item.key}
                </span>
                <span className="text-charcoal-light">
                  {item.summary}
                  {item.detail && <span className="text-warm-400"> — {item.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {bullets.map(({ key, label }) => (
        <div key={key}>
          <h3 className="text-xs font-semibold text-warm-600 uppercase tracking-wide mb-2">{label}</h3>
          <ul className="space-y-1.5">
            {asStrings(content[key]).map((line, i) => (
              <li key={i} className="text-sm text-charcoal-light flex gap-2">
                <span className="text-warm-400 shrink-0">•</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
