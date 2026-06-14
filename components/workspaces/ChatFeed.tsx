'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendMessageAction, type ChatMessage } from '@/app/actions/messages'
import { mentionAgentAction } from '@/app/actions/agents'
import { Button } from '@/components/ui/button'

type AgentRef = { id: string; name: string }

type Props = {
  workspaceId: string
  currentUserId: string
  initialMessages: ChatMessage[]
  // user_id -> display name, so we can label messages without re-querying.
  memberNames: Record<string, string>
  // The workspace's agents, for @mention detection and labelling agent replies.
  agents: AgentRef[]
}

// Escapes characters that have special meaning in a regular expression, so an
// agent named e.g. "C++ Helper" still matches literally.
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default function ChatFeed({
  workspaceId,
  currentUserId,
  initialMessages,
  memberNames,
  agents,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // When set, an agent is currently "thinking" — we show a placeholder bubble.
  const [thinkingAgent, setThinkingAgent] = useState<string | null>(null)
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

  // Clicking an agent chip drops "@Name " into the composer.
  function insertMention(name: string) {
    setDraft((d) => {
      const sep = d.length === 0 || d.endsWith(' ') ? '' : ' '
      return `${d}${sep}@${name} `
    })
  }

  function authorLabel(m: ChatMessage) {
    if (m.agent_id) return agentNames[m.agent_id] ?? 'Agent'
    if (m.user_id === currentUserId) return 'You'
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
    <div className="flex h-[28rem] flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Message list (scrolls) */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-zinc-400">
            No messages yet — say hi to your team.
          </p>
        )}

        {messages.map((m) => {
          // Activity events render as a centered system line.
          if (m.type === 'activity') {
            return (
              <p
                key={m.id}
                className="text-center text-xs text-zinc-400 dark:text-zinc-500"
              >
                {m.body}
              </p>
            )
          }

          const isAgent = !!m.agent_id
          const isMine = !isAgent && m.user_id === currentUserId

          return (
            <div
              key={m.id}
              className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
            >
              <span className="mb-0.5 flex items-center gap-1 px-1 text-xs text-zinc-400">
                {isMine ? 'You' : authorLabel(m)}
                {isAgent && (
                  <span className="rounded bg-indigo-100 px-1 text-[10px] font-medium text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                    AI
                  </span>
                )}
                <span className="text-zinc-300 dark:text-zinc-600">
                  {formatTime(m.created_at)}
                </span>
              </span>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  isMine
                    ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900'
                    : isAgent
                      ? 'border border-indigo-200 bg-indigo-50 text-zinc-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-zinc-100'
                      : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'
                }`}
              >
                {m.body}
              </div>
            </div>
          )
        })}

        {/* "Agent is thinking…" placeholder while we wait for the reply. */}
        {thinkingAgent && (
          <div className="flex flex-col items-start">
            <span className="mb-0.5 flex items-center gap-1 px-1 text-xs text-zinc-400">
              {thinkingAgent}
              <span className="rounded bg-indigo-100 px-1 text-[10px] font-medium text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                AI
              </span>
            </span>
            <div className="max-w-[80%] rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-zinc-500 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-zinc-400">
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
      <form
        onSubmit={handleSend}
        className="border-t border-zinc-200 p-3 dark:border-zinc-800"
      >
        {error && <p className="mb-2 px-1 text-xs text-red-500">{error}</p>}

        {/* Agent mention chips */}
        {agents.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-zinc-400">Mention an agent:</span>
            {agents.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => insertMention(a.name)}
                className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                @{a.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Message your team… (@mention an agent to ask it)"
            className="flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <Button type="submit" disabled={sending || !draft.trim()}>
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </form>
    </div>
  )
}
