"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Users, Plus, Shield, Trash2, Check, X, UserPlus, Clock } from "lucide-react"

interface PendingUser {
  id: string
  email: string
  display_name: string
  requested_at: string
}

interface ApprovedUser {
  id: string
  email: string
  display_name: string
  role: string
  approved_at: string
}

export default function AdminMembersPage() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([
    { id: "p1", email: "sarah@company.com", display_name: "Sarah Chen", requested_at: "2026-07-26T01:30:00Z" },
    { id: "p2", email: "david@company.com", display_name: "David Park", requested_at: "2026-07-26T01:32:00Z" },
  ])

  const [approvedUsers, setApprovedUsers] = useState<ApprovedUser[]>([
    { id: "a1", email: "admin@finmarkai.com", display_name: "Admin", role: "OWNER", approved_at: "2026-07-26T01:00:00Z" },
  ])

  const [showAddUser, setShowAddUser] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState("MEMBER")

  function handleApprove(userId: string, role: string) {
    const user = pendingUsers.find((u) => u.id === userId)
    if (!user) return
    setPendingUsers(pendingUsers.filter((u) => u.id !== userId))
    setApprovedUsers([...approvedUsers, { id: user.id, email: user.email, display_name: user.display_name, role, approved_at: new Date().toISOString() }])
  }

  function handleReject(userId: string) {
    setPendingUsers(pendingUsers.filter((u) => u.id !== userId))
  }

  function handleRemoveUser(userId: string) {
    setApprovedUsers(approvedUsers.filter((u) => u.id !== userId))
  }

  function handleRoleChange(userId: string, newRole: string) {
    setApprovedUsers(approvedUsers.map((u) => u.id === userId ? { ...u, role: newRole } : u))
  }

  function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    setApprovedUsers([...approvedUsers, { id: crypto.randomUUID(), email: newEmail, display_name: newEmail.split("@")[0], role: newRole, approved_at: new Date().toISOString() }])
    setNewEmail("")
    setShowAddUser(false)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-charcoal mb-1">Members & Roles</h1>
          <p className="text-sm text-warm-500">Manage organization access and approvals</p>
        </div>
        <button onClick={() => setShowAddUser(true)} className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light cursor-pointer">
          <UserPlus className="w-4 h-4" />Add User
        </button>
      </div>

      {showAddUser && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl border border-warm-200 p-5 mb-6">
          <h3 className="text-sm font-semibold text-charcoal mb-3">Add User Directly</h3>
          <form onSubmit={handleAddUser} className="flex gap-3">
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@company.com" required className="flex-1 px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm cursor-pointer">
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <button type="submit" className="px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium cursor-pointer">Add</button>
            <button type="button" onClick={() => setShowAddUser(false)} className="px-4 py-2 text-sm text-warm-500 bg-warm-100 rounded-xl cursor-pointer">Cancel</button>
          </form>
        </motion.div>
      )}

      {pendingUsers.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-status-progress" />
            <h2 className="text-sm font-semibold text-charcoal">Pending Approval ({pendingUsers.length})</h2>
          </div>
          <div className="bg-white rounded-xl border border-status-progress/30 overflow-hidden">
            {pendingUsers.map((user, i) => (
              <div key={user.id} className={`flex items-center gap-4 px-5 py-4 ${i < pendingUsers.length - 1 ? "border-b border-warm-50" : ""}`}>
                <div className="w-9 h-9 rounded-full bg-status-progress/10 flex items-center justify-center text-xs font-medium text-status-progress">
                  {user.display_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-charcoal">{user.display_name}</p>
                  <p className="text-xs text-warm-400">{user.email} · Requested {new Date(user.requested_at).toLocaleDateString()}</p>
                </div>
                <select defaultValue="MEMBER" id={`role-${user.id}`} className="px-2 py-1 text-xs bg-warm-50 border border-warm-200 rounded-lg cursor-pointer">
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                </select>
                <button onClick={() => { const el = document.getElementById(`role-${user.id}`) as HTMLSelectElement; handleApprove(user.id, el.value) }} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-status-done bg-status-done/10 rounded-lg hover:bg-status-done/20 cursor-pointer">
                  <Check className="w-3.5 h-3.5" />Approve
                </button>
                <button onClick={() => handleReject(user.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-status-blocked bg-status-blocked/10 rounded-lg hover:bg-status-blocked/20 cursor-pointer">
                  <X className="w-3.5 h-3.5" />Reject
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-charcoal" />
          <h2 className="text-sm font-semibold text-charcoal">Active Members ({approvedUsers.length})</h2>
        </div>
        <div className="bg-white rounded-xl border border-warm-200">
          <div className="grid grid-cols-12 px-5 py-3 border-b border-warm-100 text-xs font-medium text-warm-500 uppercase tracking-wide">
            <span className="col-span-4">User</span>
            <span className="col-span-3">Email</span>
            <span className="col-span-2">Role</span>
            <span className="col-span-2">Joined</span>
            <span className="col-span-1"></span>
          </div>
          {approvedUsers.map((user) => (
            <div key={user.id} className="grid grid-cols-12 px-5 py-4 border-b border-warm-50 items-center">
              <div className="col-span-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-xs font-medium text-accent">
                  {user.display_name.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm text-charcoal">{user.display_name}</span>
              </div>
              <span className="col-span-3 text-sm text-warm-500">{user.email}</span>
              <div className="col-span-2">
                {user.role === "OWNER" ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-accent"><Shield className="w-3 h-3" />OWNER</span>
                ) : (
                  <select value={user.role} onChange={(e) => handleRoleChange(user.id, e.target.value)} className="px-2 py-1 text-xs bg-warm-50 border border-warm-200 rounded-lg cursor-pointer">
                    <option value="ADMIN">ADMIN</option>
                    <option value="MEMBER">MEMBER</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                )}
              </div>
              <span className="col-span-2 text-xs text-warm-400">{new Date(user.approved_at).toLocaleDateString()}</span>
              <div className="col-span-1 text-right">
                {user.role !== "OWNER" && (
                  <button onClick={() => handleRemoveUser(user.id)} className="p-1.5 text-warm-400 hover:text-status-blocked rounded cursor-pointer" title="Remove user">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
