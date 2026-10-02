# Trying the API with Bruno

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
```

`TEST_*` is your everyday test user. `SECOND_*` is a different, confirmed user. You only need them when you want to check that one writer can't see another writer's things.

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

To act as the second user, run its sign-in request. It replaces the token, so everything after it runs as them. To switch back, run the first user's sign-in again.

Always look at the answer of the sign-in itself. If it fails, Bruno quietly keeps the old token, and you carry on thinking you're someone else when you're not. This one is easy to miss.

Also remember that things belong to whoever created them. If you create something while signed in as the second user, it's theirs, and if you later ask for it as that same user, a 200 is the right answer. So when a request succeeds and you expected it to fail, find out who owns the data before you blame the API. In the Supabase SQL editor, something like this will tell you:

```sql
select user_id from <table> where id = '<id>';
```

If you want a clean start, put a fresh id (run `uuidgen` in a terminal) into the variable and save. Just don't commit that change.

## Adding a request

1. Right-click the folder it belongs in and choose **New Request**. Pick the method and use `{{baseUrl}}/api/...` as the URL.
2. Set Auth to Bearer with `{{token}}`, unless the endpoint is meant to be public.
3. Add a body if it needs one.
4. Write the Docs tab: what it does, which status you should get, and anything else worth checking.
5. Keep it with the others in its area. Only start a new numbered folder for a genuinely new area.
6. Keep secrets, real emails and real writing out of it. Use `{{process.env.NAME}}` and made-up sample text.

## What to run, and when

Run the folders for the area you changed. If you changed anything that decides who owns or can see something (database queries, sign-in, sharing), also run the requests that check a second user gets refused, and the ones with a missing or broken token. Only this collection can prove those, and the automated tests can't.
