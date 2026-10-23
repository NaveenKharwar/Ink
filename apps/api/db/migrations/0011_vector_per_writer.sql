-- Vectors are only ever compared within one writer's pieces. The approximate index over every
-- writer's vectors answered "closest overall" first and filtered by writer afterwards, so a
-- writer could get fewer close pieces than they have. Each writer's vectors are few, so an exact
-- scan through the per-writer index is both correct and fast.
drop index if exists public.piece_embeddings_vector_idx;

-- A vector's writer must be its piece's writer. Validated separately, so a mismatch (there should
-- be none) stops the migration with a clear error instead of being kept.
alter table public.pieces add constraint pieces_id_user_key unique (id, user_id);
alter table public.piece_embeddings
  add constraint piece_embeddings_piece_owner_fkey
  foreign key (piece_id, user_id) references public.pieces (id, user_id) on delete cascade not valid;
alter table public.piece_embeddings validate constraint piece_embeddings_piece_owner_fkey;
