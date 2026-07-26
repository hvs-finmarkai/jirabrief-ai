"use client"

import { useCallback, useState } from "react"
import { motion } from "framer-motion"
import { Building2, Users, UserCircle2, Trash2, Loader2, MailPlus, X } from "lucide-react"
import {
  ApiError,
  api,
  assignableRoles,
  canManageOrganization,
  canRemoveMember,
  errorMessage,
  invitableRoles,
  type InviteRole,
  type MemberRole,
  type Organization,
  type OrganizationInvite,
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

const INPUT_CLASS =
  "mt-1 w-full px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-accent/20"
const SELECT_CLASS = `${INPUT_CLASS} cursor-pointer`
const LABEL_CLASS = "text-xs font-medium text-warm-600 uppercase tracking-wide"

interface SettingsData {
  organization: Organization
  organizations: Organization[]
  profile: Profile
  members: OrganizationMember[]
  /** null when the viewer isn't allowed to see invites, or the call failed. */
  invites: OrganizationInvite[] | null
}

/** Best available identity for a member; profile fields are null until first sign-in. */
function memberIdentity(member: OrganizationMember, isSelf: boolean) {
  const name = member.display_name || member.email || "Awaiting first sign-in"
  const secondary = member.display_name ? member.email : member.email ? null : "Has not signed in yet"
  const initialsSource = member.display_name || member.email || "?"
  return {
    name: isSelf ? `${name} (you)` : name,
    secondary,
    initials: initialsSource.slice(0, 2).toUpperCase(),
    unknown: !member.display_name && !member.email,
  }
}

export default function SettingsPage() {
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetcher = useCallback(async (): Promise<SettingsData> => {
    const [organization, organizations, profile, members] = await Promise.all([
      api.organizations.active(),
      api.organizations.list(),
      api.auth.me(),
      api.organizations.listMembers(),
    ])

    // Listing invites is OWNER/ADMIN only, so only ask when the viewer qualifies.
    const role = members.find((m) => m.user_id === profile.user_id)?.role ?? null
    const invites = canManageOrganization(role)
      ? await api.organizations.listInvites().catch(() => null)
      : null

    return { organization, organizations, profile, members, invites }
  }, [])

  const { data, loading, error, missingOrg, reload, setData } = useAsyncData(
    fetcher,
    "Failed to load settings"
  )

  const organization = data?.organization ?? null
  const organizations = data?.organizations ?? []
  const profile = data?.profile ?? null
  const members = data?.members ?? []
  const invites = data?.invites ?? null

  const currentMember = profile ? members.find((m) => m.user_id === profile.user_id) : undefined
  const currentRole = currentMember?.role ?? null
  const canManage = canManageOrganization(currentRole)
  const ownerCount = members.filter((m) => m.role === "OWNER").length

  function handleSwitchOrg(organizationId: string) {
    api.organizations.setActive(organizationId)
    setActionError(null)
    reload()
  }

  async function handleRemoveMember(member: OrganizationMember) {
    setBusyId(member.id)
    setActionError(null)
    try {
      await api.organizations.removeMember(member.id)
      setData((prev) =>
        prev ? { ...prev, members: prev.members.filter((m) => m.id !== member.id) } : prev
      )
    } catch (err) {
      setActionError(errorMessage(err, "Failed to remove member"))
    } finally {
      setBusyId(null)
    }
  }

  async function handleRoleChange(member: OrganizationMember, role: MemberRole) {
    setBusyId(member.id)
    setActionError(null)
    try {
      const updated = await api.organizations.updateMemberRole(member.id, role)
      setData((prev) =>
        prev
          ? { ...prev, members: prev.members.map((m) => (m.id === updated.id ? updated : m)) }
          : prev
      )
    } catch (err) {
      setActionError(errorMessage(err, "Failed to change role"))
    } finally {
      setBusyId(null)
    }
  }

  async function handleRevokeInvite(invite: OrganizationInvite) {
    setBusyId(invite.id)
    setActionError(null)
    try {
      await api.organizations.revokeInvite(invite.id)
      setData((prev) =>
        prev && prev.invites
          ? { ...prev, invites: prev.invites.filter((i) => i.id !== invite.id) }
          : prev
      )
    } catch (err) {
      setActionError(errorMessage(err, "Failed to revoke invite"))
    } finally {
      setBusyId(null)
    }
  }

  function handleInvited(invite: OrganizationInvite) {
    setData((prev) => {
      if (!prev) return prev
      const existing = prev.invites ?? []
      // Re-inviting an address updates the existing row rather than adding one.
      const withoutDuplicate = existing.filter((i) => i.id !== invite.id)
      return { ...prev, invites: [invite, ...withoutDuplicate] }
    })
  }

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
                <label className={LABEL_CLASS}>Active Organization</label>
                <select
                  value={organization?.id ?? ""}
                  onChange={(e) => handleSwitchOrg(e.target.value)}
                  className={SELECT_CLASS}
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

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-warm-50 rounded-lg">
                <p className="text-xs text-warm-400">Display Name</p>
                <p className="text-sm font-medium text-charcoal mt-0.5 truncate">
                  {profile?.display_name || "—"}
                </p>
              </div>
              <div className="p-3 bg-warm-50 rounded-lg">
                <p className="text-xs text-warm-400">Email</p>
                <p className="text-sm text-charcoal-light mt-0.5 truncate">
                  {currentMember?.email || "—"}
                </p>
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
              <p className="text-sm text-status-blocked bg-status-blocked/5 rounded-lg px-3 py-2 mb-3">
                {actionError}
              </p>
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
                  const identity = memberIdentity(member, Boolean(isSelf))
                  const roleOptions = isSelf ? [] : assignableRoles(currentRole, member.role)
                  // The backend refuses to leave the org without an owner.
                  const lastOwner = member.role === "OWNER" && ownerCount <= 1
                  const showRoleSelect = roleOptions.length > 0 && !lastOwner
                  const showRemove = canRemoveMember({
                    actorRole: currentRole,
                    targetRole: member.role,
                    isSelf: Boolean(isSelf),
                    ownerCount,
                  })
                  const busy = busyId === member.id

                  return (
                    <div key={member.id} className="flex items-center gap-3 p-3 bg-warm-50 rounded-lg">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${identity.unknown ? "bg-warm-200 text-warm-500" : "bg-accent/10 text-accent"}`}
                      >
                        {identity.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-charcoal truncate">{identity.name}</p>
                        {identity.secondary && (
                          <p className="text-xs text-warm-400 truncate">{identity.secondary}</p>
                        )}
                      </div>

                      {showRoleSelect ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member, e.target.value as MemberRole)}
                          disabled={busy}
                          title="Change role"
                          className="px-2 py-1 bg-white border border-warm-200 rounded-lg text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer disabled:opacity-40 shrink-0"
                        >
                          {roleOptions.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${ROLE_STYLES[member.role] || "bg-warm-200 text-warm-600"}`}
                        >
                          {member.role}
                        </span>
                      )}

                      {busy && <Loader2 className="w-4 h-4 text-warm-400 animate-spin shrink-0" />}

                      {showRemove && (
                        <button
                          onClick={() => handleRemoveMember(member)}
                          disabled={busy}
                          className="p-1.5 text-warm-400 hover:text-status-blocked transition-colors rounded-md hover:bg-status-blocked/5 disabled:opacity-40 cursor-pointer"
                          title="Remove member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {canManage && ownerCount <= 1 && members.length > 1 && (
              <p className="text-xs text-warm-400 mt-3">
                The only owner cannot be demoted or removed. Promote another owner first.
              </p>
            )}

            {!canManage && members.length > 0 && (
              <p className="text-xs text-warm-400 mt-3">
                Only owners and admins can invite people or change roles.
              </p>
            )}

            {canManage && currentRole === "ADMIN" && (
              <p className="text-xs text-warm-400 mt-3">
                As an admin you can manage members and viewers. Only an owner can change owners and
                admins.
              </p>
            )}
          </div>

          {canManage && (
            <InvitesCard
              invites={invites}
              currentRole={currentRole}
              busyId={busyId}
              onInvited={handleInvited}
              onRevoke={handleRevokeInvite}
              onError={setActionError}
            />
          )}
        </div>
      )}
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/* Invites                                                                     */
/* -------------------------------------------------------------------------- */

