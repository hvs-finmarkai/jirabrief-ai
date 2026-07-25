"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Plug, Globe, Mail, Key, Loader2, CheckCircle2, Unplug, MessageSquare, BookOpen, Send } from "lucide-react"

type Tab = "jira" | "email" | "slack" | "confluence"

export default function IntegrationsPage() {
  const [tab, setTab] = useState<Tab>("jira")
  const [jiraConnected, setJiraConnected] = useState(false)
  const [showJiraForm, setShowJiraForm] = useState(false)
  const [jiraName, setJiraName] = useState("")
  const [jiraUrl, setJiraUrl] = useState("")
  const [jiraEmail, setJiraEmail] = useState("")
  const [jiraToken, setJiraToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)

  const [resendKey, setResendKey] = useState("")
  const [resendRecipients, setResendRecipients] = useState("")
  const [slackWebhook, setSlackWebhook] = useState("")
  const [confUrl, setConfUrl] = useState("")
  const [confEmail, setConfEmail] = useState("")
  const [confToken, setConfToken] = useState("")
  const [confSpace, setConfSpace] = useState("")

  function handleJiraConnect(e: React.FormEvent) {
    e.preventDefault()
    setJiraConnected(true)
    setShowJiraForm(false)
    setJiraToken("")
  }

  async function handleTest(channelType: string, config: Record<string, unknown>) {
    setLoading(true)
    setTestResult(null)
    setError(null)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/delivery/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_type: channelType, config }),
      })
      const data = await response.json()
      if (data.success) {
        setTestResult("Connection successful ✓")
      } else {
        setError(data.error_message || "Connection failed")
      }
    } catch {
      setError("Network error - is the backend running?")
    } finally {
      setLoading(false)
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Mail }[] = [
    { id: "jira", label: "Jira", icon: Plug },
    { id: "email", label: "Email", icon: Mail },
    { id: "slack", label: "Slack", icon: MessageSquare },
    { id: "confluence", label: "Confluence", icon: BookOpen },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">Integrations</h1>
      <p className="text-sm text-warm-500 mb-6">Connect services for data sync and report delivery</p>

      <div className="flex gap-2 mb-6">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => { setTab(t.id); setError(null); setTestResult(null) }} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${tab === t.id ? "bg-charcoal text-white" : "bg-white border border-warm-200 text-warm-600 hover:border-warm-300"}`}>
              <Icon className="w-4 h-4" />{t.label}
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-xl border border-warm-200 p-6">
        {tab === "jira" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div><p className="text-sm font-medium text-charcoal">Jira Cloud</p><p className="text-xs text-warm-400">Retrieve projects, sprints, and issues</p></div>
              {jiraConnected && <span className="flex items-center gap-1 text-xs text-status-done font-medium"><CheckCircle2 className="w-3.5 h-3.5" />Connected</span>}
            </div>
            {jiraConnected ? (
              <div className="flex items-center justify-between p-3 bg-warm-50 rounded-lg">
                <span className="text-sm text-charcoal">{jiraName || "Jira"} — {jiraUrl}</span>
                <button onClick={() => setJiraConnected(false)} className="text-xs text-status-blocked hover:underline cursor-pointer">Disconnect</button>
              </div>
            ) : !showJiraForm ? (
              <button onClick={() => setShowJiraForm(true)} className="w-full py-2.5 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors cursor-pointer">Connect Jira</button>
            ) : (
              <form onSubmit={handleJiraConnect} className="space-y-3">
                <input type="text" value={jiraName} onChange={(e) => setJiraName(e.target.value)} placeholder="Connection name" required className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
                <input type="url" value={jiraUrl} onChange={(e) => setJiraUrl(e.target.value)} placeholder="https://your-team.atlassian.net" required className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
                <input type="email" value={jiraEmail} onChange={(e) => setJiraEmail(e.target.value)} placeholder="Jira email" required className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
                <input type="password" value={jiraToken} onChange={(e) => setJiraToken(e.target.value)} placeholder="API token" required className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light cursor-pointer">Connect</button>
                  <button type="button" onClick={() => setShowJiraForm(false)} className="px-4 py-2 text-sm text-warm-500 bg-warm-100 rounded-xl cursor-pointer">Cancel</button>
                </div>
              </form>
            )}
          </>
        )}

        {tab === "email" && (
          <div className="space-y-4">
            <div><p className="text-sm font-medium text-charcoal">Email Delivery (Resend)</p><p className="text-xs text-warm-400">Send reports via email</p></div>
            <div>
              <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Resend API Key</label>
              <input type="password" value={resendKey} onChange={(e) => setResendKey(e.target.value)} placeholder="re_..." className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Recipients (comma-separated)</label>
              <input type="text" value={resendRecipients} onChange={(e) => setResendRecipients(e.target.value)} placeholder="manager@company.com, lead@company.com" className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
            </div>
            {error && <p className="text-xs text-status-blocked">{error}</p>}
            {testResult && <p className="text-xs text-status-done">{testResult}</p>}
            <button onClick={() => handleTest("email", { api_key: resendKey, recipients: resendRecipients.split(",").map((r) => r.trim()) })} disabled={loading || !resendKey} className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light disabled:opacity-40 cursor-pointer">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Test Connection
            </button>
          </div>
        )}

        {tab === "slack" && (
          <div className="space-y-4">
            <div><p className="text-sm font-medium text-charcoal">Slack</p><p className="text-xs text-warm-400">Send reports to a Slack channel</p></div>
            <div>
              <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Webhook URL</label>
              <input type="url" value={slackWebhook} onChange={(e) => setSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/..." className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
              <p className="text-xs text-warm-400 mt-1">Create an Incoming Webhook in your Slack workspace settings</p>
            </div>
            {error && <p className="text-xs text-status-blocked">{error}</p>}
            {testResult && <p className="text-xs text-status-done">{testResult}</p>}
            <button onClick={() => handleTest("slack", { webhook_url: slackWebhook })} disabled={loading || !slackWebhook} className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light disabled:opacity-40 cursor-pointer">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Test Connection
            </button>
          </div>
        )}

        {tab === "confluence" && (
          <div className="space-y-4">
            <div><p className="text-sm font-medium text-charcoal">Confluence</p><p className="text-xs text-warm-400">Publish reports as Confluence pages</p></div>
            <input type="url" value={confUrl} onChange={(e) => setConfUrl(e.target.value)} placeholder="https://your-team.atlassian.net/wiki" className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
            <input type="email" value={confEmail} onChange={(e) => setConfEmail(e.target.value)} placeholder="Email" className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
            <input type="password" value={confToken} onChange={(e) => setConfToken(e.target.value)} placeholder="API token" className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
            <input type="text" value={confSpace} onChange={(e) => setConfSpace(e.target.value)} placeholder="Space key (e.g. ENG)" className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
            {error && <p className="text-xs text-status-blocked">{error}</p>}
            {testResult && <p className="text-xs text-status-done">{testResult}</p>}
            <button onClick={() => handleTest("confluence", { base_url: confUrl, email: confEmail, api_token: confToken, space_key: confSpace })} disabled={loading || !confUrl || !confEmail || !confToken} className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light disabled:opacity-40 cursor-pointer">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Test Connection
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
