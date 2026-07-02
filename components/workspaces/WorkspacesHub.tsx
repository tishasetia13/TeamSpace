'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu } from '@base-ui/react/menu'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import CreateWorkspaceForm from '@/components/workspaces/CreateWorkspaceForm'
import { initial } from '@/lib/ui/colors'

export type HubAvatar = { initial: string; kind: 'person' | 'agent' }

export type HubWorkspace = {
  id: string
  name: string
  role: string
  agentCount: number
  peopleCount: number
  avatars: HubAvatar[]
  overflow: number
}

export type HubLastMessage = {
  senderName: string
  senderInitial: string
  senderKind: 'person' | 'agent'
  body: string
  createdAt: string
}

export type HubHero = {
  workspace: HubWorkspace
  lastMessage: HubLastMessage | null
}

export type HubData = {
  workspaces: HubWorkspace[]
  hero: HubHero | null
  displayName: string | null
  email: string
}

// ---- palette (from the Claude Design mockup) ------------------------------
const C = {
  bg: '#0a0a0a',
  text: '#E0E1DD',
  head: '#EDEFEC',
  head2: '#E7E9E4',
  muted: '#9a9a9a',
  muted2: '#6b6b6b',
  muted3: '#8a8a8a',
  body: '#b0b0b0',
  border: 'rgba(255,255,255,0.10)',
  green: '#46C68A',
  accent: 'linear-gradient(180deg,#f0994d,#d17f33)',
  card: 'linear-gradient(180deg,#161616,#101010)',
  hero: 'linear-gradient(135deg,#171717,#10101056)',
  logo: 'linear-gradient(155deg,#1c1c1c,#0a0a0a)',
  person: 'linear-gradient(140deg,#2a2a2a,#1a1a1a)',
  agent: 'linear-gradient(150deg,#D4DCE7,#AFBED2)',
  ring: '0 0 0 2px #151515',
}
const FONT = "var(--font-hanken), system-ui, sans-serif"
const MONO = "var(--font-jetbrains), ui-monospace, monospace"

function AvatarTile({ a, first }: { a: HubAvatar; first: boolean }) {
  const isAgent = a.kind === 'agent'
  return (
    <div
      style={{
        position: 'relative',
        width: 30,
        height: 30,
        flex: 'none',
        borderRadius: isAgent ? 8 : '50%',
        marginLeft: first ? 0 : -7,
        background: isAgent ? C.agent : C.person,
        color: isAgent ? '#1B263B' : '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 12,
        boxShadow: C.ring,
      }}
    >
      {a.initial}
    </div>
  )
}

function AvatarStack({ ws }: { ws: HubWorkspace }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {ws.avatars.map((a, i) => (
        <AvatarTile key={i} a={a} first={i === 0} />
      ))}
      {ws.overflow > 0 && (
        <span style={{ marginLeft: 11, fontSize: '12.5px', color: C.muted }}>
          +{ws.overflow}
        </span>
      )}
    </div>
  )
}

function WorkspaceCard({ ws }: { ws: HubWorkspace }) {
  return (
    <Link
      href={`/workspaces/${ws.id}`}
      className="dq-card"
      style={{
        borderRadius: 18,
        background: C.card,
        border: `1px solid ${C.border}`,
        padding: '18px 18px 16px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        width: 234,
        height: 165,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'transform .2s, border-color .2s, box-shadow .2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span
              style={{
                fontSize: 19,
                fontWeight: 700,
                color: C.head,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {ws.name}
            </span>
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: MONO,
              fontSize: 11,
              color: C.muted2,
              textTransform: 'lowercase',
            }}
          >
            {ws.role}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginTop: 'auto',
        }}
      >
        <AvatarStack ws={ws} />
        <span style={{ fontSize: '12.5px', color: C.muted }}>
          <strong style={{ color: '#C5D0DD', fontWeight: 600 }}>
            {ws.agentCount} agent{ws.agentCount === 1 ? '' : 's'} ·{' '}
            {ws.peopleCount} {ws.peopleCount === 1 ? 'person' : 'people'}
          </strong>
        </span>
      </div>
    </Link>
  )
}

function CreateTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="dq-create"
      style={{
        borderRadius: 18,
        background: 'rgba(255,255,255,0.04)',
        border: '1.5px dashed rgba(255,255,255,0.16)',
        padding: 18,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 14,
        fontFamily: FONT,
        width: 234,
        height: 165,
        transition: 'background .2s, border-color .2s, transform .2s',
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 13,
          background:
            'linear-gradient(150deg,rgba(240,153,77,0.28),rgba(20,20,20,0.4))',
          border: '1px solid rgba(255,255,255,0.16)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f0994d" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: '15.5px', fontWeight: 700, color: '#DDE3EB', marginBottom: 5 }}>
          Create a new workspace
        </div>
        <div style={{ fontSize: 13, color: C.muted3, lineHeight: 1.5 }}>
          Spin up a fresh space and bring in agents to work alongside you.
        </div>
      </div>
    </button>
  )
}

