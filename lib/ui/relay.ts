// Relay navy design system — the single source of truth for the colors and
// fonts used across the workspace shell, chat, and modals. Imported into client
// components and applied as inline styles (the design is gradient/token heavy,
// so inline styles stay closest to the source design). Hover/focus states live
// as `.rl-*` classes in globals.css.

export const RELAY = {
  bg: '#0D1B2A',
  bg2: '#0a1521',
  panel: '#16263c',
  elev: '#20344c',
  hover: 'rgba(119,141,169,0.07)',
  active: 'rgba(119,141,169,0.14)',
  border: 'rgba(119,141,169,0.16)',
  border2: 'rgba(119,141,169,0.30)',
  text: '#E0E1DD',
  text2: '#90a4bd',
  text3: '#5d738c',
  accent: '#778DA9',
  accent2: '#9fb4cd',
  white: '#E0E1DD',
  // People = blue circles, agents = light squares (with dark letters).
  person: '#6cb0e6',
  agent: '#cdd6dd',
  agentText: '#2a2a2e',
  // Your own bubbles (translucent blue) vs others (--elev).
  mineBg: 'rgba(108,176,230,0.16)',
  mineBorder: 'rgba(108,176,230,0.30)',
  // Sender name colors: people blue, agents light slate.
  personName: '#6cb0e6',
  agentName: '#c7d2da',
  // Gradient for send / primary actions.
  sendGrad: 'linear-gradient(135deg,#778DA9,#415A77)',
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
