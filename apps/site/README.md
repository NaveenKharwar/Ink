# Ink website

A single static page: what Ink is, and a way in. Plain Vite, no framework.

- `pnpm --filter @ink/site dev` runs it, `pnpm --filter @ink/site build` makes `dist/`.
- `APP_URL=https://… pnpm --filter @ink/site build` sets where "Start writing" goes (the app's address).
- `public/screens/` holds the four real phone screenshots the page expects (`poem-related`, `hindi-list`, `seasons`, `blank-page`, `.webp`). Until a file is there its frame stays empty.
- `public/paintings/` holds the sign-in and season paintings, copied from the app.
