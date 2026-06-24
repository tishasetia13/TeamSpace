-- ============================================================================
-- Milestone 2 — Workspaces
-- Run this whole file once in the Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- It is safe to re-run: it drops/recreates policies and functions.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles
-- A public mirror of each auth user so we can show names/emails in the app.
-- (We can't read the private auth.users table from the app, so we copy the
--  bits we need into this table.)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. workspaces (the "rooms")
-- invite_token is the secret code that lives in the invite link.
-- ----------------------------------------------------------------------------
create table if not exists public.workspaces (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(trim(name)) between 1 and 60),
  invite_token uuid not null default gen_random_uuid() unique,
  created_by   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. workspace_members (who is in which room)
-- One row per (workspace, user). 'owner' is whoever created it.
-- ----------------------------------------------------------------------------
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.profiles(id)  on delete cascade,
  role         text not null default 'member' check (role in ('owner','member')),
  joined_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_id_idx
  on public.workspace_members (user_id);

-- ----------------------------------------------------------------------------
-- 4. Helper functions (SECURITY DEFINER = they run with elevated rights so
--    they can look past Row Level Security. This avoids "infinite recursion"
--    in policies and is the standard Supabase pattern.)
-- ----------------------------------------------------------------------------

-- Is the current user a member of this workspace?
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
  );
$$;

-- Does the current user share at least one workspace with the given user?
-- (Used so you can only read profiles of people you actually work with.)
create or replace function public.shares_workspace_with(p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members a
    join public.workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid()
      and b.user_id = p_user
  );
$$;

-- ----------------------------------------------------------------------------
-- 5. Turn on Row Level Security and define who can READ what.
--    (All WRITES happen through the functions in section 7, which bypass RLS,
--     so we deliberately do NOT add insert/update policies here. With RLS on
--     and no write policy, the tables can't be written directly from the app —
--     defense in depth.)
-- ----------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;

-- profiles: you can read your own profile, and profiles of co-workers.
drop policy if exists "read own and co-member profiles" on public.profiles;
create policy "read own and co-member profiles"
  on public.profiles for select
  to authenticated
  using ( id = auth.uid() or public.shares_workspace_with(id) );

-- workspaces: you can read a workspace only if you're a member of it.
drop policy if exists "members can read their workspaces" on public.workspaces;
create policy "members can read their workspaces"
  on public.workspaces for select
  to authenticated
  using ( public.is_workspace_member(id) );

-- workspace_members: you can read the member list of any workspace you're in.
drop policy if exists "members can read the member list" on public.workspace_members;
create policy "members can read the member list"
  on public.workspace_members for select
  to authenticated
  using ( public.is_workspace_member(workspace_id) );

-- ----------------------------------------------------------------------------
-- 6. Keep profiles in sync with auth users (trigger + one-time backfill).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed up before this table existed (e.g. Milestone 1).
insert into public.profiles (id, email, display_name)
select id, email, coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 7. The two actions the app calls (atomic + safe).
-- ----------------------------------------------------------------------------

-- Create a workspace AND add the creator as its owner, in one step.
create or replace function public.create_workspace(p_name text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ws   public.workspaces;
begin
  if v_user is null then
    raise exception 'You must be signed in to create a workspace.';
  end if;
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'Workspace name is required.';
  end if;

  insert into public.workspaces (name, created_by)
  values (trim(p_name), v_user)
  returning * into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws.id, v_user, 'owner');

  return v_ws;
end;
$$;

-- Look up a workspace by its invite token WITHOUT joining — just enough to
-- show "You're invited to X" before the user clicks Join.
create or replace function public.workspace_preview(p_token uuid)
returns table (id uuid, name text)
language sql
security definer
set search_path = public
stable
as $$
  select id, name from public.workspaces where invite_token = p_token;
$$;

