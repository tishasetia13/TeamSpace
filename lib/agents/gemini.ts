import 'server-only'
import { GoogleGenAI, ApiError } from '@google/genai'

// Calls Google's Gemini API for an agent and returns its plain-text reply.
// The API key is the AGENT'S OWN key (bring-your-own-key), decrypted moments
// before this runs and never stored in plaintext. Like the other providers, we
// give it Gemini's built-in Google Search grounding (its web-search equivalent)
// so it can pull in current info, and we map any failure to a friendly message.
//
// This is the Gemini sibling of anthropic.ts / openai.ts — same shape
// ({apiKey, model, system, userContent} -> reply string) so the translator in
// lib/agents/ask.ts treats every provider identically.
//
// Like the OpenAI module, Gemini runs the search server-side and returns the
// finished answer in one shot, so there's no continuation loop here.
const GOOGLE_SEARCH_TOOL = { googleSearch: {} }

// Gemini occasionally returns a transient 5xx — most often 503 "overloaded",
// which is common on the free tier at busy times. These are worth a quick
// automatic retry before we bother the user. (The Anthropic and OpenAI SDKs
// retry such errors for us automatically; this brings Gemini in line.)
const TRANSIENT_STATUSES = new Set([500, 502, 503, 504])
const MAX_RETRIES = 2

export async function callGeminiAgent(opts: {
  apiKey: string
  model: string
  system: string
  userContent: string
}): Promise<string> {
  const client = new GoogleGenAI({ apiKey: opts.apiKey })

  let response
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      response = await client.models.generateContent({
        model: opts.model,
        // The recent feed transcript is the user turn; the agent's persona goes
        // in systemInstruction (Gemini's system prompt).
        contents: opts.userContent,
        config: {
          systemInstruction: opts.system,
          // Higher cap than the other providers on purpose: current Gemini
          // models (e.g. 2.5-flash) "think" by default, and thinking shares this
          // output budget — too low a cap can eat the whole budget and return no
          // text.
          maxOutputTokens: 8192,
          tools: [GOOGLE_SEARCH_TOOL],
        },
      })
      break
    } catch (e) {
      lastError = e
      // Only retry transient server overloads, with a short growing backoff
      // (0.5s, then 1s). Anything else (bad key, quota) won't fix itself by
      // retrying, so we fall through and report it.
      if (
        e instanceof ApiError &&
        TRANSIENT_STATUSES.has(e.status) &&
        attempt < MAX_RETRIES
      ) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
        continue
      }
      break
    }
  }

  if (!response) {
    // The Gemini SDK throws a single ApiError type (no granular subclasses like
    // the Anthropic/OpenAI SDKs), so we branch on the HTTP status to produce the
    // same friendly messages.
    if (lastError instanceof ApiError) {
      if (lastError.status === 401 || lastError.status === 403) {
        throw new Error(
          'This agent’s API key was rejected (or isn’t allowed to use that model). Double-check the key.',
        )
      }
      if (lastError.status === 429) {
        throw new Error(
          'This agent hit its Gemini rate limit or free-tier quota. Try again in a moment.',
        )
      }
      if (TRANSIENT_STATUSES.has(lastError.status)) {
        throw new Error(
          'Gemini is temporarily overloaded (it does this sometimes, especially on the free tier). Please send your message again in a moment.',
        )
      }
      throw new Error(`The AI service returned an error (${lastError.status}).`)
    }
    throw new Error('Could not reach the AI service. Check your connection and try again.')
  }

  // `response.text` stitches the reply's text parts into one string (grounding
  // metadata is left out). It's undefined if the model returned no text.
  const text = (response.text ?? '').trim()

  if (!text) {
    throw new Error('The agent didn’t return a response. Try rephrasing your message.')
  }
  return text
}
