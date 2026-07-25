"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { BarChart3, FileText, Calendar, AlertTriangle, Sparkles } from "lucide-react"
import Link from "next/link"

const stats = [
  { label: "Connected Projects", value: "3", icon: BarChart3 },
  { label: "Reports Generated", value: "0", icon: FileText },
  { label: "Scheduled Reports", value: "0", icon: Calendar },
  { label: "Attention Items", value: "2", icon: AlertTriangle },
]

export default function DashboardPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-2xl font-semibold text-charcoal mb-1">Overview</h1>
      <p className="text-sm text-warm-500 mb-8">Your reporting dashboard</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl border border-warm-200 p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-warm-100 flex items-center justify-center">
                  <Icon className="w-4.5 h-4.5 text-warm-500" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-charcoal">{stat.value}</p>
              <p className="text-xs text-warm-500 mt-1">{stat.label}</p>
            </motion.div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-warm-200 p-6">
          <h2 className="text-sm font-semibold text-charcoal mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link href="/demo" className="flex items-center gap-3 p-3 rounded-lg hover:bg-warm-50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-charcoal">Generate Report</p>
                <p className="text-xs text-warm-400">Create a new AI-powered report</p>
              </div>
            </Link>
            <Link href="/integrations" className="flex items-center gap-3 p-3 rounded-lg hover:bg-warm-50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-warm-100 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-warm-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-charcoal">Connect Jira</p>
                <p className="text-xs text-warm-400">Link your Jira Cloud instance</p>
              </div>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-warm-200 p-6">
          <h2 className="text-sm font-semibold text-charcoal mb-4">Demo Workspace</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-warm-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-charcoal">CRM Migration</p>
                <p className="text-xs text-warm-400">Sprint 24 · 14 issues · 42.9% complete</p>
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-status-blocked/10 text-status-blocked">Needs Attention</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-warm-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-charcoal">Customer Portal</p>
                <p className="text-xs text-warm-400">Sprint 12 · 3 issues · Active</p>
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-status-progress/10 text-status-progress">On Track</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-warm-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-charcoal">Mobile Application</p>
                <p className="text-xs text-warm-400">Sprint 8 · 3 issues · Active</p>
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-status-done/10 text-status-done">Healthy</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
