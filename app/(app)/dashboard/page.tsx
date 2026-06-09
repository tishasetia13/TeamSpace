import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/auth/SignOutButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-8 w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
            Signed in as <span className="font-medium text-zinc-700 dark:text-zinc-300">{user.email}</span>
          </p>
        </div>
        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 text-sm text-zinc-400 dark:text-zinc-500">
          Milestone 1 complete — workspaces coming next.
        </div>
        <SignOutButton />
      </div>
    </div>
  )
}
