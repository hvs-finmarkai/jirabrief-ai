"use client"

import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  LayoutDashboard,
  Users,
  Plug,
  Brain,
  FileText,
  Shield,
  Activity,
  Sparkles,
  Settings,
  LogOut,
  ArrowLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { User } from "@supabase/supabase-js"

interface AdminSidebarProps {
  user: User
}

const navigation = [
  { name: "Admin Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Members & Roles", href: "/admin/members", icon: Users },
  { name: "Integrations", href: "/admin/integrations", icon: Plug },
  { name: "AI Configuration", href: "/admin/ai", icon: Brain },
  { name: "Report Settings", href: "/admin/report-settings", icon: FileText },
  { name: "Audit Logs", href: "/admin/audit", icon: Shield },
  { name: "System Health", href: "/admin/system-health", icon: Activity },
  { name: "Demo Management", href: "/admin/demo", icon: Sparkles },
  { name: "Organization", href: "/admin/settings", icon: Settings },
]

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "Admin"

  return (
    <aside className="w-60 border-r border-warm-200 bg-charcoal flex flex-col shrink-0 h-screen sticky top-0">
      <div className="p-5 border-b border-warm-800">
        <h1 className="text-base font-semibold text-white tracking-tight">Admin Console</h1>
        <p className="text-xs text-warm-400 mt-0.5">JiraBrief AI</p>
      </div>

      <div className="p-3">
        <a href="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-warm-400 hover:text-white hover:bg-warm-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />Back to App
        </a>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-auto">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <a
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-warm-800 text-white font-medium"
                  : "text-warm-400 hover:bg-warm-800/50 hover:text-warm-200"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.name}
            </a>
          )
        })}
      </nav>

      <div className="p-3 border-t border-warm-800">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-medium text-accent">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-warm-200 truncate">{displayName}</p>
            <p className="text-xs text-warm-500 truncate">Owner</p>
          </div>
          <button onClick={handleSignOut} className="p-1.5 text-warm-500 hover:text-white transition-colors rounded-md cursor-pointer">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
