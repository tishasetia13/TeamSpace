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
  // Note: RLS lets us read every membership row of a workspace we're in
  // (so the workspace page can show the full member list), so we must
  // filter to our own rows here ourselves.
  const { data } = await supabase
    .from('workspace_members')
    .select('role, workspaces(id, name, created_at)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  const memberships = (data ?? []) as unknown as MembershipRow[]
  const workspaces = memberships
    .map((m) => ({ ...m.workspaces, role: m.role }))
    .filter((w): w is { id: string; name: string; created_at: string; role: string } => Boolean(w.id))

  return (
    <div className="min-h-screen bg-zinc-950 p-4 text-zinc-100">
      <div className="mx-auto w-full max-w-2xl space-y-8 py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-50">
              Your workspaces
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Signed in as{' '}
              <span className="font-medium text-zinc-300">{user.email}</span>
            </p>
          </div>
          <div className="w-32 shrink-0">
            <SignOutButton />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900 p-5">
          <h2 className="mb-3 text-sm font-medium text-zinc-300">
            Create a new workspace
          </h2>
          <CreateWorkspaceForm />
        </div>

        <div className="space-y-2">
          {workspaces.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
              No workspaces yet. Create one above, or open an invite link from a
              teammate to join theirs.
            </div>
          ) : (
            workspaces.map((w) => (
              <Link
                key={w.id}
                href={`/workspaces/${w.id}`}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900 p-4 transition-colors hover:border-white/20 hover:bg-zinc-800"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-sm font-bold text-zinc-900">
                  {w.name.trim()[0]?.toUpperCase() ?? 'W'}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-zinc-50">
                  {w.name}
                </span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-400">
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
