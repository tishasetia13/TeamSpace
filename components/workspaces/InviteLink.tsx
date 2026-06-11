'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Builds the full invite URL in the browser (so it matches whatever host the
// app is actually running on) and offers a one-click copy button.
export default function InviteLink({ token }: { token: string }) {
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setUrl(`${window.location.origin}/join/${token}`)
  }, [token])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (e.g. insecure context) — the user can still
      // select the text manually.
    }
  }

  return (
    <div className="flex gap-2">
      <Input readOnly value={url} className="flex-1 font-mono text-xs" />
      <Button type="button" variant="outline" onClick={copy} disabled={!url}>
        {copied ? 'Copied!' : 'Copy'}
      </Button>
    </div>
  )
}
