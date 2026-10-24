-- Penniq cloud wallet: one row per transaction and one settings row per user.
-- Every row belongs to exactly one account and row level security keeps it that way.

create table public.transactions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Generated on the device (see newId() in src/lib/ledger.ts), unique per user.
  id text not null check (char_length(id) between 1 and 80),
  amount numeric(14, 2) not null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  account text not null check (account in ('cash', 'bank')),
  to_account text check (to_account in ('cash', 'bank')),
  reason text not null default '' check (char_length(reason) <= 2000),
  category text check (char_length(category) <= 120),
  occurred_at timestamptz not null,
  kind text check (kind = 'adjustment'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  income_sources jsonb,
  expense_sources jsonb,
  budget numeric(14, 2),
  quick_amounts jsonb,
  updated_at timestamptz not null default now()
);

create function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger transactions_touch before update on public.transactions
for each row execute function public.touch_updated_at();

create trigger user_settings_touch before update on public.user_settings
for each row execute function public.touch_updated_at();

-- Row level security: a signed-in user reads and writes only their own rows.
alter table public.transactions enable row level security;
alter table public.user_settings enable row level security;

create policy "own transactions: read" on public.transactions
for select to authenticated using ((select auth.uid()) = user_id);
create policy "own transactions: insert" on public.transactions
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own transactions: update" on public.transactions
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own transactions: delete" on public.transactions
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own settings: read" on public.user_settings
for select to authenticated using ((select auth.uid()) = user_id);
create policy "own settings: insert" on public.user_settings
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own settings: update" on public.user_settings
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own settings: delete" on public.user_settings
for delete to authenticated using ((select auth.uid()) = user_id);

-- Visitors who are not signed in get nothing at all.
revoke all on public.transactions, public.user_settings from anon, public;
grant select, insert, update, delete on public.transactions, public.user_settings to authenticated;

-- Lets a user erase their own account; the cascade removes their wallet with it.
create function public.delete_account() returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
