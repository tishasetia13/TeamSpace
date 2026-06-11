import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InviteLink from '@/components/workspaces/InviteLink'

type MemberRow = {
  role: string
  joined_at: string
  user_id: string
  profiles: { display_name: string | null; email: string | null } | null
}

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // RLS only returns this row if the current user is a member of the workspace.
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, invite_token')
    .eq('id', id)
    .maybeSingle()

  if (!workspace) {
    // Either the workspace doesn't exist or we're not a member — send home.
    redirect('/dashboard')
  }

  const { data: memberData } = await supabase
    .from('workspace_members')
    .select('role, joined_at, user_id, profiles(display_name, email)')
    .eq('workspace_id', id)
    .order('joined_at', { ascending: true })

  const members = (memberData ?? []) as unknown as MemberRow[]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="mx-auto w-full max-w-2xl space-y-6 py-10">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← All workspaces
        </Link>

        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {workspace.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Invite link
          </h2>
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            Anyone with this link can join {workspace.name}.
          </p>
          <InviteLink token={workspace.invite_token} />
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Members
          </h2>
          <ul className="space-y-2">
            {members.map((m) => {
              const name =
                m.profiles?.display_name || m.profiles?.email || 'Unknown user'
              const isYou = m.user_id === user.id
              return (
                <li
                  key={m.user_id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-zinc-800 dark:text-zinc-200">
                    {name}
                    {isYou && (
                      <span className="ml-1 text-zinc-400">(you)</span>
                    )}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {m.role}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
