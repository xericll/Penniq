-- Support messages (written by a user, answered by the team) and the daily counter
-- behind the assistant's free-form questions. Both follow the rule of the rest of the
-- schema: every row belongs to one account and row level security keeps it that way.

-- ---------- Support ---------------------------------------------------------

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('problem', 'request', 'other')),
  message text not null check (char_length(message) between 1 and 4000),
  -- What the device adds so a problem can be reproduced: app version, language, edition, browser.
  context jsonb,
  -- The three columns below are written by the team only (dashboard or secret key).
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  reply text check (char_length(reply) <= 4000),
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create index support_messages_by_user on public.support_messages (user_id, created_at desc);

alter table public.support_messages enable row level security;

create policy "own support: read" on public.support_messages
for select to authenticated using ((select auth.uid()) = user_id);

-- At most ten messages a day per account, so the table cannot be flooded.
create policy "own support: insert" on public.support_messages
for insert to authenticated with check (
  (select auth.uid()) = user_id
  and (
    select count(*) from public.support_messages recent
    where recent.user_id = (select auth.uid()) and recent.created_at > now() - interval '1 day'
  ) < 10
);

-- A user reads their messages and writes new ones; status and reply are not theirs to set,
-- and there is no update or delete (deleting the account removes the messages with it).
revoke all on public.support_messages from anon, authenticated, public;
grant select on public.support_messages to authenticated;
grant insert (kind, message, context) on public.support_messages to authenticated;

-- ---------- Assistant -------------------------------------------------------

-- Questions sent to the model per account and day (UTC). The `assistant` edge function
-- counts here before every call and stops at its daily limit.
create table public.assistant_usage (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  count integer not null default 0,
  primary key (user_id, day)
);

alter table public.assistant_usage enable row level security;

create policy "own assistant usage: read" on public.assistant_usage
for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.assistant_usage from anon, authenticated, public;
grant select on public.assistant_usage to authenticated;

-- Counts one question for the signed-in user and returns today's total. The limit itself
-- lives in the edge function; calling this directly only uses up the caller's own allowance.
create function public.assistant_take() returns integer
language sql
security definer
set search_path = ''
as $$
  insert into public.assistant_usage as usage (user_id, day, count)
  values ((select auth.uid()), (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set count = usage.count + 1
  returning usage.count;
$$;

revoke all on function public.assistant_take() from public, anon;
grant execute on function public.assistant_take() to authenticated;
