import { useState } from 'react'
import { motion } from 'framer-motion'
import { Globe, Mail, Key, ArrowRight, Sparkles } from 'lucide-react'
import type { JiraCredentials, ConnectionStatus } from '../types'

interface ConnectionFormProps {
  onConnect: (credentials: JiraCredentials) => void
  onDemoMode: () => void
  connectionStatus: ConnectionStatus
  error: string | null
}

export function ConnectionForm({ onConnect, onDemoMode, connectionStatus, error }: ConnectionFormProps) {
  const [url, setUrl] = useState('')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')

  const isConnecting = connectionStatus === 'connecting'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onConnect({ url: url.replace(/\/$/, ''), email, token })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="text-center mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-semibold text-charcoal tracking-tight"
        >
          JiraBrief AI
        </motion.h1>
        <p className="text-warm-500 mt-2 text-sm">
          Generate intelligent management reports from your Jira data
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">
              Jira URL
            </label>
            <div className="mt-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-team.atlassian.net"
                required
                disabled={isConnecting}
                className="w-full pl-10 pr-4 py-2.5 bg-warm-50 border border-warm-200 rounded-xl text-sm text-charcoal placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">
              Email
            </label>
            <div className="mt-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                disabled={isConnecting}
                className="w-full pl-10 pr-4 py-2.5 bg-warm-50 border border-warm-200 rounded-xl text-sm text-charcoal placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">
              API Token
            </label>
            <div className="mt-1 relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Your Jira API token"
                required
                disabled={isConnecting}
                className="w-full pl-10 pr-4 py-2.5 bg-warm-50 border border-warm-200 rounded-xl text-sm text-charcoal placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-status-blocked bg-status-blocked/5 rounded-lg px-3 py-2"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={isConnecting}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isConnecting ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : (
              <>
                Connect to Jira
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-warm-100">
          <button
            onClick={onDemoMode}
            disabled={isConnecting}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent/10 text-accent rounded-xl text-sm font-medium hover:bg-accent/15 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Try Demo Mode
          </button>
          <p className="text-xs text-warm-400 text-center mt-2">
            Explore with realistic sample data — no credentials needed
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
