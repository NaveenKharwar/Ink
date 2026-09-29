-- Word search. `search_text` is a copy the API writes on every sync: the title and words with
-- Devanagari evened out, then a loose Latin spelling of both (apps/api/src/pieces/fold.ts),
-- so partial words, Hindi and English, and Hinglish typing that finds Hindi writing all match.
-- PGroonga's n-gram index finds any part of a word in any script.
create extension if not exists pgroonga with schema extensions;

alter table public.pieces add column search_text text not null default '';

create index pieces_search_idx on public.pieces
  using pgroonga (search_text extensions.pgroonga_text_full_text_search_ops_v2)
  with (
    tokenizer = 'TokenNgram("unify_alphabet", false, "unify_symbol", false, "unify_digit", false)',
    normalizers = 'NormalizerNFKC150'
  );
