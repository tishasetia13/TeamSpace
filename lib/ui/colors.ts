// Small deterministic helpers so a given person/agent always gets the SAME
// colour and initial across the whole app (sidebar, feed, 1-on-1). This is the
// "WhatsApp group" touch: every sender has a stable, recognisable colour.

// Tailwind text colours for sender names (one per palette slot).
const NAME_COLORS = [
  'text-blue-400',
  'text-emerald-400',
  'text-violet-400',
  'text-pink-400',
  'text-amber-400',
  'text-cyan-400',
  'text-rose-400',
  'text-teal-400',
]

// Matching solid backgrounds for the round avatars.
const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-amber-500',
  'bg-cyan-500',
  'bg-rose-500',
  'bg-teal-500',
]

// Tiny stable string hash (djb2-ish). Same key in → same number out.
function hash(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0
  }
  return h
}

export function nameColor(key: string): string {
  return NAME_COLORS[hash(key) % NAME_COLORS.length]
}

export function avatarColor(key: string): string {
  return AVATAR_COLORS[hash(key) % AVATAR_COLORS.length]
}

// First letter of the name, uppercased (e.g. "Tisha" → "T"). Falls back to "?".
export function initial(name: string): string {
  const ch = name.trim()[0]
  return ch ? ch.toUpperCase() : '?'
}
