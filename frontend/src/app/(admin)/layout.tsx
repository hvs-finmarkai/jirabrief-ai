import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminSidebar } from "@/components/admin-sidebar"

const ADMIN_EMAILS = ["admin@finmarkai.com"]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/admin/login")
  }

  const isAdmin = ADMIN_EMAILS.includes(user.email || "")

  if (!isAdmin) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen flex bg-warm-50">
      <AdminSidebar user={user} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
