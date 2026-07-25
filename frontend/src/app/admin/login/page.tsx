"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Mail, Lock, ArrowRight, Loader2, Shield } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push("/admin")
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-charcoal">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-accent" />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Admin Console</h1>
          <p className="text-warm-400 mt-1 text-sm">JiraBrief AI — Authorized access only</p>
        </div>

        <div className="bg-warm-900 rounded-2xl border border-warm-700 p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-warm-400 uppercase tracking-wide">Admin Email</label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@company.com"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 bg-warm-800 border border-warm-700 rounded-xl text-sm text-warm-100 placeholder:text-warm-500 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-warm-400 uppercase tracking-wide">Password</label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 bg-warm-800 border border-warm-700 rounded-xl text-sm text-warm-100 placeholder:text-warm-500 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-status-blocked bg-status-blocked/10 rounded-lg px-3 py-2">
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Sign In to Admin</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <Link href="/login" className="flex items-center justify-center mt-4 text-xs text-warm-500 hover:text-warm-300 transition-colors">
            ← Back to user login
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
