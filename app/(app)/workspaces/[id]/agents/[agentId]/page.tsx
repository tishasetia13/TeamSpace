import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AgentChat from '@/components/agents/AgentChat'
import { getProvider } from '@/lib/agents/providers'
import type { AgentChatMessage } from '@/app/actions/agents'

// The dedicated 1-on-1 chat window for a single agent. This thread is PRIVATE to
// the current user — RLS on agent_chat_messages only returns their own rows.
export default async function AgentChatPage({
  params,
}: {
  params: Promise<{ id: string; agentId: string }>
}) {
  const { id, agentId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // RLS only returns this if the current user is a member of the workspace.
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', id)
    .maybeSingle()

  if (!workspace) {
    redirect('/dashboard')
  }

  // Load the agent's public config (RLS scopes this to our workspaces).
  const { data: agent } = await supabase
    .from('agents')
    .select('id, name, provider, model')
    .eq('id', agentId)
    .eq('workspace_id', id)
    .maybeSingle()

  if (!agent) {
    // Unknown agent (or not in this workspace) — send back to the workspace.
    redirect(`/workspaces/${id}`)
  }

  // Load this user's private history with the agent (oldest first).
  const { data: historyData } = await supabase
    .from('agent_chat_messages')
    .select('id, workspace_id, agent_id, user_id, role, body, created_at')
    .eq('agent_id', agentId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(200)

  const initialMessages = (historyData ?? []) as AgentChatMessage[]
  const provider = getProvider(agent.provider)

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="mx-auto w-full max-w-2xl space-y-6 py-10">
        <Link
          href={`/workspaces/${id}`}
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Back to {workspace.name}
        </Link>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {agent.name}
            </h1>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
              AI
            </span>
            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {provider?.label ?? agent.provider}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Private 1-on-1 session — only you can see this. Wrap up to share a
            summary with the team.
          </p>
        </div>

        <AgentChat
          workspaceId={id}
          agentId={agent.id}
          agentName={agent.name}
          initialMessages={initialMessages}
        />
      </div>
    </div>
  )
}
