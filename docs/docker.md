# Run Ink with Docker

Docker runs Ink in three containers from one command: the web app, the API and the embedder. The database is a Supabase project. For changing the code, the steps in [development.md](./development.md) are quicker: the pages reload as you edit.

## What you need

- Docker (Docker Desktop, OrbStack, Podman or colima)
- A [Supabase](https://supabase.com) project (the free plan works)
- About 5 GB of disk: the images and the embedder's model

## 1. Get the code

```bash
git clone https://github.com/NaveenKharwar/Ink.git
cd Ink
cp .env.example .env
```

## 2. Fill in `.env`

From the Supabase dashboard (the table in [development.md](./development.md#2-choose-a-database) says where each one is):

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`: the session pooler
- `EMBEDDER_SECRET`: any 16 or more random characters, for example from `openssl rand -hex 24`
- `APP_URL`: the address Ink opens at, `http://localhost:8080` on your own computer

Download the database certificate (Database settings → SSL Configuration → Download certificate) and save it as `database-ca.crt` in the repository folder, or set `DATABASE_CA_FILE` to its path. `compose.yaml` sets `DATABASE_SSL_CA`, `EMBEDDER_URL` and `EMBEDDER_PRIVATE_HOSTS` itself.

## 3. Build and set up the database

```bash
docker compose build
docker compose run --rm api node dist/scripts/migrate.js
```

The second command applies the database migrations and records each one; run it again after every pull and build. A database that already has Ink's tables but no record of the migrations (set up by hand) is left alone.

## 4. Set up sign-in

Follow [auth-setup.md](./auth-setup.md), with `http://localhost:8080/set-password` (or your own address) as the redirect address.

## 5. Start Ink

```bash
docker compose up -d
```

Open `http://localhost:8080` and sign in with your email. On the first start the embedder downloads its model (about 2 GB) into the `models` volume; until it is ready, Ink matches by shared words.

```bash
docker compose logs -f
docker compose down
```

## The containers

| Container | What it does | Reachable from outside |
| --- | --- | --- |
| `web` | Caddy serves the built web app and passes `/api` to the API, so both share one address | Port 8080 (`INK_PORT`) |
| `api` | The API and its background queue | No |
| `embedder` | Turns each piece into a meaning vector (BGE-M3, on the CPU) | No |

The web image carries the two public Supabase values from `.env`, so it is built again when they change: `docker compose build web`.

## On a server

Point a domain name at the server, set `SITE_ADDRESS` to that name in `.env`, and in `compose.yaml` publish ports 80 and 443 for `web` in place of 8080. Caddy then gets an HTTPS certificate on its own. Set `APP_URL` to `https://` and that name, and add `https://<that name>/set-password` to the Supabase redirect list.

The embedder needs about 2 GB of memory; the API and the web app need little.
