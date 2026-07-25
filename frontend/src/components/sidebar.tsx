"use client"

import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Calendar,
  FileCode2,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { User } from "@supabase/supabase-js"

interface SidebarProps {
  user: User
  isAdmin?: boolean
}

const navigation = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Schedules", href: "/schedules", icon: Calendar },
  { name: "Templates", href: "/templates", icon: FileCode2 },
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "User"
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <aside className="w-60 border-r border-warm-200 bg-white flex flex-col shrink-0 h-screen sticky top-0">
      <div className="p-5 border-b border-warm-100">
        <h1 className="text-base font-semibold text-charcoal tracking-tight">JiraBrief AI</h1>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-auto">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <a
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-warm-100 text-charcoal font-medium"
                  : "text-warm-600 hover:bg-warm-50 hover:text-charcoal"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.name}
            </a>
          )
        })}
      </nav>

      <div className="p-3 border-t border-warm-100">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-xs font-medium text-accent">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-charcoal truncate">{displayName}</p>
            <p className="text-xs text-warm-400 truncate">{user.email}</p>
          </div>
          <button onClick={handleSignOut} className="p-1.5 text-warm-400 hover:text-charcoal transition-colors rounded-md hover:bg-warm-50 cursor-pointer" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
