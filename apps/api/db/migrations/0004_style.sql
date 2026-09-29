-- A piece's writing style (poem, story or notes) lives in its Yjs document with the title and
-- language; this column is a copy the API writes on every sync, so lists and search can show
-- it without opening the document. Null (older pieces) reads as a poem.
alter table public.pieces
  add column style text check (style in ('poem', 'story', 'notes'));
