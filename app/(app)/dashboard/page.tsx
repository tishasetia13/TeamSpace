import { redirect } from 'next/navigation'
import { Hanken_Grotesk, JetBrains_Mono } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import { initial } from '@/lib/ui/colors'
import WorkspacesHub, {
  type HubData,
  type HubWorkspace,
  type HubHero,
  type HubLastMessage,
} from '@/components/workspaces/WorkspacesHub'

// The dashboard design uses its own typefaces (Hanken Grotesk for UI, JetBrains
// Mono for the small "data" bits). Scoped to this screen via CSS variables.
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-hanken',
})
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
})

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

  // Every workspace this user belongs to (newest first). RLS returns other
  // members' rows for shared workspaces, so we filter to our own here.
  const { data } = await supabase
    .from('workspace_members')
    .select('role, workspaces(id, name, created_at)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  const memberships = (data ?? []) as unknown as MembershipRow[]
  const base = memberships
    .map((m) => ({ ...m.workspaces, role: m.role }))
    .filter(
      (w): w is { id: string; name: string; created_at: string; role: string } =>
        Boolean(w.id),
    )
  const ids = base.map((w) => w.id)

  // People and agents across all my workspaces — drives the counts, the stacked
  // avatars, and the sender names in the hero's last-message preview. RLS scopes
  // both to workspaces I belong to.
  const peopleByWs = new Map<string, { id: string; name: string }[]>()
  const agentsByWs = new Map<string, { id: string; name: string }[]>()

  if (ids.length) {
    const { data: memRows } = await supabase
      .from('workspace_members')
      .select('workspace_id, user_id, profiles(display_name, email)')
      .in('workspace_id', ids)
    type MemRow = {
      workspace_id: string
      user_id: string
      profiles: { display_name: string | null; email: string | null } | null
    }
    for (const r of (memRows ?? []) as unknown as MemRow[]) {
      const list = peopleByWs.get(r.workspace_id) ?? []
      list.push({
        id: r.user_id,
        name: r.profiles?.display_name || r.profiles?.email || 'Member',
      })
      peopleByWs.set(r.workspace_id, list)
    }

    const { data: agRows } = await supabase
      .from('agents')
      .select('id, workspace_id, name')
      .in('workspace_id', ids)
    type AgRow = { id: string; workspace_id: string; name: string }
    for (const r of (agRows ?? []) as AgRow[]) {
      const list = agentsByWs.get(r.workspace_id) ?? []
      list.push({ id: r.id, name: r.name })
      agentsByWs.set(r.workspace_id, list)
    }
  }

  // Build a workspace's display shape: counts + a stack of avatars (agents shown
  // as light squares first, then people as blue circles), capped with overflow.
  function shape(w: { id: string; name: string; role: string }): HubWorkspace {
    const people = peopleByWs.get(w.id) ?? []
    const agents = agentsByWs.get(w.id) ?? []
    const stack = [
      ...agents.map((a) => ({ initial: initial(a.name), kind: 'agent' as const })),
      ...people.map((p) => ({ initial: initial(p.name), kind: 'person' as const })),
    ]
    const cap = 4
    return {
      id: w.id,
      name: w.name,
      role: w.role,
      agentCount: agents.length,
      peopleCount: people.length,
      avatars: stack.slice(0, cap),
      overflow: Math.max(0, stack.length - cap),
    }
  }

  const workspaces = base.map(shape)

  // Hero = most recent workspace + its latest message, used for "Jump back in".
  let hero: HubHero | null = null
  if (base[0]) {
    const top = base[0]
    const { data: msgRows } = await supabase
      .from('messages')
      .select('body, type, created_at, user_id, agent_id')
      .eq('workspace_id', top.id)
      .order('created_at', { ascending: false })
      .limit(1)
    type MsgRow = {
      body: string
      type: string
      created_at: string
      user_id: string | null
      agent_id: string | null
    }
    const m = (msgRows?.[0] ?? null) as MsgRow | null

    let lastMessage: HubLastMessage | null = null
    if (m) {
      let senderName = 'Someone'
      let senderKind: 'person' | 'agent' = 'person'
      if (m.agent_id) {
        senderKind = 'agent'
        senderName =
          agentsByWs.get(top.id)?.find((a) => a.id === m.agent_id)?.name ??
          'Agent'
      } else if (m.user_id) {
        senderName =
          peopleByWs.get(top.id)?.find((p) => p.id === m.user_id)?.name ??
          'Member'
      }
      lastMessage = {
        senderName,
        senderInitial: initial(senderName),
        senderKind,
        body: m.body,
        createdAt: m.created_at,
      }
    }

    hero = { workspace: shape(top), lastMessage }
  }

  // Display name for the welcome + account avatar.
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  const hubData: HubData = {
    workspaces,
    hero,
    displayName: profile?.display_name ?? null,
    email: user.email ?? '',
  }

  return (
    <div className={`${hanken.variable} ${jetbrains.variable}`}>
      <WorkspacesHub data={hubData} />
    </div>
  )
}
