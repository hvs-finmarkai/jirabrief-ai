"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Building2, ArrowRight, Loader2 } from "lucide-react"

export default function OnboardingPage() {
  const router = useRouter()
  const [orgName, setOrgName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: orgName }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || "Failed to create organization")
      }

      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-warm-50">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-charcoal tracking-tight">Welcome to JiraBrief AI</h1>
          <p className="text-warm-500 mt-1 text-sm">Create your organization to get started</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Organization Name</label>
              <div className="mt-1 relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Your company or team name"
                  required
                  minLength={2}
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 bg-warm-50 border border-warm-200 rounded-xl text-sm text-charcoal placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-status-blocked bg-status-blocked/5 rounded-lg px-3 py-2">
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading || orgName.length < 2}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Create Organization</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
