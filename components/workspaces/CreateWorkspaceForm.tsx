'use client'

import { useActionState } from 'react'
import { createWorkspaceAction, type ActionState } from '@/app/actions/workspaces'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const initialState: ActionState = { error: null }

export default function CreateWorkspaceForm() {
  const [state, formAction, pending] = useActionState(
    createWorkspaceAction,
    initialState,
  )

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex gap-2">
        <Input
          name="name"
          placeholder="e.g. Weekend Hackathon Squad"
          maxLength={60}
          required
          autoComplete="off"
          className="flex-1"
        />
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create'}
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