-- Join a workspace using its invite token. Idempotent: joining twice is fine.
create or replace function public.join_workspace_by_token(p_token uuid)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ws   public.workspaces;
begin
  if v_user is null then
    raise exception 'You must be signed in to join a workspace.';
  end if;

  select * into v_ws from public.workspaces where invite_token = p_token;
  if v_ws.id is null then
    raise exception 'This invite link is not valid.';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws.id, v_user, 'member')
  on conflict (workspace_id, user_id) do nothing;

  return v_ws;
end;
$$;

-- Allow logged-in users to call these functions.
grant execute on function public.create_workspace(text)        to authenticated;
grant execute on function public.workspace_preview(uuid)        to authenticated;
grant execute on function public.join_workspace_by_token(uuid)  to authenticated;


-- ----------------------------------------------------------------------------
-- Workspace management (rename / delete / leave).
-- Same design as everywhere else: the tables have no direct write access, so
-- these SECURITY DEFINER functions are the ONLY way to change a workspace, and
-- they enforce the "who is allowed to do this" rules themselves.
-- ----------------------------------------------------------------------------

-- Is the current user the OWNER of this workspace? (creator = owner role.)
create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- Rename a workspace. Owner only.
create or replace function public.rename_workspace(p_workspace_id uuid, p_name text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws public.workspaces;
begin
  if not public.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the workspace owner can rename it.';
  end if;
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'Workspace name is required.';
  end if;
  if char_length(trim(p_name)) > 60 then
    raise exception 'Workspace name must be 60 characters or fewer.';
  end if;

  update public.workspaces
     set name = trim(p_name)
   where id = p_workspace_id
   returning * into v_ws;

  return v_ws;
end;
$$;

-- Delete a workspace entirely. Owner only. The ON DELETE CASCADE foreign keys
-- on members, messages and agents clean up everything else automatically.
create or replace function public.delete_workspace(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the workspace owner can delete it.';
  end if;
  delete from public.workspaces where id = p_workspace_id;
end;
$$;

-- Leave a workspace (remove your own membership). For NON-owners: an owner must
-- delete the workspace instead, so it never ends up ownerless.
create or replace function public.leave_workspace(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'You must be signed in.';
  end if;
  if public.is_workspace_owner(p_workspace_id) then
    raise exception 'The owner cannot leave; delete the workspace instead.';
  end if;
  delete from public.workspace_members
   where workspace_id = p_workspace_id
     and user_id = v_user;
end;
$$;

grant execute on function public.is_workspace_owner(uuid)        to authenticated;
grant execute on function public.rename_workspace(uuid, text)    to authenticated;
grant execute on function public.delete_workspace(uuid)          to authenticated;
grant execute on function public.leave_workspace(uuid)           to authenticated;


-- ============================================================================
-- Milestone 3 — Shared live chat feed
-- (Re-running this section is safe; everything is guarded.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 8. messages (the shared feed)
-- One row per message in a workspace's single live feed.
--   * user_id is NULLABLE on purpose: a human author is a profile id, but
--     agents/system posts (added in M4+) will have no user_id.
--   * type lets the feed hold more than plain chat later, without a rebuild:
--       'human'         — a person typed it (all we create in M3)
--       'agent_mention' — an agent's reply to an @mention   (M4+)
--       'agent_summary' — auto-summary from a 1-on-1 session (M4+)
--       'activity'      — workspace events (member joined…)  (M4+)
-- ----------------------------------------------------------------------------
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid references public.profiles(id) on delete set null,
  type         text not null default 'human'
                 check (type in ('human','agent_mention','agent_summary','activity')),
  body         text not null check (char_length(trim(body)) between 1 and 4000),
  created_at   timestamptz not null default now()
);

-- Fast "give me this workspace's messages in order" lookups.
create index if not exists messages_workspace_created_idx
  on public.messages (workspace_id, created_at);

-- ----------------------------------------------------------------------------
-- 9. Row Level Security: members can READ their workspace's messages.
--    (As before, there is NO insert policy — all writes go through the
--     post_message() function below, which bypasses RLS safely.)
-- ----------------------------------------------------------------------------
alter table public.messages enable row level security;

drop policy if exists "members can read workspace messages" on public.messages;
create policy "members can read workspace messages"
  on public.messages for select
  to authenticated
  using ( public.is_workspace_member(workspace_id) );

-- ----------------------------------------------------------------------------
-- 10. post_message: the only way to write to the feed. Refuses unless the
--     caller is a real member of the workspace.
-- ----------------------------------------------------------------------------
create or replace function public.post_message(p_workspace_id uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_msg  public.messages;
begin
  if v_user is null then
    raise exception 'You must be signed in to post.';
  end if;
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'You are not a member of this workspace.';
  end if;
  if p_body is null or char_length(trim(p_body)) = 0 then
    raise exception 'Message cannot be empty.';
  end if;

  insert into public.messages (workspace_id, user_id, type, body)
  values (p_workspace_id, v_user, 'human', trim(p_body))
  returning * into v_msg;

  return v_msg;
end;
$$;

grant execute on function public.post_message(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 11. Turn on Realtime for messages so new rows push to everyone instantly.
--     Wrapped in a guard so re-running this file doesn't error.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;


-- ============================================================================
-- Milestone 4 (Step A) — AI Agents: creation + secure API-key storage
-- (Re-running this section is safe; everything is guarded.)
--
-- Design in one sentence: the PUBLIC facts about an agent (name, prompt,
-- provider, model) live in `agents` where teammates can read them, but the
-- SECRET API key lives in a separate locked-down `agent_secrets` table that
-- nobody can read or write through the normal app — only the SECURITY DEFINER
-- functions below can touch it. On top of that, the key is already encrypted by
-- the app (AES-256-GCM) BEFORE it ever reaches the database, so Postgres never
-- sees the real key at all.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 12. agents — the public-to-teammates facts about an agent.
-- ----------------------------------------------------------------------------
create table if not exists public.agents (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  -- nullable + set null: an agent belongs to the workspace, so it survives even
  -- if the teammate who created it later leaves.
  created_by    uuid references public.profiles(id) on delete set null,
  name          text not null check (char_length(trim(name)) between 1 and 60),
  system_prompt text not null check (char_length(trim(system_prompt)) between 1 and 8000),
  provider      text not null check (provider in ('anthropic','openai','gemini')),
  model         text not null check (char_length(trim(model)) between 1 and 120),
  created_at    timestamptz not null default now()
);

create index if not exists agents_workspace_idx
  on public.agents (workspace_id, created_at);

-- ----------------------------------------------------------------------------
-- 13. agent_secrets — the LOCKED BOX. One row per agent, holding ONLY the
--     already-encrypted API key. RLS is on with NO policies, and we revoke all
--     direct grants, so this table is unreadable/unwritable through the app.
--     The only way in is the SECURITY DEFINER functions in sections 14–15.
-- ----------------------------------------------------------------------------
create table if not exists public.agent_secrets (
  agent_id       uuid primary key references public.agents(id) on delete cascade,
  api_key_cipher text not null
);

alter table public.agents        enable row level security;
alter table public.agent_secrets enable row level security;

-- Extra belt-and-braces on top of "RLS on + no policy": take away every direct
-- privilege so even a policy mistake later can't leak the encrypted keys.
revoke all on public.agent_secrets from anon, authenticated;

-- agents: members can READ agents in their workspace. As elsewhere, there are
-- NO write policies — every write goes through the functions below.
drop policy if exists "members can read workspace agents" on public.agents;
create policy "members can read workspace agents"
  on public.agents for select
  to authenticated
  using ( public.is_workspace_member(workspace_id) );

-- ----------------------------------------------------------------------------
-- 14. create_agent — the only way to make an agent. Verifies the caller is a
--     member, then writes the public row AND the encrypted secret atomically.
--     p_api_key_cipher is ALREADY encrypted by the app; we just store it.
-- ----------------------------------------------------------------------------
create or replace function public.create_agent(
  p_workspace_id   uuid,
  p_name           text,
  p_system_prompt  text,
  p_provider       text,
  p_model          text,
  p_api_key_cipher text
)
returns public.agents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_agent public.agents;
begin
  if v_user is null then
    raise exception 'You must be signed in to create an agent.';
  end if;
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'You are not a member of this workspace.';
  end if;
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'Agent name is required.';
  end if;
  if p_system_prompt is null or char_length(trim(p_system_prompt)) = 0 then
    raise exception 'System prompt is required.';
  end if;
  if p_provider not in ('anthropic','openai','gemini') then
    raise exception 'Unknown provider.';
  end if;
  if p_model is null or char_length(trim(p_model)) = 0 then
    raise exception 'Model is required.';
  end if;
  if p_api_key_cipher is null or char_length(p_api_key_cipher) = 0 then
    raise exception 'Missing API key.';
  end if;

  insert into public.agents
    (workspace_id, created_by, name, system_prompt, provider, model)
  values
    (p_workspace_id, v_user, trim(p_name), trim(p_system_prompt), p_provider, trim(p_model))
  returning * into v_agent;

  insert into public.agent_secrets (agent_id, api_key_cipher)
  values (v_agent.id, p_api_key_cipher);

  return v_agent;
end;
$$;

-- ----------------------------------------------------------------------------
-- 15. delete_agent — any member of the agent's workspace can remove it.
--     Deleting the agent row cascades to delete its secret automatically.
-- ----------------------------------------------------------------------------
create or replace function public.delete_agent(p_agent_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.agents where id = p_agent_id;
  if v_ws is null then
    raise exception 'Agent not found.';
  end if;
  if not public.is_workspace_member(v_ws) then
    raise exception 'You are not a member of this workspace.';
  end if;
  delete from public.agents where id = p_agent_id;
end;
$$;

grant execute on function
  public.create_agent(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.delete_agent(uuid) to authenticated;


-- ============================================================================
-- Milestone 4 (Step B) — Agents reply in the feed (@mention → agent_mention)
-- (Re-running this section is safe; everything is guarded.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 16. messages.agent_id — which agent authored an agent_mention/agent_summary.
--     Nullable: human messages have no agent_id. on delete set null so deleting
--     an agent doesn't wipe its past messages from the feed.
-- ----------------------------------------------------------------------------
alter table public.messages
  add column if not exists agent_id uuid references public.agents(id) on delete set null;

-- Agent replies (full code, plans) can be much longer than a human chat line,
-- so raise the body ceiling. (The composer still caps human messages at 4000.)
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages
  add constraint messages_body_check check (char_length(trim(body)) between 1 and 100000);

-- ----------------------------------------------------------------------------
-- 17. get_agent_secret — hands back the ENCRYPTED key for an agent, but only to
--     a member of that agent's workspace. SECURITY DEFINER so it can read the
--     locked-down agent_secrets table. The value is still encrypted — the app
--     decrypts it server-side just before calling the LLM.
-- ----------------------------------------------------------------------------
create or replace function public.get_agent_secret(p_agent_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws     uuid;
  v_cipher text;
begin
  select workspace_id into v_ws from public.agents where id = p_agent_id;
  if v_ws is null then
    raise exception 'Agent not found.';
  end if;
  if not public.is_workspace_member(v_ws) then
    raise exception 'You are not a member of this workspace.';
  end if;
  select api_key_cipher into v_cipher
    from public.agent_secrets where agent_id = p_agent_id;
  return v_cipher;
end;
$$;

-- ----------------------------------------------------------------------------
-- 18. post_agent_message — write a message AUTHORED BY AN AGENT into the feed.
--     The human who triggered it must be a member, and the agent must belong to
--     the same workspace. user_id is null (no human author); agent_id names the
--     agent so the feed can label the message.
-- ----------------------------------------------------------------------------
create or replace function public.post_agent_message(
  p_workspace_id uuid,
  p_agent_id     uuid,
  p_body         text,
  p_type         text
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ws   uuid;
  v_msg  public.messages;
begin
  if v_user is null then
    raise exception 'You must be signed in.';
  end if;
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'You are not a member of this workspace.';
  end if;
  select workspace_id into v_ws from public.agents where id = p_agent_id;
  if v_ws is null or v_ws <> p_workspace_id then
    raise exception 'That agent does not belong to this workspace.';
  end if;
  if p_type not in ('agent_mention','agent_summary','activity') then
    raise exception 'Invalid agent message type.';
  end if;
  if p_body is null or char_length(trim(p_body)) = 0 then
    raise exception 'Message cannot be empty.';
  end if;

  insert into public.messages (workspace_id, user_id, agent_id, type, body)
  values (p_workspace_id, null, p_agent_id, p_type, trim(p_body))
  returning * into v_msg;

  return v_msg;
end;
$$;

grant execute on function public.get_agent_secret(uuid) to authenticated;
grant execute on function public.post_agent_message(uuid, uuid, text, text) to authenticated;


-- ============================================================================
-- Milestone 4 (final) — 1-on-1 agent chats + auto-summary back to the feed
-- (Re-running this section is safe; everything is guarded.)
--
-- A 1-on-1 chat is a PRIVATE deep-work thread between ONE human and ONE agent.
-- Unlike the shared `messages` feed, these rows are visible only to the human
-- who owns them (user_id) — each teammate has their own separate thread with the
-- same agent. When the human is done, an agent-written SUMMARY of the session is
-- posted back into the shared feed as an `agent_summary` message (reusing the
-- post_agent_message function from section 18) so the whole team gets context.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 19. agent_chat_messages — the private 1-on-1 threads.
--     One row per turn. `role` says who spoke ('user' = the human teammate,
--     'agent' = the AI). `user_id` is the OWNER of the thread.
-- ----------------------------------------------------------------------------
create table if not exists public.agent_chat_messages (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id     uuid not null references public.agents(id)     on delete cascade,
  user_id      uuid not null references public.profiles(id)   on delete cascade,
  role         text not null check (role in ('user','agent')),
  body         text not null check (char_length(trim(body)) between 1 and 100000),
  created_at   timestamptz not null default now()
);

-- Fast "give me this one thread in order" lookups.
create index if not exists agent_chat_messages_thread_idx
  on public.agent_chat_messages (workspace_id, agent_id, user_id, created_at);

-- ----------------------------------------------------------------------------
-- 20. Row Level Security: you can READ only your OWN 1-on-1 messages, and only
--     in a workspace you belong to. As elsewhere there is NO insert policy —
--     the write goes through post_agent_chat_message() below.
-- ----------------------------------------------------------------------------
alter table public.agent_chat_messages enable row level security;

drop policy if exists "read own agent chat messages" on public.agent_chat_messages;
create policy "read own agent chat messages"
  on public.agent_chat_messages for select
  to authenticated
  using ( user_id = auth.uid() and public.is_workspace_member(workspace_id) );

-- ----------------------------------------------------------------------------
-- 21. post_agent_chat_message — append one turn to the caller's private thread.
--     The caller must be a member, the agent must belong to the workspace, and
--     the row is ALWAYS owned by the caller (user_id = auth.uid()), so one
--     teammate can never write into another teammate's private thread.
-- ----------------------------------------------------------------------------
create or replace function public.post_agent_chat_message(
  p_workspace_id uuid,
  p_agent_id     uuid,
  p_role         text,
  p_body         text
)
returns public.agent_chat_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ws   uuid;
  v_row  public.agent_chat_messages;
begin
  if v_user is null then
    raise exception 'You must be signed in.';
  end if;
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'You are not a member of this workspace.';
  end if;
  select workspace_id into v_ws from public.agents where id = p_agent_id;
  if v_ws is null or v_ws <> p_workspace_id then
    raise exception 'That agent does not belong to this workspace.';
  end if;
  if p_role not in ('user','agent') then
    raise exception 'Invalid message role.';
  end if;
  if p_body is null or char_length(trim(p_body)) = 0 then
    raise exception 'Message cannot be empty.';
  end if;

  insert into public.agent_chat_messages (workspace_id, agent_id, user_id, role, body)
  values (p_workspace_id, p_agent_id, v_user, p_role, trim(p_body))
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function
  public.post_agent_chat_message(uuid, uuid, text, text) to authenticated;
