// Shared, NON-secret config that both the agent form (client) and the server
// action rely on. Keeping it in one place means the dropdown the user sees and
// the values the server accepts can never drift apart. (No secrets here — this
// file is safe to import into client components.)

export type ProviderId = 'anthropic' | 'openai' | 'gemini'

export type ProviderInfo = {
  id: ProviderId
  label: string
  // The single model we use for this provider for now. Milestone 4 keeps it to
  // one sensible default per provider — no model dropdown yet.
  defaultModel: string
  // A short hint shown under the API-key field to help the user paste the right
  // thing.
  keyHint: string
  // Whether the agent reply pipeline actually supports this provider yet. Only
  // Anthropic is wired end-to-end in Step B; OpenAI and Gemini are selectable
  // here but their replies arrive in Steps D and E.
  enabled: boolean
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    defaultModel: 'claude-sonnet-4-6',
    keyHint: 'Starts with “sk-ant-”. From console.anthropic.com.',
    enabled: true,
  },
  {
    id: 'openai',
    label: 'OpenAI (GPT)',
    // Finalized when OpenAI is wired up (Step D).
    defaultModel: 'gpt-4o',
    keyHint: 'Starts with “sk-”. From platform.openai.com.',
    enabled: false,
  },
  {
    id: 'gemini',
    label: 'Google (Gemini)',
    // Finalized when Gemini is wired up (Step E).
    defaultModel: 'gemini-2.5-flash',
    keyHint: 'From Google AI Studio (aistudio.google.com).',
    enabled: false,
  },
]

export function getProvider(id: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id)
}
