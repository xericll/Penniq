-- The vault (money kept aside) and loans (money lent to others) are two more places an entry
-- can point at. A loan is an entry of kind 'loan'; each repayment is an entry of kind
-- 'repayment' whose debt_id is the id of that loan.

alter table public.transactions
  add column person text check (char_length(person) <= 120),
  add column debt_id text check (char_length(debt_id) <= 80);

alter table public.transactions
  drop constraint transactions_account_check,
  drop constraint transactions_to_account_check,
  drop constraint transactions_kind_check;

alter table public.transactions
  add constraint transactions_account_check check (account in ('cash', 'bank', 'vault', 'loans')),
  add constraint transactions_to_account_check check (to_account in ('cash', 'bank', 'vault', 'loans')),
  add constraint transactions_kind_check check (kind in ('adjustment', 'loan', 'repayment'));
