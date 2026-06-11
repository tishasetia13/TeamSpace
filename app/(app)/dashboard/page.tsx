import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/auth/SignOutButton'
import CreateWorkspaceForm from '@/components/workspaces/CreateWorkspaceForm'

type MembershipRow = {
  role: string
  workspaces: { id: string; name: string; created_at: string } | null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Every workspace this user belongs to (newest first).
  const { data } = await supabase
    .from('workspace_members')
    .select('role, workspaces(id, name, created_at)')
    .order('joined_at', { ascending: false })

  const memberships = (data ?? []) as unknown as MembershipRow[]
  const workspaces = memberships
    .map((m) => ({ ...m.workspaces, role: m.role }))
    .filter((w): w is { id: string; name: string; created_at: string; role: string } => Boolean(w.id))

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="mx-auto w-full max-w-2xl space-y-6 py-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Your workspaces
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Signed in as{' '}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {user.email}
              </span>
            </p>
          </div>
          <SignOutButton />
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Create a new workspace
          </h2>
          <CreateWorkspaceForm />
        </div>

        <div className="space-y-2">
          {workspaces.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
              No workspaces yet. Create one above, or open an invite link from a
              teammate to join theirs.
            </div>
          ) : (
            workspaces.map((w) => (
              <Link
                key={w.id}
                href={`/workspaces/${w.id}`}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {w.name}
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {w.role}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
