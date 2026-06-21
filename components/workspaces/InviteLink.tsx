'use client'

import { useEffect, useState } from 'react'
import { RELAY, MONO } from '@/lib/ui/relay'

// Builds the full invite URL in the browser (so it matches whatever host the app
// is actually running on) and offers a one-click copy button.
export default function InviteLink({ token }: { token: string }) {
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Needs the live origin, only available after mount in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(`${window.location.origin}/join/${token}`)
  }, [token])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (e.g. insecure context) — user can select manually.
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: RELAY.bg,
          border: `1px solid ${RELAY.border}`,
          borderRadius: 9,
          padding: '11px 13px',
          fontFamily: MONO,
          fontSize: 12.5,
          color: RELAY.text2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {url || '…'}
      </div>
      <button
        type="button"
        onClick={copy}
        disabled={!url}
        className="rl-white"
        style={{
          flex: 'none',
          background: RELAY.white,
          color: '#0a0a0b',
          border: 'none',
          borderRadius: 9,
          padding: '0 16px',
          fontWeight: 600,
          fontSize: 13,
          cursor: url ? 'pointer' : 'default',
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
