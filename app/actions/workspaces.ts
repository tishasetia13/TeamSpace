'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ActionState = { error: string | null }

// Called by the "Create workspace" form on the dashboard.
// On success it redirects to the new workspace's page.
export async function createWorkspaceAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get('name') ?? '').trim()

  if (!name) {
    return { error: 'Please enter a workspace name.' }
  }
  if (name.length > 60) {
    return { error: 'Workspace name must be 60 characters or fewer.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // create_workspace makes the workspace AND adds us as owner in one step.
  // The function returns the new workspace row directly as `data`.
  const { data, error } = await supabase.rpc('create_workspace', { p_name: name })

  if (error || !data) {
    return { error: error?.message ?? 'Could not create the workspace.' }
  }

  revalidatePath('/dashboard')
  redirect(`/workspaces/${data.id}`)
}

// Rename a workspace. Called from the workspace menu (owner only — the database
// function enforces that). Returns an error string for the UI to show, or null.
export async function renameWorkspaceAction(
  workspaceId: string,
  name: string,
): Promise<{ error: string | null }> {
  const trimmed = name.trim()
  if (!trimmed) {
    return { error: 'Please enter a workspace name.' }
  }
  if (trimmed.length > 60) {
    return { error: 'Workspace name must be 60 characters or fewer.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const { error } = await supabase.rpc('rename_workspace', {
    p_workspace_id: workspaceId,
    p_name: trimmed,
  })
  if (error) {
    return { error: error.message ?? 'Could not rename the workspace.' }
  }

  revalidatePath(`/workspaces/${workspaceId}`)
  revalidatePath('/dashboard')
  return { error: null }
}

// Delete a workspace (owner only — enforced in the database). On success this
// throws a redirect to the dashboard, so it does not return on the happy path.
export async function deleteWorkspaceAction(
  workspaceId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const { error } = await supabase.rpc('delete_workspace', {
    p_workspace_id: workspaceId,
  })
  if (error) {
    return { error: error.message ?? 'Could not delete the workspace.' }
  }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}

// Leave a workspace (non-owners only — enforced in the database). On success
// this throws a redirect to the dashboard.
export async function leaveWorkspaceAction(
  workspaceId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const { error } = await supabase.rpc('leave_workspace', {
    p_workspace_id: workspaceId,
  })
  if (error) {
    return { error: error.message ?? 'Could not leave the workspace.' }
  }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}

// Called by the "Join" button on the invite page.
export async function joinWorkspaceAction(formData: FormData) {
  const token = String(formData.get('token') ?? '').trim()
  if (!token) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=/join/${token}`)
  }

  const { data, error } = await supabase.rpc('join_workspace_by_token', {
    p_token: token,
  })

  if (error || !data) {
    redirect(`/join/${token}?error=1`)
  }

  revalidatePath('/dashboard')
  redirect(`/workspaces/${data.id}`)
}
