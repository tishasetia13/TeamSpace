import 'server-only'
import OpenAI, {
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
  APIError,
} from 'openai'

// Calls OpenAI's Responses API for an agent and returns its plain-text reply.
// The API key is the AGENT'S OWN key (bring-your-own-key), decrypted moments
// before this runs and never stored in plaintext. Like the Anthropic agent, we
// give it OpenAI's built-in web search tool so it can pull in current info, and
// we translate any API failure into a friendly, user-facing message.
//
// This is the OpenAI sibling of lib/agents/anthropic.ts. Both expose the exact
// same shape ({apiKey, model, system, userContent} -> reply string) so the
// translator in lib/agents/ask.ts can treat every provider the same way.
//
// Note: the Responses API runs the web search loop SERVER-SIDE and returns the
// finished answer in one shot, so — unlike the Anthropic module — there's no
// `pause_turn`-style continuation loop to manage here.
const WEB_SEARCH_TOOL = { type: 'web_search' as const }

export async function callOpenAIAgent(opts: {
  apiKey: string
  model: string
  system: string
  userContent: string
}): Promise<string> {
  const client = new OpenAI({ apiKey: opts.apiKey })

  let response
  try {
    response = await client.responses.create({
      model: opts.model,
      // `instructions` is the Responses API's system/developer prompt. The
      // recent feed transcript goes in `input` as the user message.
      instructions: opts.system,
      input: opts.userContent,
      max_output_tokens: 4096,
      tools: [WEB_SEARCH_TOOL],
    })
  } catch (e) {
    if (e instanceof AuthenticationError) {
      throw new Error(
        'This agent’s API key was rejected. Double-check the key (you may need to delete and recreate the agent).',
      )
    }
    if (e instanceof PermissionDeniedError) {
      throw new Error(
        'This agent’s API key isn’t allowed to use that model. Check the key’s permissions.',
      )
    }
    if (e instanceof RateLimitError) {
      // OpenAI returns 429 for BOTH genuine rate limits AND an empty balance.
      // Distinguish them so someone with no credit isn't told to "try again" —
      // the real fix there is to add funds, not wait.
      if (e.code === 'insufficient_quota') {
        throw new Error(
          'This agent’s OpenAI account has no remaining credit/quota. Add funds to that OpenAI account, or use an agent on a different provider.',
        )
      }
      throw new Error('This agent hit its API rate limit. Try again in a moment.')
    }
    if (e instanceof APIError) {
      throw new Error(`The AI service returned an error (${e.status ?? 'unknown'}).`)
    }
    throw new Error('Could not reach the AI service. Check your connection and try again.')
  }

  // `output_text` is the SDK's convenience accessor that stitches the response's
  // text blocks into a single string (web-search/tool blocks are left out).
  const text = (response.output_text ?? '').trim()

  if (!text) {
    throw new Error('The agent didn’t return a response. Try rephrasing your message.')
  }
  return text
}
