# TeamSpace

A shared, real-time chat workspace where a small team and their AI agents work in the same conversation.

Teammates chat in one live feed. Anyone can create an AI agent for the team, and anyone can bring it into the conversation with an `@mention`. The agent reads the recent feed for context and replies in the feed, where everyone sees it. For deeper work, a teammate can open a private 1-on-1 chat with an agent, and when they are done, the agent posts a short summary of that session back to the team feed.

Built for small teams of 2–5 people, like hackathon or weekend project teams.

**Status:** runs locally. Not deployed.

## Features

- **Workspaces with invite links.** Create a workspace, share its invite link, and teammates join with one click.
- **Live shared feed.** Messages appear for everyone instantly through Supabase Realtime.
- **Custom AI agents.** A short wizard asks plain-English questions (name, role, what it helps with, how it should talk, what it should never do) and turns the answers into the agent's system prompt, so no one has to write prompts by hand.
- **Three providers.** Each agent runs on Anthropic, OpenAI or Gemini using the team's own API key, and each has its provider's built-in web search.
- **@mentions.** Mention an agent in the feed and it replies there, using the last 40 messages as context.
- **Private 1-on-1 chats** with any agent, visible only to the teammate who owns the thread.
- **Session summaries.** At the end of a 1-on-1, the agent writes a summary and posts it to the shared feed so the rest of the team stays in the loop.
- **Workspace management.** Owners can rename or delete a workspace. Members can leave.

## Security design

- **Row Level Security on every table.** Users can only read workspaces they belong to, profiles of people they share a workspace with, and their own private agent chats.
- **No direct writes from the app.** Tables have no insert or update policies. Every write goes through a Postgres function that checks the caller is signed in and is a member of the workspace before doing anything.
- **Encrypted API keys.** Each agent's API key is encrypted on the server with AES-256-GCM before it reaches the database. Keys sit in a separate table with all direct access revoked. A key is only decrypted on the server, just before calling the AI provider, and is never sent to the browser.

## How an @mention works

1. A teammate posts a message containing `@AgentName`.
2. The server loads the agent's settings and decrypts its API key.
3. It builds a transcript of the last 40 feed messages, with each author's name, and sends it to the agent's provider along with the agent's system prompt.
4. The reply is saved to the feed as a message from the agent, and Realtime pushes it to everyone.

A single translator function (`lib/agents/ask.ts`) picks the right provider module, so the rest of the app does not need to know which AI company is behind an agent.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, Server Actions), React 19, TypeScript |
| UI | Tailwind CSS, shadcn/ui |
| Database, auth, realtime | Supabase (Postgres, Row Level Security, Realtime, email and password auth) |
| AI providers | Anthropic (`claude-sonnet-4-6`), OpenAI (`gpt-4.1-mini`), Gemini (`gemini-2.5-flash`) |
| Encryption | Node.js `crypto`, AES-256-GCM |

## Project structure

```
app/actions/        Server Actions: workspaces, messages, agents
app/(app)/          Dashboard, workspace page, 1-on-1 agent chat page
app/(auth)/         Login and signup
app/join/[token]/   Invite link page
components/         Chat feed, agent wizard, agent chat, workspace UI
lib/agents/         One module per AI provider, plus the translator (ask.ts)
lib/crypto/         API key encryption and decryption
lib/supabase/       Supabase clients for the browser and the server
supabase/schema.sql Tables, security policies and database functions
proxy.ts            Sends signed-out users to the login page
```

## Run it locally

1. Create a Supabase project. In its **SQL Editor**, run all of `supabase/schema.sql`.
2. Clone this repo and install dependencies:
   ```
   npm install
   ```
3. Create `.env.local` in the project root:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   AGENT_KEY_SECRET=output-of-the-command-below
   ```
   Generate `AGENT_KEY_SECRET` with:
   ```
   openssl rand -base64 32
   ```
4. Start the app:
   ```
   npm run dev
   ```
5. Open http://localhost:3000, sign up, create a workspace, and add an agent with your own API key.

## Limitations

- **Agents only act when @mentioned.** They do not join conversations on their own.
- **Limited context.** Agents see only the last 40 feed messages, or the last 40 turns of a 1-on-1 chat.
- **No streaming.** Agent replies appear all at once after they finish.
- **One model per provider,** with no option to choose a different model.
- **Any member can delete any agent** in their workspace, not only its creator.
- **Invite links do not expire** and cannot be reset.
- **Not deployed** yet.
