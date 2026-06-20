import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChatFeed from '@/components/workspaces/ChatFeed'
import WorkspaceSidebar from '@/components/workspaces/WorkspaceSidebar'
import type { ChatMessage } from '@/app/actions/messages'
import type { Agent } from '@/app/actions/agents'

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

  // Build a quick user_id -> name lookup so the feed can label messages
  // without each message needing its own database join.
  const memberNames: Record<string, string> = {}
  for (const m of members) {
    memberNames[m.user_id] =
      m.profiles?.display_name || m.profiles?.email || 'Unknown user'
  }

  // Load the existing conversation (oldest first). RLS guarantees we only get
  // messages from workspaces we belong to.
  const { data: messageData } = await supabase
    .from('messages')
    .select('id, workspace_id, user_id, agent_id, type, body, created_at')
    .eq('workspace_id', id)
    .order('created_at', { ascending: true })
    .limit(200)

  const initialMessages = (messageData ?? []) as ChatMessage[]

  // Load this workspace's agents (public fields only — the encrypted API key
  // never leaves the server). RLS limits this to workspaces we belong to.
  const { data: agentData } = await supabase
    .from('agents')
    .select('id, workspace_id, created_by, name, system_prompt, provider, model, created_at')
    .eq('workspace_id', id)
    .order('created_at', { ascending: true })

  const agents = (agentData ?? []) as Agent[]

  // Shape the sidebar's people list, and find the current user's own name/role.
  const people = members.map((m) => ({
    id: m.user_id,
    name: m.profiles?.display_name || m.profiles?.email || 'Unknown user',
    role: m.role,
    isYou: m.user_id === user.id,
  }))
  const me = people.find((p) => p.isYou)

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <WorkspaceSidebar
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
        people={people}
        currentUserName={me?.name ?? user.email ?? 'You'}
        currentUserRole={me?.role ?? 'member'}
      />

      <ChatFeed
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        currentUserId={user.id}
        initialMessages={initialMessages}
        memberNames={memberNames}
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
        inviteToken={workspace.invite_token}
        peopleCount={members.length}
        agentCount={agents.length}
      />
    </div>
  )
}
