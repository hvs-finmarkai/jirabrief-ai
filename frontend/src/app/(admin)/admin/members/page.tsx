"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Users, Plus, Shield, Trash2 } from "lucide-react"

export default function AdminMembersPage() {
  const [showInvite, setShowInvite] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("MEMBER")

  const members = [
    { id: "1", email: "you (current user)", role: "OWNER", joined: "Just now" },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-charcoal mb-1">Members & Roles</h1>
          <p className="text-sm text-warm-500">Manage organization access</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium hover:bg-charcoal-light cursor-pointer">
          <Plus className="w-4 h-4" />Invite Member
        </button>
      </div>

      {showInvite && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl border border-warm-200 p-5 mb-6">
          <h3 className="text-sm font-semibold text-charcoal mb-3">Invite Member</h3>
          <div className="flex gap-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@company.com" className="flex-1 px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="px-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-sm cursor-pointer">
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <button className="px-4 py-2 bg-charcoal text-white rounded-xl text-sm font-medium cursor-pointer">Send</button>
            <button onClick={() => setShowInvite(false)} className="px-4 py-2 text-sm text-warm-500 bg-warm-100 rounded-xl cursor-pointer">Cancel</button>
          </div>
        </motion.div>
      )}

      <div className="bg-white rounded-xl border border-warm-200">
        <div className="grid grid-cols-4 px-5 py-3 border-b border-warm-100 text-xs font-medium text-warm-500 uppercase tracking-wide">
          <span>Member</span><span>Role</span><span>Joined</span><span></span>
        </div>
        {members.map((m) => (
          <div key={m.id} className="grid grid-cols-4 px-5 py-4 border-b border-warm-50 items-center">
            <span className="text-sm text-charcoal">{m.email}</span>
            <span className="flex items-center gap-1.5 text-sm"><Shield className="w-3.5 h-3.5 text-accent" />{m.role}</span>
            <span className="text-sm text-warm-400">{m.joined}</span>
            <span className="text-right">
              {m.role !== "OWNER" && <button className="p-1.5 text-warm-400 hover:text-status-blocked rounded cursor-pointer"><Trash2 className="w-4 h-4" /></button>}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
