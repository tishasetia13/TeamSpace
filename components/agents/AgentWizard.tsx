'use client'

import { startTransition, useActionState, useEffect, useState } from 'react'
import {
  createAgentAction,
  type CreateAgentState,
} from '@/app/actions/agents'
import { getProvider, type ProviderId } from '@/lib/agents/providers'
import { RELAY, FONT } from '@/lib/ui/relay'

type Props = {
  workspaceId: string
  onCreated: () => void
  onCancel: () => void
}

const initialState: CreateAgentState = { error: null }

// The model picker maps the friendly label the user sees to the real provider id
// the server action expects.
const MODELS: { label: string; provider: ProviderId }[] = [
  { label: 'Claude', provider: 'anthropic' },
  { label: 'GPT', provider: 'openai' },
  { label: 'Gemini', provider: 'gemini' },
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: RELAY.bg,
  border: `1px solid ${RELAY.border}`,
  borderRadius: 8,
  padding: '10px 12px',
  color: RELAY.text,
  fontSize: 14,
  fontFamily: FONT,
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 500, color: RELAY.text2 }}>{children}</label>
  )
}

export default function AgentWizard({ workspaceId, onCreated, onCancel }: Props) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [provider, setProvider] = useState<ProviderId>('anthropic')
  const [instructions, setInstructions] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const [state, submit, pending] = useActionState(createAgentAction, initialState)

  useEffect(() => {
    if (state.ok) onCreated()
  }, [state, onCreated])

  const selected = getProvider(provider)

  function create() {
    if (!name.trim()) return setLocalError('Please give your agent a name.')
    if (!role.trim()) return setLocalError('Add a one-line role for the agent.')
    if (!instructions.trim()) return setLocalError('Tell the agent what it should do.')
    if (!apiKey.trim()) return setLocalError('Paste an API key so the agent can think.')
    setLocalError(null)
    startTransition(() => {
      submit({
        workspaceId,
        name,
        role,
        doesWhat: instructions,
        communicationStyle: '',
        avoid: '',
        provider,
        apiKey,
      })
    })
  }

  return (
    <div style={{ fontFamily: FONT, color: RELAY.text }}>
      {/* Name + Role */}
      <div style={{ display: 'flex', gap: 11 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Name</Label>
          <input
            className="rl-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nova"
            maxLength={60}
            autoFocus
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Role</Label>
          <input
            className="rl-input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Researcher"
            maxLength={200}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Model */}
      <div style={{ marginTop: 15 }}>
        <Label>Model</Label>
        <div style={{ display: 'flex', gap: 7, marginTop: 7 }}>
          {MODELS.map((m) => {
            const active = provider === m.provider
            return (
              <div
                key={m.provider}
                onClick={() => setProvider(m.provider)}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: 9,
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: 13,
                  border: `1px solid ${active ? RELAY.border2 : RELAY.border}`,
                  background: active ? RELAY.active : RELAY.bg,
                  color: active ? RELAY.text : RELAY.text2,
                }}
              >
                {m.label}
              </div>
            )
          })}
        </div>
      </div>

      {/* Instructions */}
      <div style={{ marginTop: 15, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Label>Instructions</Label>
        <textarea
          className="rl-area"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          maxLength={4000}
          placeholder="You are Nova, a sharp research analyst. You dig up sources, summarize fast, and never pad."
          style={{
            ...inputStyle,
            minHeight: 92,
            resize: 'vertical',
            fontSize: 13.5,
            lineHeight: 1.55,
          }}
        />
      </div>

      {/* API key (BYOK — required for the agent to reply) */}
      <div style={{ marginTop: 15, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Label>API key</Label>
        <input
          className="rl-input"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Paste the agent’s API key"
          autoComplete="off"
          style={inputStyle}
        />
        <p style={{ fontSize: 12, color: RELAY.text3, margin: 0 }}>
          {selected?.keyHint} Stored encrypted — never shown again.
        </p>
      </div>

      {(localError || state.error) && (
        <p style={{ fontSize: 13, color: '#f0a0a0', marginTop: 14 }}>
          {localError ?? state.error}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 9, marginTop: 20 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          style={{
            flex: 1,
            background: 'transparent',
            border: `1px solid ${RELAY.border2}`,
            color: RELAY.text,
            borderRadius: 9,
            padding: 11,
            fontWeight: 500,
            fontSize: 13.5,
            cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={create}
          disabled={pending}
          className="rl-white"
          style={{
            flex: 1,
            background: RELAY.white,
            color: '#0a0a0b',
            border: 'none',
            borderRadius: 9,
            padding: 11,
            fontWeight: 600,
            fontSize: 13.5,
            cursor: 'pointer',
            fontFamily: FONT,
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? 'Creating…' : 'Create'}
        </button>
      </div>
    </div>
  )
}
