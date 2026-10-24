-- The insert policy of support_messages counted the user's recent messages with a sub-select
-- on the same table, which Postgres rejects at the first insert ("infinite recursion detected
-- in policy"). The count now comes from a function that reads the table outside row level
-- security, and the policy only compares the number.

drop policy "own support: insert" on public.support_messages;

-- How many messages the signed-in user sent in the last 24 hours. Shows nothing but the caller's own count.
create function public.support_sent_today() returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.support_messages
  where user_id = (select auth.uid()) and created_at > now() - interval '1 day';
$$;

revoke all on function public.support_sent_today() from public, anon;
grant execute on function public.support_sent_today() to authenticated;

-- At most ten messages a day per account, so the table cannot be flooded.
create policy "own support: insert" on public.support_messages
for insert to authenticated with check ((select auth.uid()) = user_id and public.support_sent_today() < 10);
