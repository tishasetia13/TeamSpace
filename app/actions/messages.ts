'use server'

import { createClient } from '@/lib/supabase/server'

// One message in a workspace's shared feed. This shape matches the `messages`
// table in supabase/schema.sql exactly, so the same type works for messages we
// load on the server AND messages that arrive live over Realtime.
export type ChatMessage = {
  id: string
  workspace_id: string
  user_id: string | null // null = posted by an agent/system (used later, M4+)
  type: 'human' | 'agent_mention' | 'agent_summary' | 'activity'
  body: string
  created_at: string
}

export type SendResult = { error: string | null; message?: ChatMessage }

// Called by the chat composer to post a human message into a workspace feed.
// All the real security lives in the `post_message` database function, which
// refuses to write unless the caller is actually a member of the workspace.
export async function sendMessageAction(
  workspaceId: string,
  body: string,
): Promise<SendResult> {
  const trimmed = body.trim()
  if (!trimmed) {
    return { error: 'Message cannot be empty.' }
  }
  if (trimmed.length > 4000) {
    return { error: 'Message is too long (max 4000 characters).' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be signed in to post.' }
  }

  const { data, error } = await supabase.rpc('post_message', {
    p_workspace_id: workspaceId,
    p_body: trimmed,
  })

  if (error || !data) {
    return { error: error?.message ?? 'Could not send your message.' }
  }

  return { error: null, message: data as ChatMessage }
}
