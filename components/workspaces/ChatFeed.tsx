'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendMessageAction, type ChatMessage } from '@/app/actions/messages'
import { mentionAgentAction } from '@/app/actions/agents'
import { RELAY, FONT, fmtClock, letter } from '@/lib/ui/relay'

type AgentRef = { id: string; name: string }

type Props = {
  workspaceId: string
  workspaceName: string
  currentUserId: string
  initialMessages: ChatMessage[]
  memberNames: Record<string, string>
  agents: AgentRef[]
  inviteToken: string
  peopleCount: number
  agentCount: number
}

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
  const [thinkingAgent, setThinkingAgent] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const agentNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const a of agents) map[a.id] = a.name
    return map
  }, [agents])

  function addMessage(msg: ChatMessage) {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
  }

  useEffect(() => {
    const supabase = createClient()
    let active = true

    const channel = supabase.channel(`messages:${workspaceId}:${crypto.randomUUID()}`)
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
      if (session) supabase.realtime.setAuth(session.access_token)
      channel.subscribe()
    })()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [workspaceId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinkingAgent])

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
    if (result.message) addMessage(result.message)

    const mentioned = findMentionedAgent(body)
    if (mentioned) {
      setThinkingAgent(mentioned.name)
      const res = await mentionAgentAction(workspaceId, mentioned.id)
      setThinkingAgent(null)
      if (res.error) setError(res.error)
      else if (res.message) addMessage(res.message)
    }
  }

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

  // WhatsApp-style grouping: a message is "grouped" with the one above it when
  // they share the same author with no activity line between them — grouped
  // messages hide the repeated avatar + name. Computed off-render in a memo so we
  // never mutate state during render (which this React version rejects).
  const groupedById = useMemo(() => {
    const out: Record<string, boolean> = {}
    let prevKey: string | null = null
    for (const m of messages) {
      if (m.type === 'activity') {
        prevKey = null
        continue
      }
      const key = m.agent_id ? `a:${m.agent_id}` : `u:${m.user_id ?? 'sys'}`
      out[m.id] = prevKey === key
      prevKey = key
    }
    return out
  }, [messages])

  return (
    <section
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        background: RELAY.bg,
        fontFamily: FONT,
        color: RELAY.text,
        height: '100%',
      }}
    >
      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px 8px' }}>
        {messages.length === 0 && (
          <p style={{ padding: '64px 0', textAlign: 'center', fontSize: 14, color: RELAY.text3 }}>
            No messages yet — say hi to your team.
          </p>
        )}

        {messages.map((m) => {
          if (m.type === 'activity') {
            return (
              <p key={m.id} style={{ textAlign: 'center', fontSize: 11, color: RELAY.text3, padding: '6px 0' }}>
                {m.body}
              </p>
            )
          }

          const isAgent = !!m.agent_id
          const isMine = !isAgent && m.user_id === currentUserId
          const label = authorLabel(m)
          const grouped = groupedById[m.id] ?? false
          const isSummary = m.type === 'agent_summary'

          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                gap: 8,
                padding: '1.5px 0',
                alignItems: 'flex-end',
                justifyContent: isMine ? 'flex-end' : 'flex-start',
              }}
            >
              {!isMine &&
                (grouped ? (
                  <div style={{ width: 28, flex: 'none' }} />
                ) : (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      flex: 'none',
                      borderRadius: isAgent ? 7 : '50%',
                      background: isAgent ? RELAY.agent : RELAY.person,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      color: isAgent ? RELAY.agentText : '#fff',
                      fontSize: 11,
                    }}
                  >
                    {letter(label)}
                  </div>
                ))}

              <div
                style={{
                  maxWidth: '70%',
                  minWidth: 74,
                  background: isMine ? RELAY.mineBg : RELAY.elev,
                  border: `1px solid ${isMine ? RELAY.mineBorder : RELAY.border}`,
                  borderRadius: 13,
                  ...(isMine ? { borderTopRightRadius: 4 } : { borderTopLeftRadius: 4 }),
                  padding: '7px 11px 5px',
                }}
              >
                {!isMine && !grouped && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 12.5, color: isAgent ? RELAY.agentName : RELAY.personName }}>
                      {label}
                    </span>
                    {isSummary && (
                      <span style={{ fontSize: 9, fontWeight: 600, color: RELAY.green, background: 'rgba(111,191,154,0.14)', padding: '1px 6px', borderRadius: 20 }}>
                        SUMMARY
                      </span>
                    )}
                  </div>
                )}
                <div style={{ color: RELAY.text, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14 }}>
                  {m.body}
                </div>
                <div suppressHydrationWarning style={{ textAlign: 'right', fontSize: 11, color: 'rgba(255,255,255,0.32)', marginTop: 1 }}>
                  {fmtClock(m.created_at)}
                </div>
              </div>
            </div>
          )
        })}

        {/* Agent typing indicator */}
        {thinkingAgent && (
          <div style={{ display: 'flex', gap: 12, padding: '7px 0', alignItems: 'center' }}>
            <div
              style={{
                width: 28,
                height: 28,
                flex: 'none',
                borderRadius: 7,
                background: RELAY.agent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                color: RELAY.agentText,
                fontSize: 11,
              }}
            >
              {letter(thinkingAgent)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{thinkingAgent}</span>
              <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                {[0, 0.2, 0.4].map((d) => (
                  <span
                    key={d}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: RELAY.text2,
                      animation: `rl-blink 1.3s infinite ${d}s`,
                    }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} style={{ flex: 'none', padding: '10px 22px 18px' }}>
        {error && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#f0a0a0' }}>{error}</p>}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 9,
            background: RELAY.panel,
            border: `1px solid ${RELAY.border2}`,
            borderRadius: 11,
            padding: '6px 6px 6px 14px',
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Message the team — use @ to bring in an agent"
            className="rl-area"
            style={{
              flex: 1,
              maxHeight: 160,
              resize: 'none',
              background: 'transparent',
              border: 'none',
              color: RELAY.text,
              fontSize: 14,
              padding: '8px 0',
              fontFamily: FONT,
            }}
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="rl-send"
            style={{
              flex: 'none',
              background: RELAY.sendGrad,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              height: 34,
              padding: '0 16px',
              fontWeight: 600,
              fontSize: 13,
              cursor: sending || !draft.trim() ? 'default' : 'pointer',
              opacity: sending || !draft.trim() ? 0.6 : 1,
              fontFamily: FONT,
            }}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  )
}
