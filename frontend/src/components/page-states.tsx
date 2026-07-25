"use client"

import { AlertCircle, Building2, type LucideIcon } from "lucide-react"
import Link from "next/link"

/** Skeleton rows matching the app's card list rhythm. */
export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-warm-200">
          <div className="w-9 h-9 rounded-lg bg-warm-100 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-40 rounded bg-warm-100 animate-pulse" />
            <div className="h-3 w-24 rounded bg-warm-100 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Skeleton for a card grid (dashboard stat tiles). */
export function LoadingCards({ cards = 4 }: { cards?: number }) {
  return (
    <>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-warm-200 p-5">
          <div className="w-9 h-9 rounded-lg bg-warm-100 animate-pulse mb-3" />
          <div className="h-7 w-12 rounded bg-warm-100 animate-pulse" />
          <div className="h-3 w-24 rounded bg-warm-100 animate-pulse mt-2" />
        </div>
      ))}
    </>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-warm-200 p-12 text-center">
      <AlertCircle className="w-10 h-10 text-status-blocked mx-auto mb-4" />
      <p className="text-sm text-charcoal-light">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 text-sm text-accent hover:text-accent-hover cursor-pointer">
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-warm-200 p-12 text-center">
      <Icon className="w-10 h-10 text-warm-300 mx-auto mb-4" />
      <p className="text-sm text-warm-500 font-medium">{title}</p>
      <p className="text-xs text-warm-400 mt-1">{description}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-block mt-4 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}

/**
 * Shown inside a form that cannot proceed without a Jira connection. Shared by
 * the schedule-create and report-generate flows so both read identically.
 */
export function JiraRequiredNotice({
  message,
  onCancel,
}: {
  message: string
  onCancel: () => void
}) {
  return (
    <div>
      <p className="text-sm text-warm-500">{message}</p>
      <div className="flex gap-2 mt-4">
        <Link
          href="/integrations"
          className="px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors"
        >
          Go to Integrations
        </Link>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-warm-500 bg-warm-100 rounded-xl hover:bg-warm-200 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

/** Shown when the signed-in user has no organization yet. */
export function NoOrganizationState() {
  return (
    <EmptyState
      icon={Building2}
      title="No Organization"
      description="Create an organization before you can use this workspace"
      actionLabel="Create Organization"
      actionHref="/onboarding"
    />
  )
}
