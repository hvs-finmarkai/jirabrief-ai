"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Lock, Loader2, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push("/dashboard"), 2000)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-warm-50">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-8">
            <CheckCircle2 className="w-12 h-12 text-status-done mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-charcoal mb-2">Password Updated</h2>
            <p className="text-sm text-warm-500">Redirecting to dashboard...</p>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-warm-50">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-charcoal tracking-tight">New Password</h1>
          <p className="text-warm-500 mt-1 text-sm">Choose a new password for your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">New Password</label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  minLength={8}
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 bg-warm-50 border border-warm-200 rounded-xl text-sm text-charcoal placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Confirm Password</label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  required
                  minLength={8}
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
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
