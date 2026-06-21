import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AgentChat from '@/components/agents/AgentChat'
import WorkspaceSidebar from '@/components/workspaces/WorkspaceSidebar'
import { getProvider } from '@/lib/agents/providers'
import { RELAY } from '@/lib/ui/relay'
import type { AgentChatMessage } from '@/app/actions/agents'

type MemberRow = {
  role: string
  user_id: string
  profiles: { display_name: string | null; email: string | null } | null
}

// The dedicated 1-on-1 chat window for a single agent, shown inside the same
// workspace shell (persistent sidebar). The thread is PRIVATE to the current
// user — RLS on agent_chat_messages only returns their own rows.
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
    .select('id, name, invite_token')
    .eq('id', id)
    .maybeSingle()

  if (!workspace) {
    redirect('/dashboard')
  }

  // The agent being chatted with.
  const { data: agent } = await supabase
    .from('agents')
    .select('id, name, provider, model')
    .eq('id', agentId)
    .eq('workspace_id', id)
    .maybeSingle()

  if (!agent) {
    redirect(`/workspaces/${id}`)
  }

  // Everything the sidebar needs: members (people) + the workspace's agents.
  const { data: memberData } = await supabase
    .from('workspace_members')
    .select('role, user_id, profiles(display_name, email)')
    .eq('workspace_id', id)
    .order('joined_at', { ascending: true })
  const members = (memberData ?? []) as unknown as MemberRow[]
  const people = members.map((m) => ({
    id: m.user_id,
    name: m.profiles?.display_name || m.profiles?.email || 'Unknown user',
    role: m.role,
    isYou: m.user_id === user.id,
  }))
  const me = people.find((p) => p.isYou)

  const { data: agentData } = await supabase
    .from('agents')
    .select('id, name')
    .eq('workspace_id', id)
    .order('created_at', { ascending: true })
  const agents = (agentData ?? []) as { id: string; name: string }[]

  // This user's private history with the agent (oldest first).
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
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: RELAY.bg, color: RELAY.text }}
    >
      <WorkspaceSidebar
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        agents={agents}
        people={people}
        currentUserName={me?.name ?? user.email ?? 'You'}
        currentUserRole={me?.role ?? 'member'}
        inviteToken={workspace.invite_token}
        activeAgentId={agent.id}
      />

      <AgentChat
        workspaceId={id}
        agentId={agent.id}
        agentName={agent.name}
        providerLabel={provider?.label ?? agent.provider}
        initialMessages={initialMessages}
      />
    </div>
  )
}
