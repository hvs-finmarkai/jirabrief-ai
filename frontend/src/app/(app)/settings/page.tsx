"use client"

import { useCallback, useState } from "react"
import { motion } from "framer-motion"
import { Building2, Users, UserCircle2, Trash2, Loader2 } from "lucide-react"
import {
  api,
  canManageOrganization,
  errorMessage,
  type Organization,
  type OrganizationMember,
  type Profile,
} from "@/lib/api"
import { useAsyncData } from "@/lib/use-async-data"
import { ErrorState, LoadingRows, NoOrganizationState } from "@/components/page-states"

const ROLE_STYLES: Record<string, string> = {
  OWNER: "bg-accent/10 text-accent",
  ADMIN: "bg-status-progress/10 text-status-progress",
  MEMBER: "bg-warm-200 text-warm-600",
  VIEWER: "bg-warm-100 text-warm-500",
}

interface SettingsData {
  organization: Organization
  organizations: Organization[]
  profile: Profile
  members: OrganizationMember[]
}

export default function SettingsPage() {
  const [actionError, setActionError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const fetcher = useCallback(async (): Promise<SettingsData> => {
    const [organization, organizations, profile, members] = await Promise.all([
      api.organizations.active(),
      api.organizations.list(),
      api.auth.me(),
      api.organizations.listMembers(),
    ])
    return { organization, organizations, profile, members }
  }, [])

  const { data, loading, error, missingOrg, reload, setData } = useAsyncData(
    fetcher,
    "Failed to load settings"
  )

  const organization = data?.organization ?? null
  const organizations = data?.organizations ?? []
  const profile = data?.profile ?? null
  const members = data?.members ?? []

  function handleSwitchOrg(organizationId: string) {
    api.organizations.setActive(organizationId)
    setActionError(null)
    reload()
  }

  async function handleRemoveMember(memberId: string) {
    setRemovingId(memberId)
    setActionError(null)
    try {
      await api.organizations.removeMember(memberId)
      setData((prev) =>
        prev ? { ...prev, members: prev.members.filter((m) => m.id !== memberId) } : prev
      )
    } catch (err) {
      setActionError(errorMessage(err, "Failed to remove member"))
    } finally {
      setRemovingId(null)
    }
  }

  const currentMember = profile ? members.find((m) => m.user_id === profile.user_id) : undefined
  const currentRole = currentMember?.role ?? null
  const canManage = canManageOrganization(currentRole)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">Settings</h1>
      <p className="text-sm text-warm-500 mb-6">Organization and account settings</p>

      {missingOrg ? (
        <NoOrganizationState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <LoadingRows rows={4} />
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-warm-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-warm-100 flex items-center justify-center">
                <Building2 className="w-4.5 h-4.5 text-warm-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-charcoal">Organization</h2>
                <p className="text-xs text-warm-400">Details for your active workspace</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-warm-50 rounded-lg">
                <p className="text-xs text-warm-400">Name</p>
                <p className="text-sm font-medium text-charcoal mt-0.5 truncate">{organization?.name}</p>
              </div>
              <div className="p-3 bg-warm-50 rounded-lg">
                <p className="text-xs text-warm-400">Slug</p>
                <p className="text-sm font-mono text-charcoal-light mt-0.5 truncate">{organization?.slug}</p>
              </div>
              <div className="p-3 bg-warm-50 rounded-lg">
                <p className="text-xs text-warm-400">Created</p>
                <p className="text-sm text-charcoal-light mt-0.5">
                  {organization ? new Date(organization.created_at).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>

            {organizations.length > 1 && (
              <div className="mt-4">
                <label className="text-xs font-medium text-warm-600 uppercase tracking-wide">Active Organization</label>
                <select
                  value={organization?.id ?? ""}
                  onChange={(e) => handleSwitchOrg(e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-warm-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-warm-100 flex items-center justify-center">
                <UserCircle2 className="w-4.5 h-4.5 text-warm-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-charcoal">Your Profile</h2>
                <p className="text-xs text-warm-400">How you appear in this organization</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-warm-50 rounded-lg">
                <p className="text-xs text-warm-400">Display Name</p>
                <p className="text-sm font-medium text-charcoal mt-0.5 truncate">{profile?.display_name || "—"}</p>
              </div>
              <div className="p-3 bg-warm-50 rounded-lg">
                <p className="text-xs text-warm-400">Role</p>
                <p className="mt-1">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_STYLES[currentRole ?? ""] || "bg-warm-200 text-warm-600"}`}
                  >
                    {currentRole ?? "Unknown"}
                  </span>
                </p>
              </div>
              <div className="p-3 bg-warm-50 rounded-lg">
                <p className="text-xs text-warm-400">Member Since</p>
                <p className="text-sm text-charcoal-light mt-0.5">
                  {profile ? new Date(profile.created_at).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-warm-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-warm-100 flex items-center justify-center">
                <Users className="w-4.5 h-4.5 text-warm-500" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-charcoal">Members</h2>
                <p className="text-xs text-warm-400">
                  {members.length} {members.length === 1 ? "person" : "people"} in this organization
                </p>
              </div>
            </div>

            {actionError && (
              <p className="text-sm text-status-blocked bg-status-blocked/5 rounded-lg px-3 py-2 mb-3">{actionError}</p>
            )}

            {members.length === 0 ? (
              <div className="py-8 text-center">
                <Users className="w-8 h-8 text-warm-300 mx-auto mb-3" />
                <p className="text-sm text-warm-500">No members</p>
                <p className="text-xs text-warm-400 mt-1">This organization has no members yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => {
                  const isSelf = profile?.user_id === member.user_id
                  const canRemove = canManage && !isSelf && member.role !== "OWNER"
                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 bg-warm-50 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-xs font-medium text-accent shrink-0">
                        {(isSelf && profile ? profile.display_name : member.user_id).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-charcoal truncate">
                          {isSelf && profile ? profile.display_name : "Team member"}
                          {isSelf && <span className="text-xs text-warm-400 font-normal"> (you)</span>}
                        </p>
                        <p className="text-xs text-warm-400 font-mono truncate">{member.user_id}</p>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${ROLE_STYLES[member.role] || "bg-warm-200 text-warm-600"}`}
                      >
                        {member.role}
                      </span>
                      {canRemove && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={removingId === member.id}
                          className="p-1.5 text-warm-400 hover:text-status-blocked transition-colors rounded-md hover:bg-status-blocked/5 disabled:opacity-40 cursor-pointer"
                          title="Remove member"
                        >
                          {removingId === member.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {!canManage && members.length > 0 && (
              <p className="text-xs text-warm-400 mt-3">
                Only owners and admins can remove members.
              </p>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
