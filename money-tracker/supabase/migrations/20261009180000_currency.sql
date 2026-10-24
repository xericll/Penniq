-- The one currency a user's wallet is shown in (ISO 4217 code). Null on accounts from before
-- currencies could be chosen: those are in euros.

alter table public.user_settings add column currency text check (currency ~ '^[A-Z]{3}$');
