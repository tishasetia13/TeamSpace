import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

// Calls Anthropic's Messages API for an agent and returns its plain-text reply.
// The API key is the AGENT'S OWN key (bring-your-own-key), decrypted moments
// before this runs and never stored in plaintext. We translate any API failure
// into a friendly, user-facing message so the feed can show something helpful
// instead of a raw stack trace.
//
// This is intentionally the only place that knows how to talk to Anthropic — in
// later steps OpenAI and Gemini get their own sibling modules behind the same
// shape, so the rest of the app stays provider-agnostic.
export async function callAnthropicAgent(opts: {
  apiKey: string
  model: string
  system: string
  userContent: string
}): Promise<string> {
  const client = new Anthropic({ apiKey: opts.apiKey })

  let response
  try {
    response = await client.messages.create({
      model: opts.model,
      max_tokens: 4096,
      system: opts.system,
      messages: [{ role: 'user', content: opts.userContent }],
    })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      throw new Error(
        'This agent’s API key was rejected. Double-check the key (you may need to delete and recreate the agent).',
      )
    }
    if (e instanceof Anthropic.PermissionDeniedError) {
      throw new Error(
        'This agent’s API key isn’t allowed to use that model. Check the key’s permissions.',
      )
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new Error('This agent hit its API rate limit. Try again in a moment.')
    }
    if (e instanceof Anthropic.APIError) {
      throw new Error(`The AI service returned an error (${e.status ?? 'unknown'}).`)
    }
    throw new Error('Could not reach the AI service. Check your connection and try again.')
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('The agent declined to respond to that request.')
  }

  // content is a list of blocks; collect the text ones into a single reply.
  let text = ''
  for (const block of response.content) {
    if (block.type === 'text') text += block.text
  }
  text = text.trim()

  if (!text) {
    throw new Error('The agent didn’t return a response. Try rephrasing your message.')
  }
  return text
}
