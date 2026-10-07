# Trying the API with Bruno

CI runs this whole collection on every pull request (the `api-checks` job in `.github/workflows/ci.yml`): a real local Supabase, the real API and a stand-in embedder, two throwaway writers. A request fails the job when its `assert` or `tests` block fails. So you no longer have to run the privacy and token checks by hand before a PR; this guide is for trying the API yourself, and for adding requests.

This folder is a Bruno collection. Each `.bru` file is one request you can send to the API by hand, and the numbered folders group them by area. It's the quickest way to see what the real API does with the real database. The automated tests use an in-memory stand-in and never touch the database, so this is where you check the real thing.

## Getting started

Open Bruno, choose **Open Collection**, and pick this folder.

Next you need a `.env` file here. It holds your test accounts, so git ignores it, and you should never commit it:

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
TEST_EMAIL=
TEST_PASSWORD=
SECOND_EMAIL=
SECOND_PASSWORD=
EXPIRED_TOKEN=
```

`TEST_*` is your everyday test user. `SECOND_*` is a different, confirmed user. You only need them when you want to check that one writer can't see another writer's things. `EXPIRED_TOKEN` is an old token (copy one from an earlier sign-in and wait an hour), for the expired-token check.

Start the API from the repo root, in your own terminal:

```bash
pnpm --filter @ink/api dev
```

Then pick the **Local** environment in the top right of Bruno. If it still says "No Environment", the requests won't know where to go.

## What's in the folder

- `collection.bru` holds the variables shared by every request (like which piece the requests work on), plus a short overview.
- `environments/Local.bru` holds the things that change depending on where the API runs, such as `baseUrl`.
- `.env` holds your secrets.
- The numbered folders hold the requests. Run them in number order, because later ones often use what the earlier ones created.

## Read the Docs tab

Every request has a **Docs** tab. It tells you what the request does and what you should see: which status code, and what to look for in the answer. That tab is the truth for a single request, so this file doesn't repeat it. When you're unsure what "good" looks like, look there first.

## Variables

You'll see names in double curly braces, like `{{baseUrl}}` or `{{pieceId}}`. Bruno swaps them for their values before sending.

The `token` is the one to understand. The sign-in requests save it, and every other request sends it. It lasts about an hour, so when everything suddenly answers 401, just sign in again.

If a variable was never set, Bruno sends the name as plain text. That usually shows up as a strange 400 or 404, so if an answer makes no sense, check the variables before anything else.

## Running things

Press **Send** to run one request, or right-click a folder and choose **Run** to run them all. Look at the status code first, then at the body.

## Trying it as someone else

The second user's sign-in saves its own token as `secondToken`. The requests that act as the second writer (the "Privacy" ones) use it, and everything else uses `token`. Nothing needs switching by hand.

Always look at the answer of the sign-in itself. If it fails, Bruno quietly keeps the old variable, and you carry on thinking you're someone else when you're not.

Also remember that things belong to whoever created them. If you create something while signed in as the second user, it's theirs, and if you later ask for it as that same user, a 200 is the right answer. So when a request succeeds and you expected it to fail, find out who owns the data before you blame the API. In the Supabase SQL editor, something like this will tell you:

```sql
select user_id from <table> where id = '<id>';
```

If you want a clean start, put a fresh id (run `uuidgen` in a terminal) into the variable and save. Just don't commit that change.

## Adding a request

1. Right-click the folder it belongs in and choose **New Request**. Pick the method and use `{{baseUrl}}/api/...` as the URL.
2. Set Auth to Bearer with `{{token}}`, unless the endpoint is meant to be public.
3. Add a body if it needs one.
4. Add an `assert` for the status you expect (and a `tests` block for anything in the body that matters). CI fails the PR on these.
5. Write the Docs tab: what it does, which status you should get, and anything else worth checking.
6. Keep it with the others in its area. Only start a new numbered folder for a genuinely new area.
7. Keep secrets, real emails and real writing out of it. Use `{{process.env.NAME}}` and made-up sample text.

## What to run, and when

CI runs everything on each PR, against a real database, so the second-user and broken-token checks no longer depend on you remembering. Run folders by hand only to look at an answer yourself.

What CI cannot tell you is how good the real embedder's answers are (floors, ranking): it uses a stand-in that only needs shared words. Check that against the real embedder on your Mac.
