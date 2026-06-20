'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendMessageAction, type ChatMessage } from '@/app/actions/messages'
import { mentionAgentAction } from '@/app/actions/agents'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Modal } from '@/components/ui/modal'
import InviteLink from '@/components/workspaces/InviteLink'
import { nameColor } from '@/lib/ui/colors'

type AgentRef = { id: string; name: string }

type Props = {
  workspaceId: string
  workspaceName: string
  currentUserId: string
  initialMessages: ChatMessage[]
  // user_id -> display name, so we can label messages without re-querying.
  memberNames: Record<string, string>
  // The workspace's agents, for @mention detection and labelling agent replies.
  agents: AgentRef[]
  inviteToken: string
  peopleCount: number
  agentCount: number
}

// Escapes characters that have special meaning in a regular expression, so an
// agent named e.g. "C++ Helper" still matches literally.
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default function ChatFeed({
  workspaceId,
  workspaceName,
  currentUserId,
  initialMessages,
  memberNames,
  agents,
  inviteToken,
  peopleCount,
  agentCount,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // When set, an agent is currently "thinking" — we show a placeholder bubble.
  const [thinkingAgent, setThinkingAgent] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // agent_id -> name, derived from the agents list.
  const agentNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const a of agents) map[a.id] = a.name
    return map
  }, [agents])

  // Add a message to the list, but never the same one twice. We dedupe by id
  // because a message can show up two ways: the server action returns it
  // immediately AND Realtime echoes it back to us a moment later.
  function addMessage(msg: ChatMessage) {
    setMessages((prev) =>
      prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
    )
  }

  useEffect(() => {
    const supabase = createClient()
    let active = true

    // Unique channel name per mount (see the long note that used to live here):
    // supabase.channel() reuses an existing channel by name, and teardown is
    // async, so a fixed name can hand a remount an already-subscribed channel.
    const channel = supabase.channel(
      `messages:${workspaceId}:${crypto.randomUUID()}`,
    )

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => addMessage(payload.new as ChatMessage),
    )

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!active) return
      if (session) {
        supabase.realtime.setAuth(session.access_token)
      }
      channel.subscribe()
    })()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [workspaceId])

  // Keep the newest message (or the thinking bubble) in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinkingAgent])

  // Returns the first agent @mentioned in the text, or null. We match "@" + the
  // agent's name (case-insensitive). First match wins — one reply per message.
  function findMentionedAgent(text: string): AgentRef | null {
    for (const a of agents) {
      const re = new RegExp(`@${escapeRegExp(a.name)}\\b`, 'i')
      if (re.test(text)) return a
    }
    return null
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return

    setSending(true)
    setError(null)
    const result = await sendMessageAction(workspaceId, body)
    setSending(false)

    if (result.error) {
      setError(result.error)
      return
    }
    setDraft('')
    if (result.message) addMessage(result.message) // show it instantly

    // If the message @mentioned an agent, ask it to reply.
    const mentioned = findMentionedAgent(body)
    if (mentioned) {
      setThinkingAgent(mentioned.name)
      const res = await mentionAgentAction(workspaceId, mentioned.id)
      setThinkingAgent(null)
      if (res.error) setError(res.error)
      else if (res.message) addMessage(res.message)
    }
  }

  // Enter sends; Shift+Enter makes a new line.
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend(e)
    }
  }

  function authorLabel(m: ChatMessage) {
    if (m.agent_id) return agentNames[m.agent_id] ?? 'Agent'
    if (m.user_id) return memberNames[m.user_id] ?? 'Someone'
    return 'System'
  }

  // Formatted by hand (not toLocaleTimeString) so the server-rendered HTML and
  // the browser's first render always match exactly (avoids hydration errors).
  function formatTime(iso: string) {
    const d = new Date(iso)
    const hour24 = d.getHours()
    const hour12 = hour24 % 12 || 12
    const minutes = d.getMinutes().toString().padStart(2, '0')
    const ampm = hour24 < 12 ? 'AM' : 'PM'
    return `${hour12}:${minutes} ${ampm}`
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-zinc-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-zinc-100">
            Team feed
          </h1>
          <p className="text-xs text-zinc-500">
            {peopleCount} {peopleCount === 1 ? 'person' : 'people'} ·{' '}
            {agentCount} {agentCount === 1 ? 'agent' : 'agents'}
          </p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          Invite
        </Button>
      </header>

      {/* Message list (scrolls) */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.length === 0 && (
          <p className="py-16 text-center text-sm text-zinc-500">
            No messages yet — say hi to your team.
          </p>
        )}

        {messages.map((m) => {
          // Activity events render as a centered system line.
          if (m.type === 'activity') {
            return (
              <p key={m.id} className="text-center text-xs text-zinc-600">
                {m.body}
              </p>
            )
          }

          const isAgent = !!m.agent_id
          const isMine = !isAgent && m.user_id === currentUserId
          const label = authorLabel(m)
          const colorKey = isAgent ? m.agent_id! : (m.user_id ?? 'system')

          // Your own messages: right-aligned navy bubble, no avatar.
          if (isMine) {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl rounded-br-md bg-[#1b2b40] px-3.5 py-2 text-sm text-zinc-50">
                  <p className="break-words whitespace-pre-wrap">{m.body}</p>
                  <div className="mt-1 text-right text-[10px] text-zinc-400">
                    {formatTime(m.created_at)}
                  </div>
                </div>
              </div>
            )
          }

          // Everyone else (humans + agents): left-aligned, avatar + gray bubble.
          return (
            <div key={m.id} className="flex items-end gap-2.5">
              <Avatar name={label} kind={isAgent ? 'agent' : 'person'} size="sm" />
              <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-zinc-800/70 px-3.5 py-2 text-sm text-zinc-100">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span className={`text-xs font-semibold ${nameColor(colorKey)}`}>
                    {label}
                  </span>
                  {isAgent && (
                    <span className="rounded bg-zinc-700 px-1 text-[9px] font-medium text-zinc-300">
                      AI
                    </span>
                  )}
                  {m.type === 'agent_summary' && (
                    <span className="rounded bg-emerald-500/15 px-1 text-[9px] font-medium text-emerald-400">
                      SUMMARY
                    </span>
                  )}
                </div>
                <p className="break-words whitespace-pre-wrap">{m.body}</p>
                <div className="mt-1 text-right text-[10px] text-zinc-500">
                  {formatTime(m.created_at)}
                </div>
              </div>
            </div>
          )
        })}

        {/* "Agent is thinking…" placeholder while we wait for the reply. */}
        {thinkingAgent && (
          <div className="flex items-end gap-2.5">
            <Avatar name={thinkingAgent} kind="agent" size="sm" />
            <div className="rounded-2xl rounded-bl-md bg-zinc-800/70 px-3.5 py-2 text-sm text-zinc-400">
              <span className="mb-0.5 block text-xs font-semibold text-zinc-300">
                {thinkingAgent}
              </span>
              <span className="inline-flex items-center gap-1">
                thinking
                <span className="animate-pulse">…</span>
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} className="border-t border-white/10 px-5 py-4">
        {error && <p className="mb-2 px-1 text-xs text-red-400">{error}</p>}
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-zinc-900 px-3 py-2 focus-within:border-white/20">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Message the team — use @ to bring in an agent"
            className="max-h-40 flex-1 resize-none bg-transparent py-1 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <Button type="submit" size="sm" disabled={sending || !draft.trim()}>
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </form>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={`Invite to ${workspaceName}`}
      >
        <p className="mb-3 text-xs text-zinc-400">
          Anyone with this link can join {workspaceName}.
        </p>
        <InviteLink token={inviteToken} />
      </Modal>
    </section>
  )
}
