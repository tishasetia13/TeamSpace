import 'server-only'
import type { ProviderId } from './providers'
import { callAnthropicAgent } from './anthropic'
import { callOpenAIAgent } from './openai'
import { callGeminiAgent } from './gemini'

// The "universal translator". Every provider's module exposes the same shape
// (key + model + system + transcript -> reply string), and this is the one
// place that picks which one to call based on the agent's provider. The feed
// action (mentionAgentAction) talks ONLY to this function, so it never has to
// know which AI company is behind a given agent — adding Gemini in Step E is a
// single new `case` here, nothing else changes upstream.
//
// Callers are expected to have already checked `provider.enabled` for a friendly
// message before getting here.
export async function askAgent(opts: {
  provider: ProviderId
  apiKey: string
  model: string
  system: string
  userContent: string
}): Promise<string> {
  const { provider, ...rest } = opts
  switch (provider) {
    case 'anthropic':
      return callAnthropicAgent(rest)
    case 'openai':
      return callOpenAIAgent(rest)
    case 'gemini':
      return callGeminiAgent(rest)
    default:
      // Exhaustiveness guard: if a new ProviderId is added without a branch,
      // TypeScript flags this line at build time.
      provider satisfies never
      throw new Error('This agent has an unknown provider.')
  }
}
