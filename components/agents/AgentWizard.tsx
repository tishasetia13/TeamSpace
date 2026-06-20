'use client'

import { startTransition, useActionState, useEffect, useState } from 'react'
import {
  createAgentAction,
  type CreateAgentState,
} from '@/app/actions/agents'
import { PROVIDERS, getProvider } from '@/lib/agents/providers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  workspaceId: string
  // Called after a successful create so the parent can close the wizard.
  onCreated: () => void
  onCancel: () => void
}

const initialState: CreateAgentState = { error: null }

const STEP_TITLES = [
  'Who is this agent?',
  'What should it do?',
  'Give it a brain',
]

// Shared classes for the multi-line inputs (matches the look of <Input>).
const textareaClass =
  'w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

export default function AgentWizard({
  workspaceId,
  onCreated,
  onCancel,
}: Props) {
  const [step, setStep] = useState(1)
  const [stepError, setStepError] = useState<string | null>(null)

  // All the friendly answers live here and persist as we move between steps.
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [doesWhat, setDoesWhat] = useState('')
  const [communicationStyle, setCommunicationStyle] = useState('')
  const [avoid, setAvoid] = useState('')
  const [provider, setProvider] = useState('anthropic')
  const [apiKey, setApiKey] = useState('')

  const [state, submit, pending] = useActionState(
    createAgentAction,
    initialState,
  )

  // When the server confirms success, tell the parent to close us.
  useEffect(() => {
    if (state.ok) onCreated()
  }, [state, onCreated])

  const selectedProvider = getProvider(provider)

  // Checks just the fields on the current step before letting the user advance.
  function validateStep(): string | null {
    if (step === 1) {
      if (!name.trim()) return 'Please give your agent a name.'
      if (!role.trim()) return 'Add a quick one-line description of who it is.'
    }
    if (step === 2) {
      if (!doesWhat.trim()) return 'Tell the agent what it should help with.'
    }
    if (step === 3) {
      if (!apiKey.trim()) return 'Paste an API key so the agent can think.'
    }
    return null
  }

  function next() {
    const err = validateStep()
    if (err) {
      setStepError(err)
      return
    }
    setStepError(null)
    setStep((s) => Math.min(3, s + 1))
  }

  function back() {
    setStepError(null)
    setStep((s) => Math.max(1, s - 1))
  }

  function create() {
    const err = validateStep()
    if (err) {
      setStepError(err)
      return
    }
    setStepError(null)
    // useActionState's dispatch must run inside a transition so React can track
    // the "Creating…" pending state correctly.
    startTransition(() => {
      submit({
        workspaceId,
        name,
        role,
        doesWhat,
        communicationStyle,
        avoid,
        provider,
        apiKey,
      })
    })
  }

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {STEP_TITLES[step - 1]}
          </h3>
          <span className="text-xs text-zinc-400">Step {step} of 3</span>
        </div>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full ${
                n <= step
                  ? 'bg-zinc-800 dark:bg-zinc-200'
                  : 'bg-zinc-200 dark:bg-zinc-800'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step 1 — Identity */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aria"
              maxLength={60}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              In one line, who is this agent?
            </label>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. a senior backend engineer who loves clean APIs"
              maxLength={200}
            />
            <p className="text-xs text-zinc-400">
              We’ll introduce it as “You are {name || '…'},{' '}
              {role || 'a …'}.”
            </p>
          </div>
        </div>
      )}

      {/* Step 2 — Behavior (no "system prompt" jargon) */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              What should it help your team with?
            </label>
            <textarea
              value={doesWhat}
              onChange={(e) => setDoesWhat(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="e.g. Design APIs and database schemas, write production-ready backend code, and review pull requests for the team."
              className={textareaClass}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              How should it communicate?{' '}
              <span className="text-zinc-400">(optional)</span>
            </label>
            <Input
              value={communicationStyle}
              onChange={(e) => setCommunicationStyle(e.target.value)}
              placeholder="e.g. Concise and direct, with code examples"
              maxLength={500}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Anything it should never do?{' '}
              <span className="text-zinc-400">(optional)</span>
            </label>
            <Input
              value={avoid}
              onChange={(e) => setAvoid(e.target.value)}
              placeholder="e.g. Never make up library names or APIs"
              maxLength={500}
            />
          </div>
        </div>
      )}

      {/* Step 3 — Provider + key */}
      {step === 3 && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Which AI should power it?
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.enabled ? '' : ' (replies coming soon)'}
                </option>
              ))}
            </select>
            {selectedProvider && (
              <p className="text-xs text-zinc-400">
                Model: {selectedProvider.defaultModel}
                {!selectedProvider.enabled && (
                  <>
                    {' · '}
                    <span className="text-amber-600 dark:text-amber-500">
                      You can save it now, but it won’t reply until we finish{' '}
                      {selectedProvider.label} support.
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              API key
            </label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste the agent’s API key"
              autoComplete="off"
              autoFocus
            />
            <p className="text-xs text-zinc-400">
              {selectedProvider?.keyHint} Stored encrypted — never shown again.
            </p>
          </div>
        </div>
      )}

      {(stepError || state.error) && (
        <p className="text-sm text-red-500">{stepError ?? state.error}</p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={step === 1 ? onCancel : back}
          disabled={pending}
        >
          {step === 1 ? 'Cancel' : 'Back'}
        </Button>

        {step < 3 ? (
          <Button type="button" size="sm" onClick={next}>
            Next
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={create} disabled={pending}>
            {pending ? 'Creating…' : 'Create agent'}
          </Button>
        )}
      </div>
    </div>
  )
}
