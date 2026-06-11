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
