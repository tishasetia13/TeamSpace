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
//
// Agents get Anthropic's built-in web search tool. It's a SERVER-SIDE tool —
// Anthropic runs the actual searches; we don't write any search code. Claude
// decides on its own whether a given message needs current info (it skips
// search for ordinary chat). We cap it with `max_uses` so a single reply can't
// rack up many paid searches on the agent's own key.
const WEB_SEARCH_TOOL: Anthropic.WebSearchTool20260209 = {
  type: 'web_search_20260209',
  name: 'web_search',
  max_uses: 5,
}

export async function callAnthropicAgent(opts: {
  apiKey: string
  model: string
  system: string
  userContent: string
}): Promise<string> {
  const client = new Anthropic({ apiKey: opts.apiKey })

  // We keep the running conversation in `messages` so we can resume after a
  // `pause_turn`: when Claude does a lot of searching it can hit an internal
  // server-side iteration limit and stop early, asking us to continue. We just
  // append what it produced so far and re-send. Capped so a runaway agent
  // can't loop forever (and burn the key).
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: opts.userContent },
  ]
  const MAX_CONTINUATIONS = 5

  let response: Anthropic.Message | undefined
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    try {
      response = await client.messages.create({
        model: opts.model,
        max_tokens: 4096,
        system: opts.system,
        messages,
        tools: [WEB_SEARCH_TOOL],
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

    // The server-side search loop hit its limit mid-task. Append the partial
    // turn and re-send so Claude can pick up where it left off.
    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content })
      continue
    }

    break
  }

  if (!response) {
    throw new Error('The agent didn’t return a response. Try rephrasing your message.')
  }

  // The response can now include web-search blocks (server_tool_use,
  // web_search_tool_result) alongside text — we only surface the text blocks
  // as the agent's reply, same as before.
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
