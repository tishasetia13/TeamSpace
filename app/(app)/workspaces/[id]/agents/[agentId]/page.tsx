import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AgentChat from '@/components/agents/AgentChat'
import { Avatar } from '@/components/ui/avatar'
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
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <header className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
        <Link
          href={`/workspaces/${id}`}
          className="text-sm text-zinc-500 hover:text-zinc-200"
          title={`Back to ${workspace.name}`}
        >
          ←
        </Link>
        <Avatar name={agent.name} kind="agent" size="md" status />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold text-zinc-100">
              {agent.name}
            </h1>
            <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
              AI
            </span>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
              {provider?.label ?? agent.provider}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            Private 1-on-1 · wrap up to share a summary with the team
          </p>
        </div>
      </header>

      <AgentChat
        workspaceId={id}
        agentId={agent.id}
        agentName={agent.name}
        initialMessages={initialMessages}
      />
    </div>
  )
}
