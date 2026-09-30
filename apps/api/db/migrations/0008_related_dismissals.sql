-- "Not related": a writer dismissed an older piece from the panel of another piece. The pair is
-- hidden for good, in both directions (one row each way), and only for that writer. Row level
-- security on with no policies, like every table here: only the API reads or writes it, and
-- every query names the signed-in writer.
create table public.related_dismissals (
  user_id uuid not null references auth.users (id) on delete cascade,
  piece_id uuid not null references public.pieces (id) on delete cascade,
  other_id uuid not null references public.pieces (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, piece_id, other_id)
);

alter table public.related_dismissals enable row level security;
