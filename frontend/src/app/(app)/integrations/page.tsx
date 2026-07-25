"use client"

import { useCallback, useState } from "react"
import { motion } from "framer-motion"
import {
  Plug,
  Mail,
  Loader2,
  CheckCircle2,
  MessageSquare,
  BookOpen,
  Send,
  Save,
  Trash2,
  RefreshCw,
} from "lucide-react"
import {
  api,
  errorMessage,
  type DeliveryChannel,
  type DeliveryChannelType,
  type JiraConnection,
} from "@/lib/api"
import { useAsyncData } from "@/lib/use-async-data"
import { ErrorState, LoadingRows, NoOrganizationState } from "@/components/page-states"

type Tab = "jira" | "email" | "slack" | "confluence"

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  slack: "Slack",
  confluence: "Confluence",
}

interface IntegrationsData {
  connection: JiraConnection | null
  channels: DeliveryChannel[]
}

export default function IntegrationsPage() {
  const [tab, setTab] = useState<Tab>("jira")

  const fetcher = useCallback(async (): Promise<IntegrationsData> => {
    const [connection, channels] = await Promise.all([
      api.jira.getConnection(),
      // A delivery-channel failure must not hide the Jira connection state.
      api.delivery.listChannels().catch(() => [] as DeliveryChannel[]),
    ])
    return { connection, channels }
  }, [])

  const {
    data,
    loading,
    error: loadError,
    missingOrg,
    reload,
    setData,
  } = useAsyncData(fetcher, "Failed to load integrations")

  const connection = data?.connection ?? null
  const channels = data?.channels ?? []

  const [showJiraForm, setShowJiraForm] = useState(false)
  const [jiraName, setJiraName] = useState("")
  const [jiraUrl, setJiraUrl] = useState("")
  const [jiraEmail, setJiraEmail] = useState("")
  const [jiraToken, setJiraToken] = useState("")
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [emailName, setEmailName] = useState("Email delivery")
  const [resendKey, setResendKey] = useState("")
  const [resendRecipients, setResendRecipients] = useState("")

  const [slackName, setSlackName] = useState("Slack delivery")
  const [slackWebhook, setSlackWebhook] = useState("")

  const [confName, setConfName] = useState("Confluence delivery")
  const [confUrl, setConfUrl] = useState("")
  const [confEmail, setConfEmail] = useState("")
  const [confToken, setConfToken] = useState("")
  const [confSpace, setConfSpace] = useState("")

  function switchTab(next: Tab) {
    setTab(next)
    setError(null)
    setNotice(null)
  }

  async function handleJiraConnect(e: React.FormEvent) {
    e.preventDefault()
    setConnecting(true)
    setError(null)
    setNotice(null)
    try {
      const conn = await api.jira.connect({
        connection_name: jiraName,
        jira_site_url: jiraUrl,
        email: jiraEmail,
        api_token: jiraToken,
      })
      setData((prev) => ({ connection: conn, channels: prev?.channels ?? [] }))
      setShowJiraForm(false)
      setNotice("Jira connected")
    } catch (err) {
      setError(errorMessage(err, "Failed to connect Jira"))
    } finally {
      // The API token is write-only: never keep it in state after the request.
      setJiraToken("")
      setConnecting(false)
    }
  }

  async function handleJiraDisconnect() {
    setDisconnecting(true)
    setError(null)
    setNotice(null)
    try {
      await api.jira.disconnect()
      setData((prev) => ({ connection: null, channels: prev?.channels ?? [] }))
      setJiraName("")
      setJiraUrl("")
      setJiraEmail("")
      setNotice("Jira disconnected")
    } catch (err) {
      setError(errorMessage(err, "Failed to disconnect Jira"))
    } finally {
      setDisconnecting(false)
    }
  }

  function openJiraForm() {
    setError(null)
    setNotice(null)
    if (connection) {
      setJiraName(connection.connection_name)
      setJiraUrl(connection.jira_site_url)
      setJiraEmail(connection.jira_email)
    }
    setJiraToken("")
    setShowJiraForm(true)
  }

  async function handleTest(channelType: DeliveryChannelType, config: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await api.delivery.test({ channel_type: channelType, config })
      if (result.success) setNotice("Connection successful")
      else setError(result.error_message || "Connection failed")
    } catch (err) {
      setError(errorMessage(err, "Connection test failed"))
    } finally {
      setBusy(false)
    }
  }

  async function handleSave(
    channelType: DeliveryChannelType,
    name: string,
    config: Record<string, unknown>,
    clearSecrets: () => void
  ) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await api.delivery.createChannel({ channel_type: channelType, name, config })
      const refreshed = await api.delivery.listChannels()
      setData((prev) => ({ connection: prev?.connection ?? null, channels: refreshed }))
      setNotice("Channel saved")
      clearSecrets()
    } catch (err) {
      setError(errorMessage(err, "Failed to save channel"))
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteChannel(channelId: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await api.delivery.deleteChannel(channelId)
      setData((prev) =>
        prev ? { ...prev, channels: prev.channels.filter((c) => c.id !== channelId) } : prev
      )
      setNotice("Channel removed")
    } catch (err) {
      setError(errorMessage(err, "Failed to remove channel"))
    } finally {
      setBusy(false)
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Mail }[] = [
    { id: "jira", label: "Jira", icon: Plug },
    { id: "email", label: "Email", icon: Mail },
    { id: "slack", label: "Slack", icon: MessageSquare },
    { id: "confluence", label: "Confluence", icon: BookOpen },
  ]

  const emailReady = Boolean(resendKey && resendRecipients.trim())
  const slackReady = Boolean(slackWebhook)
  const confluenceReady = Boolean(confUrl && confEmail && confToken)
  const emailConfig = {
    api_key: resendKey,
    recipients: resendRecipients
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean),
  }
  const confluenceConfig = {
    base_url: confUrl,
    email: confEmail,
    api_token: confToken,
    space_key: confSpace,
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">Integrations</h1>
      <p className="text-sm text-warm-500 mb-6">Connect services for data sync and report delivery</p>

      {missingOrg ? (
        <NoOrganizationState />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={reload} />
      ) : loading ? (
        <LoadingRows rows={3} />
      ) : (
        <>
          <div className="flex gap-2 mb-6">
            {tabs.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => switchTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${tab === t.id ? "bg-charcoal text-white" : "bg-white border border-warm-200 text-warm-600 hover:border-warm-300"}`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              )
            })}
          </div>

          <div className="bg-white rounded-xl border border-warm-200 p-6">
            {tab === "jira" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-charcoal">Jira Cloud</p>
                    <p className="text-xs text-warm-400">Retrieve projects, sprints, and issues</p>
                  </div>
                  {connection && (
                    <span className="flex items-center gap-1 text-xs text-status-done font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {connection.status === "active" ? "Connected" : connection.status}
                    </span>
                  )}
                </div>

                {connection && !showJiraForm ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-warm-50 rounded-lg space-y-1">
                      <p className="text-sm font-medium text-charcoal">{connection.connection_name}</p>
                      <p className="text-xs text-warm-500">{connection.jira_site_url}</p>
                      <p className="text-xs text-warm-400">{connection.jira_email}</p>
                      {connection.last_connected_at && (
                        <p className="text-xs text-warm-400">
                          Last connected {new Date(connection.last_connected_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {error && <p className="text-sm text-status-blocked bg-status-blocked/5 rounded-lg px-3 py-2">{error}</p>}
                    {notice && <p className="text-sm text-status-done bg-status-done/5 rounded-lg px-3 py-2">{notice}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={openJiraForm}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-warm-600 bg-warm-100 rounded-xl hover:bg-warm-200 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Update credentials
                      </button>
                      <button
                        onClick={handleJiraDisconnect}
                        disabled={disconnecting}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-status-blocked bg-status-blocked/5 rounded-xl hover:bg-status-blocked/10 transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : !showJiraForm ? (
                  <>
                    {error && <p className="text-sm text-status-blocked bg-status-blocked/5 rounded-lg px-3 py-2 mb-3">{error}</p>}
                    {notice && <p className="text-sm text-status-done bg-status-done/5 rounded-lg px-3 py-2 mb-3">{notice}</p>}
                    <button
                      onClick={openJiraForm}
                      className="w-full py-2.5 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors cursor-pointer"
                    >
                      Connect Jira
                    </button>
                  </>
                ) : (
                  <form onSubmit={handleJiraConnect} className="space-y-3">
                    <input
                      type="text"
                      value={jiraName}
                      onChange={(e) => setJiraName(e.target.value)}
                      placeholder="Connection name"
                      required
                      disabled={connecting}
                      className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
                    />
                    <input
                      type="url"
                      value={jiraUrl}
                      onChange={(e) => setJiraUrl(e.target.value)}
                      placeholder="https://your-team.atlassian.net"
                      required
                      disabled={connecting}
                      className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
                    />
                    <input
                      type="email"
                      value={jiraEmail}
                      onChange={(e) => setJiraEmail(e.target.value)}
                      placeholder="Jira email"
                      required
                      disabled={connecting}
                      className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
                    />
                    <input
                      type="password"
                      value={jiraToken}
                      onChange={(e) => setJiraToken(e.target.value)}
                      placeholder="API token"
                      required
                      minLength={10}
                      autoComplete="off"
                      disabled={connecting}
                      className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
                    />
                    <p className="text-xs text-warm-400">
                      Credentials are verified against Jira and stored encrypted. The token is never shown again.
                    </p>
                    {error && <p className="text-sm text-status-blocked bg-status-blocked/5 rounded-lg px-3 py-2">{error}</p>}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={connecting}
                        className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light disabled:opacity-40 cursor-pointer"
                      >
                        {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {connecting ? "Verifying..." : connection ? "Save" : "Connect"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowJiraForm(false)
                          setJiraToken("")
                          setError(null)
                        }}
                        className="px-4 py-2 text-sm text-warm-500 bg-warm-100 rounded-xl cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {tab === "email" && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-charcoal">Email Delivery (Resend)</p>
                  <p className="text-xs text-warm-400">Send reports via email</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Channel Name</label>
                  <input
                    type="text"
                    value={emailName}
                    onChange={(e) => setEmailName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Resend API Key</label>
                  <input
                    type="password"
                    value={resendKey}
                    onChange={(e) => setResendKey(e.target.value)}
                    placeholder="re_..."
                    autoComplete="off"
                    className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Recipients (comma-separated)</label>
                  <input
                    type="text"
                    value={resendRecipients}
                    onChange={(e) => setResendRecipients(e.target.value)}
                    placeholder="manager@company.com, lead@company.com"
                    className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <ChannelFeedback error={error} notice={notice} />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTest("email", emailConfig)}
                    disabled={busy || !resendKey}
                    className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light disabled:opacity-40 cursor-pointer"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Test Connection
                  </button>
                  <button
                    onClick={() =>
                      handleSave("email", emailName, emailConfig, () => setResendKey(""))
                    }
                    disabled={busy || !emailReady || !emailName}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-warm-600 bg-warm-100 rounded-xl hover:bg-warm-200 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Save Channel
                  </button>
                </div>
                <SavedChannels
                  channelType="email"
                  channels={channels}
                  busy={busy}
                  onDelete={handleDeleteChannel}
                />
              </div>
            )}

            {tab === "slack" && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-charcoal">Slack</p>
                  <p className="text-xs text-warm-400">Send reports to a Slack channel</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Channel Name</label>
                  <input
                    type="text"
                    value={slackName}
                    onChange={(e) => setSlackName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Webhook URL</label>
                  <input
                    type="password"
                    value={slackWebhook}
                    onChange={(e) => setSlackWebhook(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    autoComplete="off"
                    className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                  <p className="text-xs text-warm-400 mt-1">Create an Incoming Webhook in your Slack workspace settings</p>
                </div>
                <ChannelFeedback error={error} notice={notice} />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTest("slack", { webhook_url: slackWebhook })}
                    disabled={busy || !slackReady}
                    className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light disabled:opacity-40 cursor-pointer"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Test Connection
                  </button>
                  <button
                    onClick={() =>
                      handleSave("slack", slackName, { webhook_url: slackWebhook }, () => setSlackWebhook(""))
                    }
                    disabled={busy || !slackReady || !slackName}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-warm-600 bg-warm-100 rounded-xl hover:bg-warm-200 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Save Channel
                  </button>
                </div>
                <SavedChannels
                  channelType="slack"
                  channels={channels}
                  busy={busy}
                  onDelete={handleDeleteChannel}
                />
              </div>
            )}

            {tab === "confluence" && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-charcoal">Confluence</p>
                  <p className="text-xs text-warm-400">Publish reports as Confluence pages</p>
                </div>
                <input
                  type="text"
                  value={confName}
                  onChange={(e) => setConfName(e.target.value)}
                  placeholder="Channel name"
                  className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
                <input
                  type="url"
                  value={confUrl}
                  onChange={(e) => setConfUrl(e.target.value)}
                  placeholder="https://your-team.atlassian.net/wiki"
                  className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
                <input
                  type="email"
                  value={confEmail}
                  onChange={(e) => setConfEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
                <input
                  type="password"
                  value={confToken}
                  onChange={(e) => setConfToken(e.target.value)}
                  placeholder="API token"
                  autoComplete="off"
                  className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
                <input
                  type="text"
                  value={confSpace}
                  onChange={(e) => setConfSpace(e.target.value)}
                  placeholder="Space key (e.g. ENG)"
                  className="w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
                <ChannelFeedback error={error} notice={notice} />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTest("confluence", confluenceConfig)}
                    disabled={busy || !confluenceReady}
                    className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light disabled:opacity-40 cursor-pointer"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Test Connection
                  </button>
                  <button
                    onClick={() =>
                      handleSave("confluence", confName, confluenceConfig, () => setConfToken(""))
                    }
                    disabled={busy || !confluenceReady || !confSpace || !confName}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-warm-600 bg-warm-100 rounded-xl hover:bg-warm-200 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Save Channel
                  </button>
                </div>
                <SavedChannels
                  channelType="confluence"
                  channels={channels}
                  busy={busy}
                  onDelete={handleDeleteChannel}
                />
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  )
}

function ChannelFeedback({ error, notice }: { error: string | null; notice: string | null }) {
  if (!error && !notice) return null
  return (
    <>
      {error && <p className="text-sm text-status-blocked bg-status-blocked/5 rounded-lg px-3 py-2">{error}</p>}
      {notice && <p className="text-sm text-status-done bg-status-done/5 rounded-lg px-3 py-2">{notice}</p>}
    </>
  )
}

/**
 * A short identifying line for a saved channel. Deliberately reads only
 * non-secret fields — credentials are never rendered, masked or not.
 */
function channelSummary(channel: DeliveryChannel): string | null {
  const config = channel.config
  if (!config) return null

  const recipients = config.recipients
  if (Array.isArray(recipients) && recipients.length > 0) {
    return recipients.map(String).join(", ")
  }
  if (typeof config.space_key === "string" && config.space_key) {
    return `Space ${config.space_key}`
  }
  if (typeof config.channel === "string" && config.channel) {
    return config.channel
  }
  return null
}

function SavedChannels({
  channelType,
  channels,
  busy,
  onDelete,
}: {
  channelType: string
  channels: DeliveryChannel[]
  busy: boolean
  onDelete: (id: string) => void
}) {
  const saved = channels.filter((c) => c.channel_type === channelType)
  if (saved.length === 0) return null

  return (
    <div className="pt-4 border-t border-warm-100">
      <h4 className="text-xs font-semibold text-warm-600 uppercase tracking-wide mb-2">
        Saved {CHANNEL_LABELS[channelType] || channelType} Channels
      </h4>
      <div className="space-y-2">
        {saved.map((channel) => {
          const summary = channelSummary(channel)
          return (
          <div key={channel.id} className="flex items-center gap-3 p-3 bg-warm-50 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-charcoal truncate">{channel.name}</p>
              <p className="text-xs text-warm-400 truncate">
                {channel.enabled ? "Enabled" : "Disabled"}
                {summary ? ` · ${summary}` : ""}
              </p>
            </div>
            <button
              onClick={() => onDelete(channel.id)}
              disabled={busy}
              className="p-1.5 text-warm-400 hover:text-status-blocked transition-colors rounded-md hover:bg-status-blocked/5 disabled:opacity-40 cursor-pointer"
              title="Remove channel"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          )
        })}
      </div>
    </div>
  )
}
