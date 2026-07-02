// Relay navy design system — the single source of truth for the colors and
// fonts used across the workspace shell, chat, and modals. Imported into client
// components and applied as inline styles (the design is gradient/token heavy,
// so inline styles stay closest to the source design). Hover/focus states live
// as `.rl-*` classes in globals.css.

export const RELAY = {
  bg: '#0b0b0c',
  bg2: '#000000',
  panel: '#141415',
  elev: '#1c1c1e',
  hover: 'rgba(255,255,255,0.06)',
  active: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.08)',
  border2: 'rgba(255,255,255,0.16)',
  text: '#f2f2f0',
  text2: '#9a9a9a',
  text3: '#6b6b6b',
  accent: '#f0994d',
  accent2: '#f7b877',
  white: '#f2f2f0',
  // People = blue circles, agents = light squares (with dark letters).
  person: '#f0994d',
  agent: '#cdd6dd',
  agentText: '#2a2a2e',
  // Your own bubbles: a solid amber-orange gradient in the same accent family as
  // the Send button, so "your" messages and "your" send action share an
  // identity — and clearly stand apart from the dark `elev` boxes of others.
  mineBg: '#c9762e',
  mineBorder: 'rgba(201,118,46,0.28)',
  // Sender name colors: people orange, agents light slate.
  personName: '#f0994d',
  agentName: '#c7d2da',
  // Gradient for send / primary actions.
  sendGrad: 'linear-gradient(135deg,#f5a95f,#e0812f)',
  green: '#6fbf9a',
} as const

export const FONT = "var(--font-sans), system-ui, -apple-system, sans-serif"
export const MONO = "var(--font-jetbrains), ui-monospace, monospace"

// Hand-rolled 12-hour clock — locale-independent so SSR and the browser render
// the same string (toLocaleTimeString differs between Node and browsers and
// causes hydration mismatches).
export function fmtClock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const h24 = d.getHours()
  const h12 = h24 % 12 || 12
  const m = String(d.getMinutes()).padStart(2, '0')
  const ap = h24 < 12 ? 'AM' : 'PM'
  return `${h12}:${m} ${ap}`
}

// First letter, uppercased.
export function letter(name: string): string {
  const c = name.trim()[0]
  return c ? c.toUpperCase() : '?'
}
