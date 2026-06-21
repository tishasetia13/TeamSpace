'use client'

import { useEffect } from 'react'
import { RELAY, FONT } from '@/lib/ui/relay'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
}

// A minimal centered dialog in the navy "Relay" style: dimmed/blurred backdrop
// (click to close), Esc to close.
export function Modal({ open, onClose, title, description, children }: Props) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(5,5,7,0.66)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        fontFamily: FONT,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: '100%',
          maxHeight: '88vh',
          overflowY: 'auto',
          background: RELAY.panel,
          border: `1px solid ${RELAY.border2}`,
          borderRadius: 16,
          padding: 24,
          color: RELAY.text,
          boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
        }}
      >
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: description ? 4 : 16 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: RELAY.text }}>{title}</div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rl-faint"
              style={{ cursor: 'pointer', color: RELAY.text2, fontSize: 20, lineHeight: 1, background: 'transparent', border: 'none' }}
            >
              ×
            </button>
          </div>
        )}
        {description && (
          <div style={{ fontSize: 13, color: RELAY.text2, marginBottom: 20 }}>{description}</div>
        )}
        {children}
      </div>
    </div>
  )
}
