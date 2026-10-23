# Run Ink yourself

This guide sets up Ink on your own computer, from a fresh clone to signing in and writing. To run Ink in containers with one command, see [docker.md](./docker.md).

## What you need

- Node 20 or newer, and pnpm (`corepack enable` gives you the version the repository names)
- A [Supabase](https://supabase.com) project, or Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development) for one on your computer
- Python 3.11, only for the embedder (optional, see step 6)

## 1. Get the code

```bash
git clone https://github.com/NaveenKharwar/Ink.git
cd Ink
pnpm install
```

## 2. Choose a database

Ink keeps writers, pieces and pictures in Supabase. Pick one of these.

**A Supabase project.** Create a project at supabase.com. You need these values from its dashboard:

| `.env` value | Where it is |
| --- | --- |
| `SUPABASE_URL` | Connect (top of the page): the project URL |
| `SUPABASE_ANON_KEY` | Settings → API Keys: the publishable key (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API Keys: a secret key (`sb_secret_…`) |
| `DATABASE_URL` | Connect → Session pooler, with your database password in place of `[YOUR-PASSWORD]` |
| `DATABASE_SSL_CA` | Database settings → SSL Configuration → Download certificate, then the file's path |

The session pooler works on any network. The direct connection also works where your network has IPv6.

**A local Supabase.** Nothing leaves your computer, and the sign-in emails land in a local inbox. It runs in Docker (or OrbStack, Podman, colima). In the repository folder:

```bash
supabase init
```

Ink signs writers in with a code, and Supabase's own emails carry only a link, so point the local emails at Ink's. Add this to `supabase/config.toml` (the paths start from the repository folder), and in its `[auth]` section add `"http://localhost:5173/set-password"` to `additional_redirect_urls`:

```toml
[auth.email.template.magic_link]
subject = "Your Ink sign-in code"
content_path = "./docs/email-templates/sign-in-code.html"

[auth.email.template.confirmation]
subject = "Welcome to Ink, here is your code"
content_path = "./docs/email-templates/confirm-signup.html"

[auth.email.template.recovery]
subject = "Set your Ink password"
content_path = "./docs/email-templates/reset-password.html"
```

Then start it:

```bash
supabase start
supabase status -o env
```

The second command prints the values for `.env`: `API_URL` is `SUPABASE_URL`, `PUBLISHABLE_KEY` is `SUPABASE_ANON_KEY`, `SECRET_KEY` is `SUPABASE_SERVICE_ROLE_KEY`, and `DB_URL` with `?sslmode=disable` at the end is `DATABASE_URL`. Leave `DATABASE_SSL_CA` empty: the local database has no certificate. After a change to `config.toml`, run `supabase stop` and `supabase start`.

## 3. Fill in `.env`

```bash
cp .env.example .env
```

Fill in the Supabase values from step 2. Each value in `.env.example` has a comment saying what it does; everything below the Supabase and database values is optional.

The web app and the API read the same `.env`. The service role key stays with the API and never reaches a browser.

## 4. Set up the database

```bash
pnpm db:migrate
```

This applies the files in `apps/api/db/migrations` in order and records each one, so running it again only applies what is new. Run it again after every pull.

With a local Supabase, run it as `NODE_ENV=development pnpm db:migrate`: the local database has no certificate to check.

A database that already has Ink's tables but no record of the migrations (set up by hand) is left alone.

## 5. Set up sign-in

Writers sign in with a 6-digit code sent by email.

**A Supabase project.** Follow the settings in [auth-setup.md](./auth-setup.md): the redirect address for `http://localhost:5173/set-password`, the code expiry, and the three email templates. Supabase's own email sender only writes to the members of your Supabase team, two emails an hour, which is enough to try Ink yourself; for anyone else, set up your own email service (custom SMTP).

**A local Supabase.** The emails, with their codes, land in the local inbox at `http://localhost:54324`.

## 6. Start the embedder (optional)

The embedder turns each piece into a meaning vector, so Echoes and search find writing that is close in meaning even when the words are different. Without it, Ink matches by shared words.

```bash
cd apps/embedder
python3.11 -m venv .venv
.venv/bin/pip install --require-hashes -r requirements.txt
.venv/bin/python server.py
```

The first start downloads the model, about 2 GB. Then set `EMBEDDER_URL=http://127.0.0.1:8001` in `.env`. More in the [embedder README](../apps/embedder/README.md).

## 7. Start Ink

In two terminals:

```bash
pnpm --filter @ink/api dev
```

```bash
pnpm --filter @ink/web dev
```

Open `http://localhost:5173` and sign in with your email. In development the API serves interactive docs at `http://localhost:3001/docs`.

To open Ink on a phone on the same network, start the web app with `--host`, open `http://<your-computer-address>:5173`, and add that address to the Supabase redirect list (see [auth-setup.md](./auth-setup.md)).

## Checks

```bash
pnpm typecheck
pnpm test
```

The database tests create and delete writers, so they need a database that only lives for the test run, such as a local Supabase with the migrations applied. They read `DATABASE_URL` from the shell, not from `.env`:

```bash
DATABASE_URL="<the local DB_URL>?sslmode=disable" pnpm --filter @ink/api test:db
```

Never point them at a database with real writing in it.
