'use client'

import { useEffect, useRef, useState } from 'react'
import {
  sendAgentChatMessageAction,
  summarizeSessionAction,
  type AgentChatMessage,
} from '@/app/actions/agents'
import { RELAY, FONT, fmtClock, letter } from '@/lib/ui/relay'

type Props = {
  workspaceId: string
  agentId: string
  agentName: string
  agentRole?: string
  providerLabel?: string
  initialMessages: AgentChatMessage[]
}

export default function AgentChat({
  workspaceId,
  agentId,
  agentName,
  agentRole,
  providerLabel,
  initialMessages,
}: Props) {
  const [messages, setMessages] = useState<AgentChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thinking, setThinking] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [summaryPosted, setSummaryPosted] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  function addMessage(msg: AgentChatMessage) {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return

    setSending(true)
    setError(null)
    setSummaryPosted(false)

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

    if (res.error) setError(res.error)
    if (res.agentMessage) addMessage(res.agentMessage)
  }

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
      {/* Header: agent identity + wrap-up action */}
      <header
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 22px',
          borderBottom: `1px solid ${RELAY.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              flex: 'none',
              borderRadius: 8,
              background: RELAY.agent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              color: RELAY.agentText,
              fontSize: 13,
            }}
          >
            {letter(agentName)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {agentName}
              </span>
              <span style={{ fontSize: 9, fontWeight: 600, color: RELAY.agentText, background: RELAY.agent, padding: '1px 6px', borderRadius: 5 }}>
                AI
              </span>
              {providerLabel && (
                <span style={{ fontSize: 10.5, fontWeight: 600, color: RELAY.accent2, background: 'rgba(119,141,169,0.16)', padding: '2px 8px', borderRadius: 20 }}>
                  {providerLabel}
                </span>
              )}
            </div>
            <p style={{ margin: '1px 0 0', fontSize: 12, color: RELAY.text3 }}>
              {agentRole ? `${agentRole} · ` : ''}Private 1-on-1 — wrap up to share a summary
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSummarize}
          disabled={summarizing || messages.length === 0}
          className="rl-outline"
          style={{
            flex: 'none',
            background: 'transparent',
            border: `1px solid ${RELAY.border2}`,
            color: RELAY.text2,
            borderRadius: 9,
            padding: '8px 14px',
            fontWeight: 500,
            fontSize: 13,
            cursor: summarizing || messages.length === 0 ? 'default' : 'pointer',
            opacity: summarizing || messages.length === 0 ? 0.5 : 1,
            fontFamily: FONT,
            whiteSpace: 'nowrap',
          }}
        >
          {summarizing ? 'Summarising…' : 'Wrap up & share'}
        </button>
      </header>

      {summaryPosted && (
        <p
          style={{
            margin: 0,
            padding: '8px 22px',
            fontSize: 12,
            color: RELAY.green,
            background: 'rgba(111,191,154,0.10)',
            borderBottom: '1px solid rgba(111,191,154,0.20)',
          }}
        >
          ✓ Summary posted to the team feed. Your teammates can see it now.
        </p>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px 8px' }}>
        {messages.length === 0 && (
          <p style={{ padding: '64px 0', textAlign: 'center', fontSize: 14, color: RELAY.text3 }}>
            Just you and {agentName}. Ask it to dig into something.
          </p>
        )}

        {messages.map((m) => {
          const isMine = m.role === 'user'
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
              {!isMine && (
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
                  {letter(agentName)}
                </div>
              )}
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

        {thinking && (
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
              {letter(agentName)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{agentName}</span>
              <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                {[0, 0.2, 0.4].map((d) => (
                  <span key={d} style={{ width: 5, height: 5, borderRadius: '50%', background: RELAY.text2, animation: `rl-blink 1.3s infinite ${d}s` }} />
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
            placeholder={`Message ${agentName}…`}
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
