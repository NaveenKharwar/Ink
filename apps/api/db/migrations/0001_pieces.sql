-- Pieces of writing. `content` is the editor document; `text` is the plain text
-- the API derives from it for embeddings, search and export.
create table public.pieces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text check (char_length(title) <= 200),
  content jsonb not null,
  text text not null default '',
  status text not null default 'draft' check (status in ('draft', 'finished')),
  language text check (language in ('hi', 'hi-Latn', 'en', 'mixed')),
  is_fragment boolean not null default false,
  include_in_memory boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pieces_user_updated_idx on public.pieces (user_id, updated_at desc, id desc);

-- Row level security on with no policies: nothing is reachable through the
-- Supabase data API. All access goes through the Ink API.
alter table public.pieces enable row level security;
