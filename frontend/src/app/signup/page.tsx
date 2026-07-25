"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Mail, Lock, User, ArrowRight, Loader2, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function SignupPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-warm-50">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-8">
            <CheckCircle2 className="w-12 h-12 text-status-done mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-charcoal mb-2">Check your email</h2>
            <p className="text-sm text-warm-500">We sent a verification link to <span className="font-medium text-charcoal">{email}</span></p>
            <Link href="/login" className="inline-block mt-6 text-sm text-accent hover:text-accent-hover font-medium transition-colors">
              Back to Sign In
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-warm-50">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-charcoal tracking-tight">Create Account</h1>
          <p className="text-warm-500 mt-1 text-sm">Get started with JiraBrief AI</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6">
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Full Name</label>
              <div className="mt-1 relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 bg-warm-50 border border-warm-200 rounded-xl text-sm text-charcoal placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Email</label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 bg-warm-50 border border-warm-200 rounded-xl text-sm text-charcoal placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Password</label>
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
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Create Account</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-warm-500">
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:text-accent-hover font-medium transition-colors">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
