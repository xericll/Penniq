-- support_sent_today() was STABLE, so inside one multi-row insert it kept returning the count
-- from before the statement and a single request could slip any number of rows past the daily
-- limit. VOLATILE makes each row see the rows inserted before it.

create or replace function public.support_sent_today() returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select count(*)::integer from public.support_messages
  where user_id = (select auth.uid()) and created_at > now() - interval '1 day';
$$;
