'use client'

import { useEffect, useRef, useState } from 'react'
import {
  sendAgentChatMessageAction,
  summarizeSessionAction,
  type AgentChatMessage,
} from '@/app/actions/agents'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'

type Props = {
  workspaceId: string
  agentId: string
  agentName: string
  initialMessages: AgentChatMessage[]
}

export default function AgentChat({
  workspaceId,
  agentId,
  agentName,
  initialMessages,
}: Props) {
  const [messages, setMessages] = useState<AgentChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // True while we wait for the agent's reply (shows a "thinking…" bubble).
  const [thinking, setThinking] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  // Set once a summary has been posted to the shared feed.
  const [summaryPosted, setSummaryPosted] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Keep the newest message (or the thinking bubble) in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  function addMessage(msg: AgentChatMessage) {
    setMessages((prev) =>
      prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
    )
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return

    setSending(true)
    setError(null)
    setSummaryPosted(false)

    // Show the user's message instantly with a temporary id (there's no Realtime
    // here — the action returns the saved rows, but this keeps it snappy).
    const optimistic: AgentChatMessage = {
      id: `temp-${crypto.randomUUID()}`,
      workspace_id: workspaceId,
      agent_id: agentId,
      user_id: 'me',
      role: 'user',
      body,
      created_at: new Date().toISOString(),
    }
    addMessage(optimistic)
    setDraft('')
    setThinking(true)

    const res = await sendAgentChatMessageAction(workspaceId, agentId, body)

    setThinking(false)
    setSending(false)

    if (res.error) {
      setError(res.error)
    }
    if (res.agentMessage) addMessage(res.agentMessage)
  }

  // Enter sends; Shift+Enter makes a new line.
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend(e)
    }
  }

  async function handleSummarize() {
    if (summarizing) return
    setSummarizing(true)
    setError(null)
    setSummaryPosted(false)

    const res = await summarizeSessionAction(workspaceId, agentId)

    setSummarizing(false)
    if (res.error) setError(res.error)
    else setSummaryPosted(true)
  }

  // Formatted by hand (not toLocaleTimeString) so server and client first render
  // match exactly (avoids hydration errors) — same approach as the shared feed.
  function formatTime(iso: string) {
    const d = new Date(iso)
    const hour24 = d.getHours()
    const hour12 = hour24 % 12 || 12
    const minutes = d.getMinutes().toString().padStart(2, '0')
    const ampm = hour24 < 12 ? 'AM' : 'PM'
    return `${hour12}:${minutes} ${ampm}`
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-zinc-950">
      {/* Top bar: the "wrap up & share" action lives here. */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <span className="text-xs text-zinc-500">
          {messages.length === 0
            ? 'Private session — only you can see this'
            : `${messages.length} message${messages.length === 1 ? '' : 's'} in this session`}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSummarize}
          disabled={summarizing || messages.length === 0}
        >
          {summarizing ? 'Summarising…' : 'Wrap up & share to feed'}
        </Button>
      </div>

      {summaryPosted && (
        <p className="border-b border-emerald-500/20 bg-emerald-500/10 px-5 py-2 text-xs text-emerald-400">
          ✓ Summary posted to the team feed. Your teammates can see it now.
        </p>
      )}

      {/* Message list (scrolls) */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.length === 0 && (
          <p className="py-16 text-center text-sm text-zinc-500">
            Just you and {agentName}. Ask it to dig into something.
          </p>
        )}

        {messages.map((m) => {
          const isMine = m.role === 'user'

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

          return (
            <div key={m.id} className="flex items-end gap-2.5">
              <Avatar name={agentName} kind="agent" size="sm" />
              <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-zinc-800/70 px-3.5 py-2 text-sm text-zinc-100">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-zinc-200">
                    {agentName}
                  </span>
                  <span className="rounded bg-zinc-700 px-1 text-[9px] font-medium text-zinc-300">
                    AI
                  </span>
                </div>
                <p className="break-words whitespace-pre-wrap">{m.body}</p>
                <div className="mt-1 text-right text-[10px] text-zinc-500">
                  {formatTime(m.created_at)}
                </div>
              </div>
            </div>
          )
        })}

        {thinking && (
          <div className="flex items-end gap-2.5">
            <Avatar name={agentName} kind="agent" size="sm" />
            <div className="rounded-2xl rounded-bl-md bg-zinc-800/70 px-3.5 py-2 text-sm text-zinc-400">
              <span className="mb-0.5 block text-xs font-semibold text-zinc-300">
                {agentName}
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
            placeholder={`Ask ${agentName} to work on something…`}
            className="max-h-40 flex-1 resize-none bg-transparent py-1 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <Button type="submit" size="sm" disabled={sending || !draft.trim()}>
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </form>
    </section>
  )
}
