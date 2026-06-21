'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import AgentWizard from '@/components/agents/AgentWizard'
import InviteLink from '@/components/workspaces/InviteLink'
import { deleteAgentAction } from '@/app/actions/agents'
import { RELAY, FONT, letter } from '@/lib/ui/relay'

type AgentRef = { id: string; name: string }
type Person = { id: string; name: string; role: string; isYou: boolean }

type Props = {
  workspaceId: string
  workspaceName: string
  agents: AgentRef[]
  people: Person[]
  currentUserName: string
  currentUserRole: string
  inviteToken: string
  // When the sidebar is shown on an agent's 1-on-1 page, this is the active
  // agent's id; otherwise the Team feed row is the active one.
  activeAgentId?: string | null
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.03em',
        color: RELAY.text3,
      }}
    >
      {children}
    </span>
  )
}

function PlusButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rl-faint"
      style={{
        fontSize: 15,
        lineHeight: 1,
        color: RELAY.text2,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 500,
      }}
    >
      ＋
    </button>
  )
}

export default function WorkspaceSidebar({
  workspaceId,
  workspaceName,
  agents,
  people,
  currentUserName,
  currentUserRole,
  inviteToken,
  activeAgentId = null,
}: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const visibleAgents = q ? agents.filter((a) => a.name.toLowerCase().includes(q)) : agents
  const visiblePeople = q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people

  async function handleDelete(agentId: string, agentName: string) {
    if (deletingId) return
    const ok = window.confirm(
      `Delete “${agentName}”? This removes the agent and its stored API key for the whole team.`,
    )
    if (!ok) return
    setDeletingId(agentId)
    await deleteAgentAction(workspaceId, agentId)
    setDeletingId(null)
    // If we were viewing the deleted agent, return to the feed.
    if (activeAgentId === agentId) router.push(`/workspaces/${workspaceId}`)
  }

  const rowBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '7px 9px',
    borderRadius: 8,
    cursor: 'pointer',
    textDecoration: 'none',
  }

  return (
    <aside
      style={{
        width: 276,
        flex: 'none',
        background: RELAY.panel,
        borderRight: `1px solid ${RELAY.border}`,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT,
        color: RELAY.text,
        height: '100%',
      }}
    >
      {/* Workspace header → back to all workspaces */}
      <Link
        href="/dashboard"
        className="rl-row"
        title="Switch workspace"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '15px 14px',
          cursor: 'pointer',
          borderBottom: `1px solid ${RELAY.border}`,
          textDecoration: 'none',
          color: RELAY.text,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 17,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {workspaceName}
          </div>
        </div>
        <span style={{ color: RELAY.text3, fontSize: 13 }}>⌄</span>
      </Link>

      {/* Search */}
      <div style={{ padding: '10px 12px 4px' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="rl-input"
          style={{
            width: '100%',
            background: RELAY.bg,
            border: `1px solid ${RELAY.border}`,
            borderRadius: 8,
            padding: '7px 11px',
            color: RELAY.text,
            fontSize: 13,
          }}
        />
      </div>

      {/* Lists */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 14px' }}>
        {/* Channels */}
        <div style={{ padding: '8px 8px 5px' }}>
          <SectionLabel>CHANNELS</SectionLabel>
        </div>
        <Link
          href={`/workspaces/${workspaceId}`}
          className="rl-row"
          style={{
            ...rowBase,
            background: !activeAgentId ? RELAY.active : 'transparent',
            color: !activeAgentId ? RELAY.text : RELAY.text2,
          }}
        >
          <span style={{ color: RELAY.text3, width: 26, textAlign: 'center', flex: 'none' }}>#</span>
          <span style={{ flex: 1, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Team feed
          </span>
        </Link>

        {/* Agents */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 8px 5px' }}>
          <SectionLabel>AGENTS</SectionLabel>
          <PlusButton onClick={() => setWizardOpen(true)} label="New agent" />
        </div>
        {visibleAgents.length === 0 ? (
          <div style={{ padding: '4px 9px', fontSize: 12, color: RELAY.text3 }}>
            {q ? 'No matches' : 'No agents yet'}
          </div>
        ) : (
          visibleAgents.map((a) => {
            const active = activeAgentId === a.id
            return (
              <div
                key={a.id}
                className="rl-row"
                style={{ ...rowBase, background: active ? RELAY.active : 'transparent' }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    flex: 'none',
                    borderRadius: 7,
                    background: RELAY.agent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    color: RELAY.agentText,
                    fontSize: 12,
                  }}
                >
                  {letter(a.name)}
                </div>
                <Link
                  href={`/workspaces/${workspaceId}/agents/${a.id}`}
                  style={{
                    flex: 1,
                    fontWeight: 500,
                    color: active ? RELAY.text : RELAY.text2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textDecoration: 'none',
                  }}
                >
                  {a.name}
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id, a.name)}
                  disabled={deletingId === a.id}
                  aria-label={`Delete ${a.name}`}
                  className="rl-del"
                  style={{ background: 'transparent', border: 'none', color: RELAY.text3, cursor: 'pointer', fontSize: 13, flex: 'none' }}
                >
                  ✕
                </button>
              </div>
            )
          })
        )}

        {/* People */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 8px 5px' }}>
          <SectionLabel>PEOPLE</SectionLabel>
          <PlusButton onClick={() => setInviteOpen(true)} label="Invite people" />
        </div>
        {visiblePeople.map((p) => (
          <div key={p.id} className="rl-row" style={{ ...rowBase, cursor: 'default' }}>
            <div
              style={{
                width: 26,
                height: 26,
                flex: 'none',
                borderRadius: '50%',
                background: RELAY.person,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                color: '#fff',
                fontSize: 12,
              }}
            >
              {letter(p.name)}
            </div>
            <span style={{ flex: 1, fontWeight: 500, color: RELAY.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {p.name}
            </span>
            <span style={{ fontSize: 11, color: RELAY.text3, flex: 'none' }}>
              {p.isYou ? 'you' : p.role}
            </span>
          </div>
        ))}
      </div>

      {/* Current user footer */}
      <div
        style={{
          borderTop: `1px solid ${RELAY.border}`,
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: RELAY.person,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            color: '#fff',
            fontSize: 12,
            flex: 'none',
          }}
        >
          {letter(currentUserName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentUserName}
          </div>
        </div>
        <span style={{ fontSize: 11, color: RELAY.text3 }}>{currentUserRole}</span>
      </div>

      <Modal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title="New agent"
        description="Give your AI teammate a name, a job, and instructions."
      >
        <AgentWizard
          workspaceId={workspaceId}
          onCreated={() => setWizardOpen(false)}
          onCancel={() => setWizardOpen(false)}
        />
      </Modal>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={`Invite to ${workspaceName}`}
        description="Anyone with this link can join the workspace."
      >
        <InviteLink token={inviteToken} />
      </Modal>
    </aside>
  )
}
