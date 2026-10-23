-- How many requests of each kind (searches, looks, uploads) a writer made in their current window,
-- so the per-writer limits hold however many API machines answer. One row per writer and kind,
-- counted and reset in place. Row level security on with no policies, like every table: only the
-- API reaches it.
create table public.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  used integer not null check (used >= 0),
  primary key (user_id, bucket)
);

alter table public.rate_limits enable row level security;
