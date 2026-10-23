-- Which old pieces the panel's Forgotten section has already returned, so it can prefer pieces
-- it has never shown and rest a shown piece for a while. `shown_for` is the piece the writer was
-- looking at, so that piece keeps the same notes while they keep working on it. Row level
-- security on with no policies, like every table here: only the API reads or writes it, and
-- every query names the signed-in writer.
create table public.forgotten_shown (
  user_id uuid not null references auth.users (id) on delete cascade,
  piece_id uuid not null references public.pieces (id) on delete cascade,
  shown_for uuid not null references public.pieces (id) on delete cascade,
  shown_at timestamptz not null default now(),
  primary key (user_id, piece_id)
);

alter table public.forgotten_shown enable row level security;
