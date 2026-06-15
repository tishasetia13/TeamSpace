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
    // Wired up in Step D. gpt-4.1-mini is the cheapest current OpenAI model that
    // still supports the built-in web search tool (the others are gpt-5.5 and
    // gpt-4.1) — cost-appropriate for frequent chat replies on the user's key.
    defaultModel: 'gpt-4.1-mini',
    keyHint: 'Starts with “sk-”. From platform.openai.com.',
    enabled: true,
  },
  {
    id: 'gemini',
    label: 'Google (Gemini)',
    // Wired up in Step E. gemini-2.5-flash is a current model that supports
    // Google Search grounding and has a free tier — good for low-cost testing.
    // (Newer 3.x flash models exist if more capability is wanted later.)
    defaultModel: 'gemini-2.5-flash',
    keyHint: 'From Google AI Studio (aistudio.google.com).',
    enabled: true,
  },
]

export function getProvider(id: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id)
}
