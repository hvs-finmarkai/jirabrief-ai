"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Plug, Globe, Mail, Key, Loader2, CheckCircle2, XCircle, Unplug } from "lucide-react"

interface JiraConnection {
  id: string
  connection_name: string
  jira_site_url: string
  jira_email: string
  status: string
  last_connected_at: string | null
}

export default function IntegrationsPage() {
  const [connection, setConnection] = useState<JiraConnection | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [email, setEmail] = useState("")
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jira/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection_name: name,
          jira_site_url: url.replace(/\/$/, ""),
          email,
          api_token: token,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || "Connection failed")
      }

      const conn = await response.json()
      setConnection(conn)
      setShowForm(false)
      setToken("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed")
    } finally {
      setLoading(false)
    }
  }

  function handleDisconnect() {
    setConnection(null)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">Integrations</h1>
      <p className="text-sm text-warm-500 mb-8">Connect external services</p>

      <div className="bg-white rounded-xl border border-warm-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M11.53 2.019c-.473-.016-.863.274-1.05.69L7.092 9.544l-4.62 1.04c-.82.18-1.14 1.17-.55 1.7l3.52 3.15-.94 4.74c-.16.83.7 1.47 1.45 1.08L10 18.82l4.05 2.43c.75.39 1.61-.25 1.45-1.08l-.94-4.74 3.52-3.15c.59-.53.27-1.52-.55-1.7l-4.62-1.04-3.39-6.835c-.186-.416-.577-.706-1.05-.69z" fill="#2684FF"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-charcoal">Jira Cloud</p>
              <p className="text-xs text-warm-400">Connect to retrieve project and sprint data</p>
            </div>
          </div>
          {connection ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-status-done" />
              <span className="text-xs text-status-done font-medium">Connected</span>
            </div>
          ) : (
            <span className="text-xs text-warm-400">Not connected</span>
          )}
        </div>

        {connection && (
          <div className="bg-warm-50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-charcoal">{connection.connection_name}</p>
                <p className="text-xs text-warm-400">{connection.jira_site_url} · {connection.jira_email}</p>
              </div>
              <button onClick={handleDisconnect} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-status-blocked bg-status-blocked/5 border border-status-blocked/20 rounded-lg hover:bg-status-blocked/10 transition-colors cursor-pointer">
                <Unplug className="w-3.5 h-3.5" />Disconnect
              </button>
            </div>
          </div>
        )}

        {!connection && !showForm && (
          <button onClick={() => setShowForm(true)} className="w-full flex items-center justify-center gap-2 py-2.5 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors cursor-pointer">
            <Plug className="w-4 h-4" />Connect Jira
          </button>
        )}

        {showForm && !connection && (
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Connection Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Jira" required disabled={loading} className="mt-1 w-full px-4 py-2.5 bg-warm-50 border border-warm-200 rounded-xl text-sm text-charcoal placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Jira Site URL</label>
              <div className="mt-1 relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-team.atlassian.net" required disabled={loading} className="w-full pl-10 pr-4 py-2.5 bg-warm-50 border border-warm-200 rounded-xl text-sm text-charcoal placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all disabled:opacity-50" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Email</label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required disabled={loading} className="w-full pl-10 pr-4 py-2.5 bg-warm-50 border border-warm-200 rounded-xl text-sm text-charcoal placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all disabled:opacity-50" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">API Token</label>
              <div className="mt-1 relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Jira API token" required disabled={loading} className="w-full pl-10 pr-4 py-2.5 bg-warm-50 border border-warm-200 rounded-xl text-sm text-charcoal placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all disabled:opacity-50" />
              </div>
              <p className="text-xs text-warm-400 mt-1">Get one from id.atlassian.com/manage-profile/security/api-tokens</p>
            </div>

            {error && <p className="text-sm text-status-blocked bg-status-blocked/5 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors disabled:opacity-50 cursor-pointer">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 text-sm text-warm-500 bg-warm-100 rounded-xl hover:bg-warm-200 transition-colors cursor-pointer">Cancel</button>
            </div>
          </form>
        )}
      </div>
    </motion.div>
  )
}