export default function WorkspacesHub({ data }: { data: HubData }) {
  const { workspaces, displayName, email } = data
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [query, setQuery] = useState('')

  const firstName = displayName?.trim().split(/\s+/)[0] ?? null
  const greeting = firstName ? `Welcome back, ${firstName}` : 'Welcome back'
  const avatarInitial = initial(displayName || email || 'You')

  const q = query.trim().toLowerCase()
  const visible = useMemo(
    () => (q ? workspaces.filter((w) => w.name.toLowerCase().includes(q)) : workspaces),
    [q, workspaces],
  )

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: C.bg,
        fontFamily: FONT,
        color: C.text,
        overflowX: 'hidden',
      }}
    >
      <style>{`
        @keyframes ds-rise { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        .dq-card:hover { transform: translateY(-3px); border-color: rgba(255,255,255,0.22); box-shadow: 0 20px 44px rgba(0,0,0,0.45); }
        .dq-hero:hover { border-color: rgba(255,255,255,0.22); transform: translateY(-2px); box-shadow: 0 18px 40px rgba(0,0,0,0.4); }
        .dq-create:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.28); transform: translateY(-3px); }
        .dq-accent:hover { background: linear-gradient(180deg,#f5a95f,#d17f33) !important; }
        .dq-search:focus-within { border-color: rgba(255,255,255,0.20); }
        .dq-brand:hover { background: rgba(255,255,255,0.08); }
        .dq-search input::placeholder { color: ${C.muted2}; }
        .dq-search input { background: transparent; border: none; outline: none; color: ${C.text}; font-family: ${FONT}; font-size: 14px; width: 100%; }
        .dq-menuitem { cursor: pointer; }
        .dq-menuitem[data-highlighted] { background: rgba(255,255,255,0.08); }
      `}</style>

      {/* ambient glow */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(1100px 520px at 22% -8%,rgba(240,153,77,0.12),transparent 60%),radial-gradient(900px 500px at 92% 4%,rgba(255,255,255,0.05),transparent 55%)',
        }}
      />

      {/* ===== TOP BAR ===== */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          height: 66,
          padding: '0 26px',
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: `1px solid rgba(255,255,255,0.08)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: C.logo,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 15,
              color: '#EDEFEC',
              boxShadow:
                'inset 0 1px 0 rgba(224,225,221,0.22), 0 3px 9px rgba(0,0,0,0.4)',
            }}
          >
            T
          </div>
          <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: C.text }}>
            Teamspace
          </span>
        </div>

        <label
          className="dq-search"
          style={{
            marginLeft: 10,
            flex: 1,
            maxWidth: 430,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: 38,
            padding: '0 13px',
            borderRadius: 11,
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid rgba(255,255,255,0.10)`,
            cursor: 'text',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b6b6b" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspaces"
            aria-label="Search workspaces"
          />
        </label>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="dq-accent"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 38,
            padding: '0 16px',
            border: 'none',
            borderRadius: 11,
            background: C.accent,
            color: '#000000',
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.16), 0 5px 14px rgba(28,53,84,0.55)',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New workspace
        </button>

        {/* account menu */}
        <Menu.Root>
          <Menu.Trigger
            aria-label="Account menu"
            style={{
              position: 'relative',
              width: 36,
              height: 36,
              border: 'none',
              borderRadius: '50%',
              background: C.person,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
              color: '#FBFCFD',
              cursor: 'pointer',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.16)',
            }}
          >
            {avatarInitial}
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="bottom" align="end" sideOffset={10} style={{ zIndex: 50 }}>
              <Menu.Popup
                style={{
                  minWidth: 220,
                  borderRadius: 14,
                  background: '#141414',
                  border: `1px solid ${C.border}`,
                  padding: 6,
                  boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                  fontFamily: FONT,
                  outline: 'none',
                }}
              >
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.head, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName || 'Your account'}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {email}
                  </div>
                </div>
                <div style={{ height: 1, background: C.border, margin: '4px 0' }} />
                <Menu.Item
                  className="dq-menuitem"
                  onClick={handleSignOut}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 9,
                    padding: '8px 10px',
                    fontSize: 14,
                    color: C.body,
                    outline: 'none',
                    userSelect: 'none',
                  }}
                >
                  Sign out
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </header>

      {/* ===== MAIN ===== */}
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1140,
          margin: '0 auto',
          padding: '46px 28px 90px',
        }}
      >
        {/* hero text */}
        <div style={{ marginBottom: 38, animation: 'ds-rise .5s ease both' }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 36, fontWeight: 800, letterSpacing: '-0.025em', color: C.head, lineHeight: 1.05 }}>
            {firstName ? (
              <>
                Welcome back, <span style={{ color: '#f0994d' }}>{firstName}</span>
              </>
            ) : (
              greeting
            )}
          </h1>
          <p style={{ margin: 0, fontSize: 16, color: C.muted }}>
            Jump back in, or start something new.
          </p>
        </div>

        {workspaces.length === 0 ? (
          <div style={{ maxWidth: 420, animation: 'ds-rise .55s ease .05s both' }}>
            <CreateTile onClick={() => setCreateOpen(true)} />
            <p style={{ marginTop: 16, fontSize: 13.5, color: C.muted3, lineHeight: 1.6 }}>
              Or open an invite link from a teammate to join their workspace.
            </p>
          </div>
        ) : (
          <>
            {/* ===== YOUR WORKSPACES ===== */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', color: C.head2 }}>
                Your Workspaces
              </h2>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, 234px)',
                gridAutoRows: '165px',
                gap: 18,
                justifyContent: 'start',
                animation: 'ds-rise .6s ease .1s both',
              }}
            >
              {visible.map((w) => (
                <WorkspaceCard key={w.id} ws={w} />
              ))}
              {!q && <CreateTile onClick={() => setCreateOpen(true)} />}
              {q && visible.length === 0 && (
                <div style={{ gridColumn: '1 / -1', color: C.muted, fontSize: 14 }}>
                  No workspaces match “{query}”.
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a new workspace">
        <CreateWorkspaceForm />
      </Modal>
    </div>
  )
}
