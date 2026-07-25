"use client"

import { useCallback, useEffect, useState } from "react"
import { errorMessage, isMissingOrganization } from "@/lib/api"

export interface AsyncData<T> {
  /** `null` until the first successful fetch. */
  data: T | null
  loading: boolean
  error: string | null
  /** The user belongs to no organization — show the onboarding prompt. */
  missingOrg: boolean
  /** Refetch, showing the loading state again. */
  reload: () => void
  /** Apply a local update after a mutation without a full refetch. */
  setData: React.Dispatch<React.SetStateAction<T | null>>
}

/**
 * Loading / error / empty plumbing for a page that reads from the API.
 *
 * `fetcher` must be stable (wrap it in `useCallback`) and must not set state
 * itself — this hook owns every state transition so effects never update state
 * synchronously, and in-flight requests are ignored after unmount.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, fallbackMessage: string): AsyncData<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missingOrg, setMissingOrg] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    fetcher()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
        setMissingOrg(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (isMissingOrganization(err)) {
          setMissingOrg(true)
          setError(null)
        } else {
          setMissingOrg(false)
          setError(errorMessage(err, fallbackMessage))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [fetcher, fallbackMessage, reloadKey])

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    setMissingOrg(false)
    setReloadKey((key) => key + 1)
  }, [])

  return { data, loading, error, missingOrg, reload, setData }
}
