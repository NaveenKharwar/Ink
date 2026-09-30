-- The writer's pictures, listed (the bytes stay in the private Storage bucket). Keyed by writer
-- and id together, so one writer's id can never touch another's row. RLS on, no policies: only
-- the API reads it, and every query names the writer.
create table public.pictures (
  user_id uuid not null references auth.users (id) on delete cascade,
  id uuid not null,
  type text not null check (type in ('image/jpeg', 'image/webp')),
  bytes integer not null check (bytes >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index pictures_newest on public.pictures (user_id, created_at desc);
alter table public.pictures enable row level security;

-- Which pictures each piece uses (its cover and the pictures in its text). A copy the API
-- writes on every sync, from the piece's Yjs document, so "Used in" and delete can find them.
alter table public.pieces add column picture_ids uuid[] not null default '{}';
create index pieces_picture_ids on public.pieces using gin (picture_ids);
