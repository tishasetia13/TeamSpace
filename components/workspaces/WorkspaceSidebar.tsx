'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/avatar'
import { Modal } from '@/components/ui/modal'
import AgentWizard from '@/components/agents/AgentWizard'
import { deleteAgentAction } from '@/app/actions/agents'

type AgentRef = { id: string; name: string }
type Person = { id: string; name: string; role: string; isYou: boolean }

type Props = {
  workspaceId: string
  workspaceName: string
  agents: AgentRef[]
  people: Person[]
  currentUserName: string
  currentUserRole: string
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
      {children}
    </p>
  )
}

export default function WorkspaceSidebar({
  workspaceId,
  workspaceName,
  agents,
  people,
  currentUserName,
  currentUserRole,
}: Props) {
  const [query, setQuery] = useState('')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const visibleAgents = q
    ? agents.filter((a) => a.name.toLowerCase().includes(q))
    : agents
  const visiblePeople = q
    ? people.filter((p) => p.name.toLowerCase().includes(q))
    : people

  async function handleDelete(agentId: string, agentName: string) {
    if (deletingId) return
    const ok = window.confirm(
      `Delete “${agentName}”? This removes the agent and its stored API key for the whole team.`,
    )
    if (!ok) return
    setDeletingId(agentId)
    await deleteAgentAction(workspaceId, agentId)
    setDeletingId(null)
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-white/10 bg-zinc-950">
      {/* Workspace switcher → back to all workspaces */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3.5 transition-colors hover:bg-white/5"
        title="Switch workspace"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-sm font-bold text-zinc-900">
          {workspaceName.trim()[0]?.toUpperCase() ?? 'W'}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">
          {workspaceName}
        </span>
        <span className="text-zinc-500">⌄</span>
      </Link>

      {/* Search */}
      <div className="px-3 pt-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-white/20"
        />
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {/* Channels */}
        <div className="space-y-1.5">
          <SectionLabel>Channels</SectionLabel>
          <div className="flex items-center gap-2 rounded-lg bg-white/10 px-2 py-1.5 text-sm font-medium text-zinc-100">
            <span className="text-zinc-500">#</span>
            <span className="flex-1">Team feed</span>
            <span className="size-1.5 rounded-full bg-emerald-500" />
          </div>
        </div>

        {/* Agents */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <SectionLabel>Agents</SectionLabel>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              aria-label="New agent"
              className="flex size-5 items-center justify-center rounded text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
            >
              +
            </button>
          </div>
          {visibleAgents.length === 0 ? (
            <p className="px-2 py-1 text-xs text-zinc-600">
              {q ? 'No matches' : 'No agents yet'}
            </p>
          ) : (
            visibleAgents.map((a) => (
              <div
                key={a.id}
                className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5"
              >
                <Avatar name={a.name} kind="agent" size="sm" status />
                <Link
                  href={`/workspaces/${workspaceId}/agents/${a.id}`}
                  className="min-w-0 flex-1 truncate text-sm text-zinc-300 hover:text-zinc-100"
                >
                  {a.name}
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id, a.name)}
                  disabled={deletingId === a.id}
                  aria-label={`Delete ${a.name}`}
                  className="text-zinc-600 opacity-0 transition group-hover:opacity-100 hover:text-red-400 disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        {/* People */}
        <div className="space-y-1.5">
          <SectionLabel>People</SectionLabel>
          {visiblePeople.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
            >
              <Avatar name={p.name} kind="person" size="sm" status />
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">
                {p.name}
              </span>
              <span className="text-xs text-zinc-600">
                {p.isYou ? 'you' : p.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Current user, pinned to the bottom */}
      <div className="flex items-center gap-2.5 border-t border-white/10 px-4 py-3">
        <Avatar name={currentUserName} kind="person" size="sm" status />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">
          {currentUserName}
        </span>
        <span className="text-xs text-zinc-500">{currentUserRole}</span>
      </div>

      <Modal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title="New agent"
      >
        <AgentWizard
          workspaceId={workspaceId}
          onCreated={() => setWizardOpen(false)}
          onCancel={() => setWizardOpen(false)}
        />
      </Modal>
    </aside>
  )
}
