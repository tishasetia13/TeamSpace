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
