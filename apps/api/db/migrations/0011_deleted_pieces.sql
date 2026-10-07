-- The ids of pieces a writer deleted, and nothing else (no words, no title). A device that was
-- offline or had the piece open would otherwise send its copy up again and bring the piece back:
-- a sync for one of these ids is refused. Row level security on with no policies, like every
-- table here: only the API reads or writes it, and every query names the signed-in writer.
create table public.deleted_pieces (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  deleted_at timestamptz not null default now()
);

alter table public.deleted_pieces enable row level security;
