import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { joinWorkspaceAction } from '@/app/actions/workspaces'
import { Button } from '@/components/ui/button'

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { token } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Look up the workspace name from the token (without joining yet).
  const { data: preview } = await supabase.rpc('workspace_preview', {
    p_token: token,
  })
  const workspace = Array.isArray(preview) ? preview[0] : preview

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {!workspace ? (
          <>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Invalid invite link
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              This link is broken or the workspace no longer exists.
            </p>
            <Link href="/dashboard" className="inline-block">
              <Button variant="outline">Go to dashboard</Button>
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              You&apos;ve been invited to join
            </p>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {workspace.name}
            </h1>

            {error && (
              <p className="text-sm text-destructive">
                Something went wrong joining. Please try again.
              </p>
            )}

            {user ? (
              <form action={joinWorkspaceAction}>
                <input type="hidden" name="token" value={token} />
                <Button type="submit" className="w-full">
                  Join workspace
                </Button>
              </form>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Sign in or create an account to join.
                </p>
                <Link href={`/login?next=/join/${token}`} className="block">
                  <Button className="w-full">Sign in to join</Button>
                </Link>
                <Link
                  href={`/signup?next=/join/${token}`}
                  className="block text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Create an account
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
