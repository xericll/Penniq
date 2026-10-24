-- Debts in the other direction: 'owed' is the ledger for money borrowed from others and
-- 'borrow' the kind of the entry that opens such a debt (repayments stay kind 'repayment').
-- Essentials: the user's list of fixed monthly incomes and costs, kept with the other preferences.

alter table public.transactions
  drop constraint transactions_account_check,
  drop constraint transactions_to_account_check,
  drop constraint transactions_kind_check;

alter table public.transactions
  add constraint transactions_account_check check (account in ('cash', 'bank', 'vault', 'loans', 'owed')),
  add constraint transactions_to_account_check check (to_account in ('cash', 'bank', 'vault', 'loans', 'owed')),
  add constraint transactions_kind_check check (kind in ('adjustment', 'loan', 'borrow', 'repayment'));

alter table public.user_settings add column essentials jsonb;
