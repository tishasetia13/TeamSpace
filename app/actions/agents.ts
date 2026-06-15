'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { encryptSecret, decryptSecret } from '@/lib/crypto/secrets'
import { getProvider, type ProviderId } from '@/lib/agents/providers'
import { askAgent } from '@/lib/agents/ask'
import type { ChatMessage } from '@/app/actions/messages'

// The safe-to-show shape of an agent. This deliberately does NOT include the
// API key — that lives encrypted in the agent_secrets table and is never sent
// to the browser. These fields match the `agents` table in supabase/schema.sql.
export type Agent = {
  id: string
  workspace_id: string
  created_by: string | null
  name: string
  system_prompt: string
  provider: ProviderId
  model: string
  created_at: string
}

// What the "create agent" wizard collects. Note there is NO "system prompt"
// here — we ask friendly, plain-English questions (inspired by OpenClaw's
// SOUL.md) and assemble the actual prompt ourselves in buildSystemPrompt().
export type NewAgentInput = {
  workspaceId: string
  name: string
  role: string // one-line identity, e.g. "a senior backend engineer"
  doesWhat: string // its main job / what it helps the team with
  communicationStyle?: string // optional: how it should talk
  avoid?: string // optional: anything it should never do
  provider: string
  apiKey: string
}

export type CreateAgentState = { error: string | null; ok?: boolean }

// Turns the wizard's friendly answers into a real system prompt. This is the
// single source of truth for how an agent's "personality" is phrased — the user
// never has to write prompt engineering themselves.
function buildSystemPrompt(f: {
  name: string
  role: string
  doesWhat: string
  communicationStyle: string
  avoid: string
}): string {
  const parts: string[] = [`You are ${f.name}, ${f.role}.`]
  parts.push(`\nWhat you do:\n${f.doesWhat}`)
  if (f.communicationStyle) {
    parts.push(`\nHow you communicate:\n${f.communicationStyle}`)
  }
  if (f.avoid) {
    parts.push(`\nWhat you never do:\n${f.avoid}`)
  }
  parts.push(
    `\nYou are an AI teammate inside a shared team workspace. Read the conversation for context, and do real, useful work for the team — not just chit-chat.`,
  )
  // Safety clamp so we always stay under the database's 8000-char limit.
  return parts.join('\n').slice(0, 8000)
}