function InvitesCard({
  invites,
  currentRole,
  busyId,
  onInvited,
  onRevoke,
  onError,
}: {
  invites: OrganizationInvite[] | null
  currentRole: string | null
  busyId: string | null
  onInvited: (invite: OrganizationInvite) => void
  onRevoke: (invite: OrganizationInvite) => void
  onError: (message: string | null) => void
}) {
  const roleOptions = invitableRoles(currentRole)
  const [email, setEmail] = useState("")
  // MEMBER is offered to owners and admins alike, and is the backend's default.
  const [role, setRole] = useState<InviteRole>("MEMBER")
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    setNotice(null)
    onError(null)
    try {
      const invite = await api.organizations.createInvite({ email: email.trim(), role })
      onInvited(invite)
      setNotice(
        `${invite.email} is on the list as ${invite.role}. No email goes out — tell them yourself, and they will join automatically the next time they sign in with that address.`
      )
      setEmail("")
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        // EmailStr rejects the address before the route runs; its raw message is
        // pydantic-flavoured, so say it plainly instead.
        setFormError("Enter a valid email address.")
      } else {
        setFormError(errorMessage(err, "Failed to add the invite"))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-warm-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-warm-100 flex items-center justify-center">
          <MailPlus className="w-4.5 h-4.5 text-warm-500" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-charcoal">Invites</h2>
          <p className="text-xs text-warm-400">
            Record who should join and the role they get
          </p>
        </div>
      </div>

      <div className="px-3 py-2 bg-warm-50 rounded-lg mb-4">
        <p className="text-xs text-warm-500">
          Adding someone here does not send them an email. Pass the word along yourself — they are
          added to this organization automatically the next time they sign in with that address.
        </p>
      </div>

      <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="sm:col-span-2">
          <label className={LABEL_CLASS}>Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            required
            disabled={busy}
            className={`${INPUT_CLASS} disabled:opacity-50`}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as InviteRole)}
            disabled={busy}
            className={`${SELECT_CLASS} disabled:opacity-50`}
          >
            {roleOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {currentRole === "ADMIN" && (
            <p className="text-xs text-warm-400 mt-1">Only an owner can invite an admin.</p>
          )}
        </div>

        {formError && (
          <p className="sm:col-span-3 text-sm text-status-blocked bg-status-blocked/5 rounded-lg px-3 py-2">
            {formError}
          </p>
        )}
        {notice && (
          <p className="sm:col-span-3 text-sm text-status-done bg-status-done/5 rounded-lg px-3 py-2">
            {notice}
          </p>
        )}

        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light transition-colors disabled:opacity-40 cursor-pointer"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailPlus className="w-4 h-4" />}
            Add to organization
          </button>
        </div>
      </form>

      <div className="pt-4 border-t border-warm-100">
        <h4 className="text-xs font-semibold text-warm-600 uppercase tracking-wide mb-2">
          Waiting to join {invites ? `(${invites.length})` : ""}
        </h4>

        {invites === null ? (
          <p className="text-xs text-warm-400">
            Pending invites could not be loaded. Reload the page to try again.
          </p>
        ) : invites.length === 0 ? (
          <p className="text-xs text-warm-400">
            Nobody is waiting to join. Add an address above to pre-approve someone.
          </p>
        ) : (
          <div className="space-y-2">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center gap-3 p-3 bg-warm-50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-warm-200 flex items-center justify-center text-xs font-medium text-warm-500 shrink-0">
                  {invite.email.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-charcoal truncate">{invite.email}</p>
                  <p className="text-xs text-warm-400">
                    Added {new Date(invite.created_at).toLocaleDateString()} · joins on next sign-in
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${ROLE_STYLES[invite.role] || "bg-warm-200 text-warm-600"}`}
                >
                  {invite.role}
                </span>
                <button
                  onClick={() => onRevoke(invite)}
                  disabled={busyId === invite.id}
                  className="p-1.5 text-warm-400 hover:text-status-blocked transition-colors rounded-md hover:bg-status-blocked/5 disabled:opacity-40 cursor-pointer"
                  title="Revoke invite"
                >
                  {busyId === invite.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
