'use client'

import { useState } from 'react'
import { deleteAgentAction, type Agent } from '@/app/actions/agents'
import { getProvider } from '@/lib/agents/providers'
import { Button } from '@/components/ui/button'
import AgentWizard from '@/components/agents/AgentWizard'

type Props = {
  workspaceId: string
  agents: Agent[]
}

export default function AgentsPanel({ workspaceId, agents }: Props) {
  const [open, setOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Agents
        </h2>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Cancel' : 'New agent'}
        </Button>
      </div>

      {agents.length === 0 && !open && (
        <p className="py-6 text-center text-sm text-zinc-400">
          No agents yet. Create one to put an AI teammate in your feed.
        </p>
      )}

      <ul className="space-y-2">
        {agents.map((agent) => {
          const p = getProvider(agent.provider)
          const expanded = expandedId === agent.id
          return (
            <li
              key={agent.id}
              className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      {agent.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {p?.label ?? agent.provider}
                    </span>
                  </div>
                  <p
                    className={`mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 ${
                      expanded ? 'whitespace-pre-wrap' : 'line-clamp-2'
                    }`}
                  >
                    {agent.system_prompt}
                  </p>
                  {expanded && (
                    <p className="mt-2 text-xs text-zinc-400">
                      Model: {agent.model}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(expanded ? null : agent.id)
                    }
                    className="mt-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    {expanded ? 'Hide details' : 'Show details'}
                  </button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-zinc-400 hover:text-red-500"
                  disabled={deletingId === agent.id}
                  onClick={() => handleDelete(agent.id, agent.name)}
                >
                  {deletingId === agent.id ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      {open && (
        <AgentWizard
          workspaceId={workspaceId}
          onCreated={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  )
}
