'use client'

import { useEffect, useRef, useState } from 'react'
import {
  sendAgentChatMessageAction,
  summarizeSessionAction,
  type AgentChatMessage,
} from '@/app/actions/agents'
import { Button } from '@/components/ui/button'

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
    <div className="flex h-[32rem] flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Top bar: the "wrap up & share" action lives here. */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 p-3 dark:border-zinc-800">
        <span className="text-xs text-zinc-400">
          {messages.length === 0
            ? 'Start a private session'
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
        <p className="border-b border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          ✓ Summary posted to the team feed. Your teammates can see it now.
        </p>
      )}

      {/* Message list (scrolls) */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-zinc-400">
            Just you and {agentName}. Ask it to dig into something.
          </p>
        )}

        {messages.map((m) => {
          const isMine = m.role === 'user'
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
            >
              <span className="mb-0.5 flex items-center gap-1 px-1 text-xs text-zinc-400">
                {isMine ? 'You' : agentName}
                {!isMine && (
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
                    : 'border border-indigo-200 bg-indigo-50 text-zinc-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-zinc-100'
                }`}
              >
                {m.body}
              </div>
            </div>
          )
        })}

        {thinking && (
          <div className="flex flex-col items-start">
            <span className="mb-0.5 flex items-center gap-1 px-1 text-xs text-zinc-400">
              {agentName}
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

        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={`Ask ${agentName} to work on something…`}
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
