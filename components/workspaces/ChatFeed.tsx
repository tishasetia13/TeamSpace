'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendMessageAction, type ChatMessage } from '@/app/actions/messages'
import { Button } from '@/components/ui/button'

type Props = {
  workspaceId: string
  currentUserId: string
  initialMessages: ChatMessage[]
  // user_id -> display name, so we can label messages without re-querying.
  memberNames: Record<string, string>
}

export default function ChatFeed({
  workspaceId,
  currentUserId,
  initialMessages,
  memberNames,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Add a message to the list, but never the same one twice. We dedupe by id
  // because a message we send shows up two ways: the server action returns it
  // immediately AND Realtime echoes it back to us a moment later.
  function addMessage(msg: ChatMessage) {
    setMessages((prev) =>
      prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
    )
  }

  // Subscribe to live INSERTs on this workspace's messages. Whenever anyone
  // (including us) posts, the database pushes the new row here and we append it.
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | undefined

    async function subscribe() {
      // Realtime checks the same "members can read workspace messages" rule
      // as everything else, so it needs our login session attached to the
      // socket — otherwise it connects as a logged-out user and the rule
      // blocks every event.
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        supabase.realtime.setAuth(session.access_token)
      }

      channel = supabase
        .channel(`messages:${workspaceId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `workspace_id=eq.${workspaceId}`,
          },
          (payload) => addMessage(payload.new as ChatMessage),
        )
        .subscribe()
    }

    void subscribe()

    // Tidy up when the user leaves the page so we don't leak connections.
    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [workspaceId])

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
  }

  // Enter sends; Shift+Enter makes a new line.
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend(e)
    }
  }

  function nameFor(userId: string | null) {
    if (!userId) return 'Agent'
    return memberNames[userId] ?? 'Someone'
  }

  // Formatted by hand (not toLocaleTimeString) so the server-rendered HTML
  // and the browser's first render always match exactly — Node and browsers
  // can disagree on "AM"/"PM" vs "am"/"pm", which causes hydration errors.
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
          // Activity events render as a centered system line (used more in M4+).
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

          const isMine = m.user_id === currentUserId
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
            >
              <span className="mb-0.5 px-1 text-xs text-zinc-400">
                {isMine ? 'You' : nameFor(m.user_id)}{' '}
                <span className="text-zinc-300 dark:text-zinc-600">
                  {formatTime(m.created_at)}
                </span>
              </span>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  isMine
                    ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'
                }`}
              >
                {m.body}
              </div>
            </div>
          )
        })}
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
            placeholder="Message your team…"
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
