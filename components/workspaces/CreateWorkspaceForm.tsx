'use client'

import { useActionState } from 'react'
import { createWorkspaceAction, type ActionState } from '@/app/actions/workspaces'
import { RELAY, FONT } from '@/lib/ui/relay'

const initialState: ActionState = { error: null }

export default function CreateWorkspaceForm() {
  const [state, formAction, pending] = useActionState(
    createWorkspaceAction,
    initialState,
  )

  return (
    <form action={formAction} style={{ fontFamily: FONT, color: RELAY.text }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: RELAY.text2 }}>
        Workspace name
      </label>
      <input
        name="name"
        placeholder="e.g. Weekend Hackathon Squad"
        maxLength={60}
        required
        autoComplete="off"
        autoFocus
        className="rl-input"
        style={{
          width: '100%',
          marginTop: 6,
          background: RELAY.bg,
          border: `1px solid ${RELAY.border}`,
          borderRadius: 8,
          padding: '10px 12px',
          color: RELAY.text,
          fontSize: 14,
          fontFamily: FONT,
        }}
      />

      {state.error && (
        <p style={{ fontSize: 13, color: '#f0a0a0', margin: '10px 0 0' }}>{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rl-white"
        style={{
          width: '100%',
          marginTop: 18,
          background: RELAY.white,
          color: '#0a0a0b',
          border: 'none',
          borderRadius: 9,
          padding: 11,
          fontWeight: 600,
          fontSize: 13.5,
          cursor: pending ? 'default' : 'pointer',
          opacity: pending ? 0.7 : 1,
          fontFamily: FONT,
        }}
      >
        {pending ? 'Creating…' : 'Create workspace'}
      </button>
    </form>
  )
}
