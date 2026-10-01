# How search works

_As of 2026-10-01. Search is still being improved, so treat the numbers below as today's settings, not promises. Each one names the constant in the code that holds it._

Search (Cmd+K) looks through the signed-in writer's own pieces and nothing else. Every query is scoped to the writer in the database, and pieces the writer keeps out of memory are never searched by meaning.

Results come in two groups, in this order:

1. **Words**: pieces that contain what was typed.
2. **Close in meaning**: pieces that do not contain those words but are about the same thing.

A piece is never in both groups. Ink never explains why a piece is close, so there are no reason lines, scores or percentages in the interface.

## 1. Words

Code: `apps/api/src/pieces/fold.ts`, `apps/api/src/pieces/repo.ts`, `apps/api/src/pieces/routes.ts`.

- Every piece has a search copy (its title and text) that is rewritten on every save, so search never reads the editor document.
- A piece matches when it contains **every** typed word. Part of a word counts, so "new" matches "renew" and "knew". At most 12 words and 200 characters are read from the query.
- Matching runs in PostgreSQL with PGroonga. Typed text is escaped, so nothing the writer types is read as query syntax.
- At most 20 results (`SEARCH_LIMIT`), best match first. The dialog shows the first 4 (`WORDS_SHOWN`) and a "Show N more" link for the rest, so the meaning group below always stays on screen. The result shows the piece's first line and, when the words are on a later line, that line too, with the found words marked.

### Spelling: exact for English, loose for the rest

How a piece is matched depends on the language the writer chose for it.

| Piece is labelled | Matching |
| --- | --- |
| English | **Exact words** only. |
| Hindi, Hinglish, mixed, or not labelled yet | Exact words **and** a loose copy (below). |

The loose copy exists because Hindi written in Latin letters has no standard spelling. It folds common variants together: `aa`/`a`, `ee`/`i`, `oo`/`u`, `ph`/`f`, `w`/`v`, `z`/`j`, `sh`/`s`, and doubled letters. Devanagari is also stored in Latin letters, so typing "baarish" or "barish" finds both बारिश and Hinglish pieces. Hindi is evened out as well, so चाँद and चांद match.

English pieces skip the loose copy on purpose. Folding `w` into `v` would make "new" match "never".

## 2. Close in meaning

Code: `apps/api/src/search/meaning.ts`, `apps/api/src/pieces/routes.ts`, `apps/api/src/embeddings/`, `apps/embedder/`.

### How it works

- Each piece is turned into a vector (1,024 numbers) by BGE-M3, an open model that runs on our own machine. The writing never leaves it. Vectors are made in the background after a save, never while the writer types.
- When a search runs, the typed words are turned into a vector the same way and compared with the writer's pieces using cosine similarity. A pause of 200 ms in the search box starts a search.
- The model's server handles one request at a time, so a search can wait behind background work. If it does not answer within 5 seconds, or is not set up, search shows the words group only. Nothing breaks.

### What the score means

Similarity is a number from 0 to 1: how close two texts are in meaning, as the model sees it. Higher is closer. It is **not** a percentage and not a probability.

A piece is shown only when its similarity is at least **0.53** (`MIN_CLOSE_SIMILARITY`), at most **5** pieces (`CLOSE_LIMIT`), closest first.

The cutoff is a guess from one archive of about 60 pieces, so it will be retuned. What it is based on:

- A word or two gives the model little to work on. For queries like "table" or "sleep" everything scores about 0.45 to 0.5, real matches and noise alike, so no piece clears 0.53 and the group stays empty. Showing nothing is better than showing wrong pieces.
- A concrete word with real matches ("rain") scores 0.53 to 0.61 for those pieces.
- Related writing in the editor compares whole pieces with each other, which scores differently, so it has its own, lower cutoff (0.45).

### Which pieces are left out

- Pieces labelled Hinglish. The model cannot read Hindi in Latin letters, so those are found by their words only.
- Pieces under 4 words (`MIN_WORDS`). A few random letters can score closer to a short query than real writing does.
- Pieces kept out of memory.
- Pieces whose vector has not been made yet.
- Pieces already shown in the words group.

## Known limits

- One-word and category queries are weak ("vehicle" does not reliably find a scooter piece).
- A translation is not found by words, and by meaning only when the model is confident: "book" does not reliably find a piece about किताब.
- Hinglish is found by words only.
- Meaning is judged on a whole piece at once, so one relevant line in a long piece gets diluted.

## Planned

Vectors for each line or stanza, an open reranker that reads the query and each candidate together, and a private test set of real searches to tune against.