// Called by the agent wizard on its final step. The create_agent database
// function also re-checks workspace membership, so security doesn't rely on
// this validation — it's here for fast, friendly error messages.
export async function createAgentAction(
  _prev: CreateAgentState,
  input: NewAgentInput,
): Promise<CreateAgentState> {
  const workspaceId = (input.workspaceId ?? '').trim()
  const name = (input.name ?? '').trim()
  const role = (input.role ?? '').trim()
  const doesWhat = (input.doesWhat ?? '').trim()
  const communicationStyle = (input.communicationStyle ?? '').trim()
  const avoid = (input.avoid ?? '').trim()
  const providerId = input.provider ?? ''
  const apiKey = (input.apiKey ?? '').trim()

  if (!workspaceId) return { error: 'Missing workspace.' }
  if (!name) return { error: 'Please give your agent a name.' }
  if (name.length > 60) {
    return { error: 'Agent name must be 60 characters or fewer.' }
  }
  if (!role) return { error: 'Please add a one-line description of who this agent is.' }
  if (role.length > 200) return { error: 'Keep the one-line description under 200 characters.' }
  if (!doesWhat) return { error: 'Please describe what this agent should help with.' }
  if (doesWhat.length > 4000) return { error: 'That description is too long (max 4000 characters).' }
  if (communicationStyle.length > 500) {
    return { error: 'Keep the communication style under 500 characters.' }
  }
  if (avoid.length > 500) return { error: 'Keep the “never do” note under 500 characters.' }

  const provider = getProvider(providerId)
  if (!provider) return { error: 'Please choose a provider.' }

  if (!apiKey) return { error: 'Please paste an API key for this agent.' }
  if (apiKey.length < 15 || apiKey.length > 300) {
    return { error: 'That API key doesn’t look right — double-check it.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in to create an agent.' }

  // Encrypt the key on the server BEFORE it goes anywhere near the database.
  let cipher: string
  try {
    cipher = encryptSecret(apiKey)
  } catch {
    return {
      error:
        'The server is missing its encryption key (AGENT_KEY_SECRET). Add it to .env.local and restart.',
    }
  }

  const systemPrompt = buildSystemPrompt({
    name,
    role,
    doesWhat,
    communicationStyle,
    avoid,
  })

  const { error } = await supabase.rpc('create_agent', {
    p_workspace_id: workspaceId,
    p_name: name,
    p_system_prompt: systemPrompt,
    p_provider: provider.id,
    p_model: provider.defaultModel,
    p_api_key_cipher: cipher,
  })

  if (error) {
    return { error: error.message ?? 'Could not create the agent.' }
  }

  // Refresh the workspace page so the new agent appears in everyone's list.
  revalidatePath(`/workspaces/${workspaceId}`)
  return { error: null, ok: true }
}

// Called by the "Delete" button on an agent. The delete_agent database function
// re-checks that the caller is a member of the agent's workspace.
export async function deleteAgentAction(
  workspaceId: string,
  agentId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const { error } = await supabase.rpc('delete_agent', { p_agent_id: agentId })
  if (error) {
    return { error: error.message ?? 'Could not delete the agent.' }
  }

  revalidatePath(`/workspaces/${workspaceId}`)
  return { error: null }
}

export type MentionResult = { error: string | null; message?: ChatMessage }

// How many recent feed messages to give the agent as context.
const FEED_CONTEXT_LIMIT = 40

// Called when a human @mentions an agent in the feed. It gathers the recent
// conversation, asks the agent's LLM (using the agent's own API key) for a
// reply, and posts that reply back into the feed as an `agent_mention` message.
// The agent reply then reaches everyone live over Realtime, just like a human
// message.
export async function mentionAgentAction(
  workspaceId: string,
  agentId: string,
): Promise<MentionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  // Load the agent's public config. RLS only returns it if we're a member of
  // its workspace, so this also confirms our access.
  const { data: agent } = await supabase
    .from('agents')
    .select('id, name, system_prompt, provider, model, workspace_id')
    .eq('id', agentId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!agent) return { error: 'That agent could not be found.' }

  const provider = getProvider(agent.provider)
  if (!provider) return { error: 'That agent has an unknown provider.' }
  if (!provider.enabled) {
    return {
      error: `${agent.name} runs on ${provider.label}, which can’t reply yet — that’s coming in a later update.`,
    }
  }

  // Fetch the encrypted key (members-only, via SECURITY DEFINER) and decrypt it
  // here on the server, right before the call.
  const { data: cipher, error: secretError } = await supabase.rpc(
    'get_agent_secret',
    { p_agent_id: agentId },
  )
  if (secretError || !cipher) {
    return { error: 'Could not load this agent’s API key.' }
  }

  let apiKey: string
  try {
    apiKey = decryptSecret(cipher as string)
  } catch {
    return { error: 'This agent’s stored API key could not be read.' }
  }

  // Build the recent conversation as a labelled transcript the agent can read.
  const userContent = await buildFeedContext(supabase, workspaceId, agent.name)

  // Ask the agent's LLM for a reply (uses the agent's own key + model). The
  // translator picks the right provider module based on the agent's provider.
  let reply: string
  try {
    reply = await askAgent({
      provider: provider.id,
      apiKey,
      model: agent.model,
      system: agent.system_prompt,
      userContent,
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'The agent could not reply.' }
  }

  // Post the reply into the feed as a message authored by the agent.
  const { data: posted, error: postError } = await supabase.rpc(
    'post_agent_message',
    {
      p_workspace_id: workspaceId,
      p_agent_id: agentId,
      p_body: reply.slice(0, 100000),
      p_type: 'agent_mention',
    },
  )

  if (postError || !posted) {
    return { error: postError?.message ?? 'The agent replied, but it couldn’t be posted.' }
  }

  return { error: null, message: posted as ChatMessage }
}

// Loads the recent feed and formats it as a plain-text transcript with author
// names, then appends the instruction for the agent. Names are resolved
// server-side so we never trust the client for who said what.
async function buildFeedContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  agentName: string,
): Promise<string> {
  const [{ data: messageRows }, { data: memberRows }, { data: agentRows }] =
    await Promise.all([
      supabase
        .from('messages')
        .select('user_id, agent_id, type, body, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(FEED_CONTEXT_LIMIT),
      supabase
        .from('workspace_members')
        .select('user_id, profiles(display_name, email)')
        .eq('workspace_id', workspaceId),
      supabase.from('agents').select('id, name').eq('workspace_id', workspaceId),
    ])

  const memberNames: Record<string, string> = {}
  for (const m of (memberRows ?? []) as unknown as {
    user_id: string
    profiles: { display_name: string | null; email: string | null } | null
  }[]) {
    memberNames[m.user_id] =
      m.profiles?.display_name || m.profiles?.email || 'Someone'
  }

  const agentNames: Record<string, string> = {}
  for (const a of (agentRows ?? []) as { id: string; name: string }[]) {
    agentNames[a.id] = a.name
  }

  // messageRows is newest-first; reverse to oldest-first for a natural read.
  const rows = (messageRows ?? []).slice().reverse() as {
    user_id: string | null
    agent_id: string | null
    type: string
    body: string
  }[]

  const lines = rows.map((m) => {
    const author = m.agent_id
      ? agentNames[m.agent_id] ?? 'Agent'
      : m.user_id
        ? memberNames[m.user_id] ?? 'Someone'
        : 'System'
    return `[${author}]: ${m.body}`
  })

  return [
    'You are an AI teammate participating in a shared team chat feed.',
    '',
    'Here is the recent conversation (oldest to newest):',
    lines.join('\n'),
    '',
    `You (${agentName}) were just @mentioned. Write a genuinely helpful, substantive reply that continues the conversation and does real work for the team. Reply with only your message — do not prefix it with your name or "[${agentName}]:".`,
  ].join('\n')
}
