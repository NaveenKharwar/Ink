-- Meaning vectors for related writing. One vector per piece (BGE-M3, 1024 numbers, normalised),
-- made in the background after a save. `text_hash` lets the worker skip a piece whose text has
-- not changed. Row level security on with no policies, like every table here: only the API reads
-- or writes it, and every query names the signed-in writer.
create extension if not exists vector with schema extensions;

create table public.piece_embeddings (
  piece_id uuid primary key references public.pieces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  model text not null,
  embedding extensions.vector(1024) not null,
  text_hash text not null,
  embedded_at timestamptz not null default now()
);

create index piece_embeddings_user_idx on public.piece_embeddings (user_id);
create index piece_embeddings_vector_idx on public.piece_embeddings using hnsw (embedding extensions.vector_cosine_ops);

alter table public.piece_embeddings enable row level security;
