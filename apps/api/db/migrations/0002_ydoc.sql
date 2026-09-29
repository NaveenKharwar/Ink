-- Writing is stored as a Yjs document, so edits from two devices merge instead of
-- one overwriting the other. `ydoc` is the source of truth; `content` (editor JSON)
-- and `text` are copies the API derives from it on every sync.
alter table public.pieces add column ydoc bytea not null default ''::bytea;
