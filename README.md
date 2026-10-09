# Ink

> A private memory for your writing.

Ink is a writing workspace that remembers everything you write. It quietly brings back forgotten pieces, connects fragments that belong together, and notices patterns across your work over time.

It is made for writers first: poems, stories, letters and notes, in any language. Writing stays private. Ink never critiques, rewrites or generates text, and it has no streaks or dashboards.

## What it does

- **Write.** A calm editor that saves on the device first and syncs in the background. Pieces have a style (Poem, Story and others), a season, and an optional cover picture.
- **Related.** Next to a piece, Ink shows older pieces that are close in meaning, ones that were forgotten, and loose lines that have no home yet.
- **Search.** Cmd+K finds pieces by their words (with typo tolerance) and by meaning.
- **Noticed.** One quiet remark under All writing, such as an old line that returns, built from fixed sentence patterns and never generated.
- **Private by default.** Every request is scoped to the signed-in writer. A piece can be kept out of Ink's memory, and a piece can be deleted for good.
- **Colours.** Moss, Paper and Night, or follow the device.

## How the memory works

Ink turns each piece into a meaning vector with an open model ([BGE-M3](https://huggingface.co/BAAI/bge-m3)) running on a private embedder service. A piece is embedded in the background after it has been quiet for a while, never on a keystroke. Related and meaning search then compare vectors inside the writer's own pieces. Only open models are used. See [docs/search.md](./docs/search.md) for the settings behind search.

## Repository layout

| Path | What it holds |
| --- | --- |
| `apps/web` | The writing app (React, Vite, TypeScript) |
| `apps/api` | The API (Fastify, Zod, PostgreSQL through Supabase), migrations, and the Bruno privacy checks |
| `apps/embedder` | The embedder service (Python), see its [README](./apps/embedder/README.md) |
| `packages/schemas` | Zod schemas shared by the web app and the API |
| `docs` | Setup notes: [search](./docs/search.md) and [sign-in emails](./docs/auth-setup.md) |

It is a pnpm and Turborepo monorepo.

## Run it locally

You need Node 20 or newer, pnpm, a [Supabase](https://supabase.com) project, and Python 3.11 for the embedder.

1. Install the packages.

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and fill it in (Supabase keys, the database URL, and the embedder address).

3. Start the embedder. The first start downloads the model, about 2 GB.

   ```bash
   cd apps/embedder
   python3.11 -m venv .venv && source .venv/bin/activate
   pip install --require-hashes -r requirements.txt
   python server.py
   ```

4. Start the API and the web app in two terminals.

   ```bash
   pnpm --filter @ink/api dev
   ```

   ```bash
   pnpm --filter @ink/web dev
   ```

   The web app opens at `http://localhost:5173`. In development the API serves interactive docs at `/docs`.

To open the app on a phone on the same network, run the web app with `--host` and open `http://<your-computer-address>:5173`. The address also needs to be in the Supabase redirect list (see [docs/auth-setup.md](./docs/auth-setup.md)).

## Checks

```bash
pnpm typecheck
pnpm test
```

Every pull request also runs a CI job that starts a local Supabase and the real API, then runs the Bruno collection in `apps/api/bruno`. It signs in as two different writers and checks that neither can read or change the other's data, and that expired, broken and signed-out tokens are refused.

## Status

Ink is in early development. It is not open to outside contributions (see [CONTRIBUTING.md](./CONTRIBUTING.md)); to report a security issue, do it privately instead of opening a public issue.

## Licence

MIT. See [LICENSE.md](./LICENSE.md).
