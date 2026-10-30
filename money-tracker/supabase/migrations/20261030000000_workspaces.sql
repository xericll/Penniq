-- Workspaces: separate wallets inside one account (a job, the household…). Every entry names
-- the workspace it belongs to; null is the first one, so every existing row stays where it is.
-- The list of workspaces (id, name, icon, colour) is kept with the other preferences.
-- The row level security policies of both tables cover the new columns unchanged.

alter table public.transactions
  add column workspace_id text check (char_length(workspace_id) between 1 and 80);

alter table public.user_settings
  add column workspaces jsonb check (workspaces is null or jsonb_typeof(workspaces) = 'array');
