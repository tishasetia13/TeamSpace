'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import AgentWizard from '@/components/agents/AgentWizard'
import InviteLink from '@/components/workspaces/InviteLink'
import { deleteAgentAction } from '@/app/actions/agents'
import {
  renameWorkspaceAction,
  deleteWorkspaceAction,
  leaveWorkspaceAction,
} from '@/app/actions/workspaces'
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

// One row in the workspace "⋯" dropdown. `danger` tints it red on hover.
function MenuItem({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={danger ? 'rl-menuitem rl-menuitem-danger' : 'rl-menuitem'}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '8px 10px',
        borderRadius: 8,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: 13.5,
        fontWeight: 500,
        color: danger ? '#e0a0a0' : RELAY.text2,
      }}
    >
      {children}
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

  // Workspace "⋯" menu + the dialogs it can open.
  const isOwner = currentUserRole === 'owner'
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(workspaceName)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Close the dropdown when clicking anywhere outside it.
  useEffect(() => {
    if (!menuOpen) return
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setActionError(null)
    const { error } = await renameWorkspaceAction(workspaceId, renameValue)
    setBusy(false)
    if (error) {
      setActionError(error)
      return
    }
    setRenameOpen(false)
    router.refresh()
  }

  async function handleDeleteWorkspace() {
    if (busy) return
    setBusy(true)
    setActionError(null)
    // On success this redirects to /dashboard, so it won't return here.
    const { error } = await deleteWorkspaceAction(workspaceId)
    setBusy(false)
    if (error) setActionError(error)
  }

  async function handleLeaveWorkspace() {
    if (busy) return
    setBusy(true)
    setActionError(null)
    const { error } = await leaveWorkspaceAction(workspaceId)
    setBusy(false)
    if (error) setActionError(error)
  }

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
      {/* Workspace header: name links back to all workspaces; "⋯" opens the
          workspace menu (invite / rename / delete-or-leave). */}
      <div
        ref={menuRef}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '11px 10px 11px 14px',
          borderBottom: `1px solid ${RELAY.border}`,
        }}
      >
        <Link
          href={`/workspaces/${workspaceId}`}
          title="Go to team feed"
          style={{
            flex: 1,
            minWidth: 0,
            textDecoration: 'none',
            color: RELAY.text,
            fontWeight: 600,
            fontSize: 17,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {workspaceName}
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Workspace menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="rl-faint"
          style={{
            flex: 'none',
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            background: menuOpen ? RELAY.active : 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: RELAY.text2,
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ⋮
        </button>

        {menuOpen && (
          <div
            role="menu"
            style={{
              position: 'absolute',
              top: 'calc(100% - 2px)',
              right: 10,
              left: 14,
              zIndex: 30,
              background: RELAY.elev,
              border: `1px solid ${RELAY.border2}`,
              borderRadius: 12,
              padding: 6,
              boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
            }}
          >
            <MenuItem
              onClick={() => {
                setMenuOpen(false)
                router.push('/dashboard')
              }}
            >
              All workspaces
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuOpen(false)
                setInviteOpen(true)
              }}
            >
              Invite people
            </MenuItem>
            {isOwner && (
              <MenuItem
                onClick={() => {
                  setMenuOpen(false)
                  setActionError(null)
                  setRenameValue(workspaceName)
                  setRenameOpen(true)
                }}
              >
                Rename workspace
              </MenuItem>
            )}
            {isOwner ? (
              <MenuItem
                danger
                onClick={() => {
                  setMenuOpen(false)
                  setActionError(null)
                  setDeleteConfirm('')
                  setDeleteOpen(true)
                }}
              >
                Delete workspace
              </MenuItem>
            ) : (
              <MenuItem
                danger
                onClick={() => {
                  setMenuOpen(false)
                  setActionError(null)
                  setLeaveOpen(true)
                }}
              >
                Leave workspace
              </MenuItem>
            )}
          </div>
        )}
      </div>

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
        {/* Agents */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 5px' }}>
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

      {/* Rename workspace */}
      <Modal
        open={renameOpen}
        onClose={() => !busy && setRenameOpen(false)}
        title="Rename workspace"
        description="Pick a new name for this workspace. Everyone on the team will see it."
      >
        <form onSubmit={handleRename}>
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Workspace name"
            maxLength={60}
            autoFocus
            className="rl-input"
            style={{
              width: '100%',
              background: RELAY.bg,
              border: `1px solid ${RELAY.border}`,
              borderRadius: 9,
              padding: '10px 13px',
              color: RELAY.text,
              fontSize: 14,
            }}
          />
          {actionError && (
            <div style={{ color: '#f0a0a0', fontSize: 12.5, marginTop: 10 }}>{actionError}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <button
              type="button"
              onClick={() => setRenameOpen(false)}
              disabled={busy}
              className="rl-outline"
              style={{
                background: 'transparent',
                color: RELAY.text2,
                border: `1px solid ${RELAY.border}`,
                borderRadius: 9,
                padding: '9px 16px',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !renameValue.trim() || renameValue.trim() === workspaceName}
              className="rl-white"
              style={{
                background: RELAY.white,
                color: '#0a0a0b',
                border: 'none',
                borderRadius: 9,
                padding: '9px 18px',
                fontWeight: 600,
                fontSize: 13,
                cursor:
                  busy || !renameValue.trim() || renameValue.trim() === workspaceName
                    ? 'default'
                    : 'pointer',
                opacity:
                  busy || !renameValue.trim() || renameValue.trim() === workspaceName ? 0.5 : 1,
              }}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete workspace — type the name to confirm. */}
      <Modal
        open={deleteOpen}
        onClose={() => !busy && setDeleteOpen(false)}
        title="Delete workspace"
        description="This permanently deletes the workspace and its entire feed, agents and messages for everyone. This cannot be undone."
      >
        <div style={{ fontSize: 13, color: RELAY.text2, marginBottom: 8 }}>
          Type <span style={{ color: RELAY.text, fontWeight: 600 }}>{workspaceName}</span> to
          confirm.
        </div>
        <input
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          placeholder="Workspace name"
          autoFocus
          className="rl-input"
          style={{
            width: '100%',
            background: RELAY.bg,
            border: `1px solid ${RELAY.border}`,
            borderRadius: 9,
            padding: '10px 13px',
            color: RELAY.text,
            fontSize: 14,
          }}
        />
        {actionError && (
          <div style={{ color: '#f0a0a0', fontSize: 12.5, marginTop: 10 }}>{actionError}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button
            type="button"
            onClick={() => setDeleteOpen(false)}
            disabled={busy}
            className="rl-outline"
            style={{
              background: 'transparent',
              color: RELAY.text2,
              border: `1px solid ${RELAY.border}`,
              borderRadius: 9,
              padding: '9px 16px',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDeleteWorkspace}
            disabled={busy || deleteConfirm.trim() !== workspaceName}
            style={{
              background: '#7f1d1d',
              color: '#fde2e2',
              border: 'none',
              borderRadius: 9,
              padding: '9px 18px',
              fontWeight: 600,
              fontSize: 13,
              cursor: busy || deleteConfirm.trim() !== workspaceName ? 'default' : 'pointer',
              opacity: busy || deleteConfirm.trim() !== workspaceName ? 0.5 : 1,
            }}
          >
            {busy ? 'Deleting…' : 'Delete workspace'}
          </button>
        </div>
      </Modal>

      {/* Leave workspace (non-owners). */}
      <Modal
        open={leaveOpen}
        onClose={() => !busy && setLeaveOpen(false)}
        title="Leave workspace"
        description={`You'll lose access to ${workspaceName} and won't see its feed anymore. You can rejoin later with an invite link.`}
      >
        {actionError && (
          <div style={{ color: '#f0a0a0', fontSize: 12.5, marginBottom: 12 }}>{actionError}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={() => setLeaveOpen(false)}
            disabled={busy}
            className="rl-outline"
            style={{
              background: 'transparent',
              color: RELAY.text2,
              border: `1px solid ${RELAY.border}`,
              borderRadius: 9,
              padding: '9px 16px',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLeaveWorkspace}
            disabled={busy}
            style={{
              background: '#7f1d1d',
              color: '#fde2e2',
              border: 'none',
              borderRadius: 9,
              padding: '9px 18px',
              fontWeight: 600,
              fontSize: 13,
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.5 : 1,
            }}
          >
            {busy ? 'Leaving…' : 'Leave workspace'}
          </button>
        </div>
      </Modal>
    </aside>
  )
}
