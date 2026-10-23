-- A writer's open request to delete their account: the emailed link's token, kept only as its
-- SHA-256 hash, and when the link stops working. One row per writer, so asking again replaces
-- the earlier link. Deleting the account deletes the row with it. Row level security on with no
-- policies, like every table: only the API reaches it.
create table public.account_deletions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.account_deletions enable row level security;
