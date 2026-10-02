import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { fromBase64, toBase64, type Piece } from "@ink/schemas";
import * as Y from "yjs";
import { buildApp } from "../app.js";
import { memoryPicturesRepo } from "../pictures/repo.js";
import { memoryRelatedRepo } from "../related/repo.js";
import { memoryPictureStore } from "../pictures/store.js";
import type { VerifyToken } from "../auth.js";
import { fakeEmbeddingProvider } from "../embeddings/fake.js";
import type { EmbeddingProvider } from "../embeddings/provider.js";
import { memoryMeaningRepo } from "../search/meaning.js";
import { isLoose, searchText, searchWords } from "./fold.js";
import { mergeYdoc } from "./merge.js";
import type { PiecesRepo } from "./repo.js";
import { decodeCursor, encodeCursor } from "./routes.js";

const ASHA = "11111111-1111-4111-8111-111111111111";
const RAVI = "22222222-2222-4222-8222-222222222222";

// Tokens in these tests are "token-<userId>".
const verify: VerifyToken = async (token) => {
  if (!token.startsWith("token-")) throw new Error("bad token");
  return { userId: token.slice("token-".length) };
};

type Row = Omit<Piece, "content" | "text"> & { userId: string; ydoc: Uint8Array; content: Piece["content"]; text: string };

function memoryRepo(): PiecesRepo {
  const rows = new Map<string, Row>();
  let clock = Date.parse("2026-09-27T10:00:00.000Z");
  const tick = () => new Date((clock += 1000)).toISOString();
  const strip = ({ userId: _u, ydoc: _y, ...piece }: Row): Piece => piece;
  const summary = ({ content: _content, ...rest }: Piece) => rest;

  return {
    async sync(userId, id, request) {
      let row = rows.get(id);
      if (!row && request.update) {
        const now = tick();
        row = {
          id, userId, title: null, content: { type: "doc" }, text: "", status: "draft", language: null,
          isFragment: false, includeInMemory: true, createdAt: now, updatedAt: now, ydoc: new Uint8Array()
        };
        rows.set(id, row);
      }
      if (!row || row.userId !== userId) return null;
      const merged = mergeYdoc(row.ydoc, request.update, request.stateVector);
      if (request.update) {
        Object.assign(row, { ydoc: merged.state, content: merged.content, text: merged.text, status: "draft", ...merged.meta });
        row.updatedAt = tick();
      }
      return { piece: summary(strip(row)), update: merged.diff, stateVector: merged.stateVector };
    },
    async list(userId, { limit, after }) {
      const mine = [...rows.values()]
        .filter((row) => row.userId === userId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id))
        .filter((row) => !after || row.updatedAt < after.updatedAt || (row.updatedAt === after.updatedAt && row.id < after.id));
      const page = mine.slice(0, limit);
      const last = page[page.length - 1];
      return {
        items: page.map((row) => summary(strip(row))),
        next: mine.length > limit && last ? { updatedAt: last.updatedAt, id: last.id } : null
      };
    },
    async get(userId, id) {
      const row = rows.get(id);
      return row && row.userId === userId ? strip(row) : null;
    },
    async library(userId) {
      return [...rows.values()]
        .filter((row) => row.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .map((row) => summary(strip(row)));
    },
    // Matches the way the database does: every word in one of the two copies.
    async search(userId, words, limit) {
      const all = (list: string[], stored: string) => list.length > 0 && list.every((w) => w && stored.includes(w));
      return [...rows.values()]
        .filter((row) => row.userId === userId)
        .filter((row) => {
          const loose = isLoose(row.language);
          const stored = searchText(row.title, row.text, loose);
          return all(words.even, stored) || (loose && all(words.latin, stored));
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit)
        .map((row) => summary(strip(row)));
    },
    async update(userId, id, patch) {
      const row = rows.get(id);
      if (!row || row.userId !== userId) return null;
      const next = { ...row, ...patch, title: patch.title === "" ? null : patch.title === undefined ? row.title : patch.title, updatedAt: Object.keys(patch).every((key) => key === "status") ? row.updatedAt : tick() };
      rows.set(id, next as Row);
      return strip(next as Row);
    }
  };
}

// A device: a Yjs document shaped the way the editor stores a piece (stanza = paragraph,
// line break inside it = hardBreak).
function device() {
  const ydoc = new Y.Doc();
  const fragment = ydoc.getXmlFragment("default");
  return {
    ydoc,
    write(...stanzas: string[][]) {
      for (const lines of stanzas) {
        // Attach each part to the document before filling it, as the editor's binding does.
        const p = new Y.XmlElement("paragraph");
        fragment.push([p]);
        lines.forEach((line, i) => {
          if (i > 0) p.push([new Y.XmlElement("hardBreak")]);
          const t = new Y.XmlText();
          p.push([t]);
          t.insert(0, line);
        });
      }
    },
    // The piece's settings live in the document too.
    setMeta(values: { title?: string | null; language?: string }) {
      const meta = ydoc.getMap("meta");
      for (const [key, value] of Object.entries(values)) {
        if (value === null) meta.delete(key);
        else meta.set(key, value);
      }
    },
    // Adds a line at the end of the first stanza.
    append(text: string) {
      const first = fragment.get(0) as Y.XmlElement;
      const last = first.get(first.length - 1) as Y.XmlText;
      last.insert(last.length, text);
    },
    text: () => (fragment.toArray() as Y.XmlElement[]).map((p) => p.toString().replace(/<[^>]+>/g, "")).join("\n")
  };
}
type Device = ReturnType<typeof device>;

async function setup(repo: PiecesRepo = memoryRepo(), embedder: EmbeddingProvider = fakeEmbeddingProvider()) {
  const queued: string[] = [];
  const embeddings = { enqueue: async (id: string) => void queued.push(id), stop: async () => {} };
  const meaning = { repo: memoryMeaningRepo(repo, embedder), embedder };
  const app = await buildApp({ repo, related: memoryRelatedRepo(repo), pictures: { store: memoryPictureStore(), repo: memoryPicturesRepo() }, verify, embeddings, meaning });
  const as = (userId: string) => ({ authorization: `Bearer token-${userId}` });
  return { app, as, queued };
}

test("every pieces route needs a valid token", async () => {
  const { app } = await setup();
  const missing = await app.inject({ method: "GET", url: "/api/pieces" });
  assert.equal(missing.statusCode, 401);
  const bad = await app.inject({ method: "GET", url: "/api/pieces", headers: { authorization: "Bearer nope" } });
  assert.equal(bad.statusCode, 401);
  const health = await app.inject({ method: "GET", url: "/health" });
  assert.equal(health.statusCode, 200);
});

test("the log never keeps what the writer searched for", async () => {
  const lines: string[] = [];
  const repo = memoryRepo();
  const app = await buildApp({
    repo, related: memoryRelatedRepo(repo), pictures: { store: memoryPictureStore(), repo: memoryPicturesRepo() }, verify,
    logger: { write: (line) => void lines.push(line) }
  });
  const res = await app.inject({ method: "GET", url: "/api/search?q=missing%20you", headers: { authorization: `Bearer token-${ASHA}` } });
  assert.equal(res.statusCode, 200);
  const log = lines.join("");
  assert.match(log, /"url":"\/api\/search"/);
  assert.doesNotMatch(log, /missing/);
});

type App = Awaited<ReturnType<typeof setup>>;

// What a device does: send what changed since it last heard from the server, apply the answer.
async function syncFrom({ app, as }: App, user: string, id: string, d: Device, known: Uint8Array | null, extra: Record<string, unknown> = {}) {
  const res = await app.inject({
    method: "POST",
    url: `/api/pieces/${id}/sync`,
    headers: as(user),
    payload: { update: toBase64(Y.encodeStateAsUpdate(d.ydoc, known ?? undefined)), stateVector: toBase64(Y.encodeStateVector(d.ydoc)), ...extra }
  });
  if (res.statusCode === 200) {
    const body = res.json();
    Y.applyUpdate(d.ydoc, fromBase64(body.update));
    return { res, body, known: fromBase64(body.stateVector) };
  }
  return { res, body: res.json(), known };
}

test("the first sync creates the piece and derives plain text", async () => {
  const ctx = await setup();
  const id = randomUUID();
  const d = device();
  d.write(["पिता के हाथों में", "लोहे की गंध थी,"], ["और सर्दियों में"]);
  d.setMeta({ language: "hi" });
  const { res } = await syncFrom(ctx, ASHA, id, d, null);
  assert.equal(res.statusCode, 200);
  const { piece } = res.json();
  assert.equal(piece.id, id);
  assert.equal(piece.text, "पिता के हाथों में\nलोहे की गंध थी,\n\nऔर सर्दियों में");
  assert.equal(piece.language, "hi");
  assert.equal(piece.status, "draft");

  const got = await ctx.app.inject({ method: "GET", url: `/api/pieces/${id}`, headers: ctx.as(ASHA) });
  assert.deepEqual(got.json().content.content[0].content.map((n: { type: string }) => n.type), ["text", "hardBreak", "text"]);
});

test("two devices that both wrote keep both, nothing is overwritten", async () => {
  const ctx = await setup();
  const id = randomUUID();
  const laptop = device();
  laptop.write(["The kettle clicks off"]);
  let laptopKnown = (await syncFrom(ctx, ASHA, id, laptop, null)).known;

  // The phone opens the piece: syncing with nothing brings everything.
  const phone = device();
  const opened = await ctx.app.inject({
    method: "POST",
    url: `/api/pieces/${id}/sync`,
    headers: ctx.as(ASHA),
    payload: { stateVector: toBase64(Y.encodeStateVector(phone.ydoc)) }
  });
  Y.applyUpdate(phone.ydoc, fromBase64(opened.json().update));
  assert.equal(phone.text(), "The kettle clicks off");
  let phoneKnown = fromBase64(opened.json().stateVector);

  // Both write, the laptop is the forgotten one that saves last.
  phone.write(["from the phone"]);
  laptop.append(" and for a second");
  phoneKnown = (await syncFrom(ctx, ASHA, id, phone, phoneKnown)).known;
  laptopKnown = (await syncFrom(ctx, ASHA, id, laptop, laptopKnown)).known;
  await syncFrom(ctx, ASHA, id, phone, phoneKnown);

  const stored = (await ctx.app.inject({ method: "GET", url: `/api/pieces/${id}`, headers: ctx.as(ASHA) })).json();
  assert.ok(stored.text.includes("and for a second"));
  assert.ok(stored.text.includes("from the phone"));
  assert.equal(laptop.text(), phone.text());
});

test("sending the same change again changes nothing", async () => {
  const ctx = await setup();
  const id = randomUUID();
  const d = device();
  d.write(["one stanza"]);
  const first = await syncFrom(ctx, ASHA, id, d, null);
  const again = await syncFrom(ctx, ASHA, id, d, null);
  const third = await syncFrom(ctx, ASHA, id, d, null);
  assert.equal(first.body.piece.text, "one stanza");
  assert.equal(again.body.piece.text, "one stanza");
  assert.equal(third.body.piece.text, "one stanza");
});

test("a writer can neither read nor write into another writer's piece", async () => {
  const ctx = await setup();
  const id = randomUUID();
  const mine = device();
  mine.write(["private"]);
  await syncFrom(ctx, ASHA, id, mine, null);

  assert.equal((await ctx.app.inject({ method: "GET", url: `/api/pieces/${id}`, headers: ctx.as(RAVI) })).statusCode, 404);
  assert.equal((await ctx.app.inject({ method: "PATCH", url: `/api/pieces/${id}`, headers: ctx.as(RAVI), payload: { status: "finished" } })).statusCode, 404);
  assert.deepEqual((await ctx.app.inject({ method: "GET", url: "/api/pieces", headers: ctx.as(RAVI) })).json().items, []);

  // Ravi tries to write to and to fetch from that id: both answer as if it did not exist.
  const theirs = device();
  theirs.write(["not yours"]);
  assert.equal((await syncFrom(ctx, RAVI, id, theirs, null)).res.statusCode, 404);
  const fetchOnly = await ctx.app.inject({ method: "POST", url: `/api/pieces/${id}/sync`, headers: ctx.as(RAVI), payload: { stateVector: "AA==" } });
  assert.equal(fetchOnly.statusCode, 404);

  const still = await ctx.app.inject({ method: "GET", url: `/api/pieces/${id}`, headers: ctx.as(ASHA) });
  assert.equal(still.json().text, "private");
});

test("fetching a piece that does not exist is 404, and nothing is created", async () => {
  const ctx = await setup();
  const res = await ctx.app.inject({ method: "POST", url: `/api/pieces/${randomUUID()}/sync`, headers: ctx.as(ASHA), payload: { stateVector: "AA==" } });
  assert.equal(res.statusCode, 404);
  assert.deepEqual((await ctx.app.inject({ method: "GET", url: "/api/pieces", headers: ctx.as(ASHA) })).json().items, []);
});

test("bytes that are not a Yjs update are a 400", async () => {
  const ctx = await setup();
  const res = await ctx.app.inject({
    method: "POST",
    url: `/api/pieces/${randomUUID()}/sync`,
    headers: ctx.as(ASHA),
    payload: { update: toBase64(new Uint8Array([255, 255, 255, 255, 9, 9])), stateVector: "AA==" }
  });
  assert.equal(res.statusCode, 400);
  const notBase64 = await ctx.app.inject({ method: "POST", url: `/api/pieces/${randomUUID()}/sync`, headers: ctx.as(ASHA), payload: { update: "***", stateVector: "AA==" } });
  assert.equal(notBase64.statusCode, 400);
  const badId = await ctx.app.inject({ method: "POST", url: "/api/pieces/not-a-uuid/sync", headers: ctx.as(ASHA), payload: { stateVector: "AA==" } });
  assert.equal(badId.statusCode, 404);
});

test("title and language are part of the document; patch changes only the flags", async () => {
  const ctx = await setup();
  const id = randomUUID();
  const d = device();
  d.write(["The kettle clicks off"]);
  d.setMeta({ title: "Kettle", language: "en" });
  const { known } = await syncFrom(ctx, ASHA, id, d, null);
  const got = await ctx.app.inject({ method: "GET", url: `/api/pieces/${id}`, headers: ctx.as(ASHA) });
  assert.equal(got.json().title, "Kettle");
  assert.equal(got.json().language, "en");

  d.setMeta({ title: null, language: "hi" });
  const cleared = await syncFrom(ctx, ASHA, id, d, known);
  assert.equal(cleared.body.piece.title, null);
  assert.equal(cleared.body.piece.language, "hi");

  const patched = await ctx.app.inject({ method: "PATCH", url: `/api/pieces/${id}`, headers: ctx.as(ASHA), payload: { status: "finished", isFragment: true } });
  assert.equal(patched.statusCode, 200);
  assert.equal(patched.json().status, "finished");
  assert.equal(patched.json().text, "The kettle clicks off");

  // The words, the title and the language are not patchable: nothing is left to update.
  for (const payload of [{ content: { type: "doc" } }, { title: "Sneaky" }, { language: "hi" }, {}]) {
    const res = await ctx.app.inject({ method: "PATCH", url: `/api/pieces/${id}`, headers: ctx.as(ASHA), payload });
    assert.equal(res.statusCode, 400);
  }
  const created = await ctx.app.inject({ method: "POST", url: "/api/pieces", headers: ctx.as(ASHA), payload: {} });
  assert.equal(created.statusCode, 404);
});

test("marking a piece finished keeps its last-edited time; writing in it again reopens it", async () => {
  const ctx = await setup();
  const id = randomUUID();
  const d = device();
  d.write(["The last train left without us"]);
  const { known } = await syncFrom(ctx, ASHA, id, d, null);
  const before = (await ctx.app.inject({ method: "GET", url: `/api/pieces/${id}`, headers: ctx.as(ASHA) })).json();
  assert.equal(before.status, "draft");

  const patched = await ctx.app.inject({ method: "PATCH", url: `/api/pieces/${id}`, headers: ctx.as(ASHA), payload: { status: "finished" } });
  assert.equal(patched.json().status, "finished");
  assert.equal(patched.json().updatedAt, before.updatedAt);

  const reopened = await ctx.app.inject({ method: "PATCH", url: `/api/pieces/${id}`, headers: ctx.as(ASHA), payload: { status: "draft" } });
  assert.equal(reopened.json().updatedAt, before.updatedAt);
  await ctx.app.inject({ method: "PATCH", url: `/api/pieces/${id}`, headers: ctx.as(ASHA), payload: { status: "finished" } });

  // Reading it again (a sync with nothing to send) leaves it finished.
  const read = await ctx.app.inject({ method: "POST", url: `/api/pieces/${id}/sync`, headers: ctx.as(ASHA), payload: { stateVector: toBase64(Y.encodeStateVector(d.ydoc)) } });
  assert.equal(read.json().piece.status, "finished");

  d.write(["I kept the ticket anyway"]);
  const wrote = await syncFrom(ctx, ASHA, id, d, known);
  assert.equal(wrote.body.piece.status, "draft");
});

test("two devices renaming the same piece: each setting merges on its own", async () => {
  const ctx = await setup();
  const id = randomUUID();
  const laptop = device();
  laptop.write(["one stanza"]);
  laptop.setMeta({ language: "en" });
  let laptopKnown = (await syncFrom(ctx, ASHA, id, laptop, null)).known;

  const phone = device();
  const opened = await ctx.app.inject({ method: "POST", url: `/api/pieces/${id}/sync`, headers: ctx.as(ASHA), payload: { stateVector: toBase64(Y.encodeStateVector(phone.ydoc)) } });
  Y.applyUpdate(phone.ydoc, fromBase64(opened.json().update));
  const phoneKnown = fromBase64(opened.json().stateVector);

  laptop.setMeta({ title: "From the laptop" });
  phone.setMeta({ language: "hi" });
  await syncFrom(ctx, ASHA, id, phone, phoneKnown);
  laptopKnown = (await syncFrom(ctx, ASHA, id, laptop, laptopKnown)).known;

  const stored = (await ctx.app.inject({ method: "GET", url: `/api/pieces/${id}`, headers: ctx.as(ASHA) })).json();
  assert.equal(stored.title, "From the laptop");
  assert.equal(stored.language, "hi");
});

test("a nonsense language or an overlong title in the document never reaches the columns", async () => {
  const ctx = await setup();
  const id = randomUUID();
  const d = device();
  d.write(["x"]);
  d.setMeta({ language: "klingon", title: "y".repeat(500) });
  const { body } = await syncFrom(ctx, ASHA, id, d, null);
  assert.equal(body.piece.language, null);
  assert.equal(body.piece.title.length, 200);
});

test("list is newest first and pages with a cursor", async () => {
  const ctx = await setup();
  for (const line of ["one", "two", "three"]) {
    const d = device();
    d.write([line]);
    await syncFrom(ctx, ASHA, randomUUID(), d, null);
  }
  const first = await ctx.app.inject({ method: "GET", url: "/api/pieces?limit=2", headers: ctx.as(ASHA) });
  const page1 = first.json();
  assert.deepEqual(page1.items.map((p: Piece) => p.text), ["three", "two"]);
  assert.equal("content" in page1.items[0], false);
  assert.ok(page1.nextCursor);

  const second = await ctx.app.inject({ method: "GET", url: `/api/pieces?limit=2&cursor=${page1.nextCursor}`, headers: ctx.as(ASHA) });
  const page2 = second.json();
  assert.deepEqual(page2.items.map((p: Piece) => p.text), ["one"]);
  assert.equal(page2.nextCursor, null);

  assert.equal((await ctx.app.inject({ method: "GET", url: "/api/pieces?cursor=nonsense", headers: ctx.as(ASHA) })).statusCode, 400);
  assert.equal((await ctx.app.inject({ method: "GET", url: "/api/pieces?limit=500", headers: ctx.as(ASHA) })).statusCode, 400);
});

test("cursors round-trip Postgres timestamps with microseconds", () => {
  const cursor = { updatedAt: "2026-09-27 10:00:01.123456+00", id: ASHA };
  assert.deepEqual(decodeCursor(encodeCursor(cursor)), cursor);
  assert.equal(decodeCursor(Buffer.from(JSON.stringify(["drop table", ASHA])).toString("base64url")), null);
});

test("malformed JSON, unknown routes and server errors all use { error, message }", async () => {
  const failing: PiecesRepo = {
    ...memoryRepo(),
    async list() {
      throw new Error('connection to "db.internal" failed: password authentication failed for user "postgres"');
    }
  };
  const { app, as } = await setup(failing);
  const url = `/api/pieces/${randomUUID()}/sync`;

  const badJson = await app.inject({ method: "POST", url, headers: { ...as(ASHA), "content-type": "application/json" }, payload: "{ not json" });
  assert.equal(badJson.statusCode, 400);
  assert.deepEqual(badJson.json(), { error: "invalid_request", message: "The request body is not valid JSON." });

  const wrongType = await app.inject({ method: "POST", url, headers: { ...as(ASHA), "content-type": "application/xml" }, payload: "<piece/>" });
  assert.equal(wrongType.statusCode, 415);
  assert.equal(wrongType.json().error, "unsupported_media_type");

  const unknown = await app.inject({ method: "GET", url: "/api/nothing-here", headers: as(ASHA) });
  assert.equal(unknown.statusCode, 404);
  assert.deepEqual(Object.keys(unknown.json()).sort(), ["error", "message"]);

  const crash = await app.inject({ method: "GET", url: "/api/pieces", headers: as(ASHA) });
  assert.equal(crash.statusCode, 500);
  assert.deepEqual(crash.json(), { error: "server_error", message: "Something went wrong on our side. Try again in a moment." });
  assert.equal(crash.body.includes("password"), false);
});

test("the docs page and its OpenAPI document load when docs are on", async () => {
  const repo = memoryRepo();
  const app = await buildApp({ repo, related: memoryRelatedRepo(repo), pictures: { store: memoryPictureStore(), repo: memoryPicturesRepo() }, verify, docs: true });
  const page = await app.inject({ method: "GET", url: "/docs" });
  assert.ok(page.statusCode === 200 || page.statusCode === 302);
  const spec = await app.inject({ method: "GET", url: "/docs/json" });
  assert.equal(spec.statusCode, 200);
  const doc = spec.json();
  assert.deepEqual(Object.keys(doc.paths).sort(), ["/api/library", "/api/pictures", "/api/pictures/{id}", "/api/pictures/{id}/uses", "/api/pieces", "/api/pieces/{id}", "/api/pieces/{id}/sync", "/api/search", "/health"]);
  assert.ok(doc.paths["/api/pieces/{id}/sync"].post.requestBody.content["application/json"].schema.properties.stateVector);
});

test("the library lists every piece's first two lines, newest first, only the writer's own", async () => {
  const ctx = await setup();
  const d1 = device();
  d1.write(["The kettle clicks off", "and for a second the house"], ["remembers you"]);
  await syncFrom(ctx, ASHA, randomUUID(), d1, null);
  const d2 = device();
  d2.write(["बारिश के बाद"]);
  d2.setMeta({ language: "hi" });
  await syncFrom(ctx, ASHA, randomUUID(), d2, null);
  const other = device();
  other.write(["not yours"]);
  await syncFrom(ctx, RAVI, randomUUID(), other, null);

  const res = await ctx.app.inject({ method: "GET", url: "/api/library", headers: ctx.as(ASHA) });
  assert.equal(res.statusCode, 200);
  const items = res.json().items;
  assert.deepEqual(items.map((i: { lines: string[] }) => i.lines), [["बारिश के बाद"], ["The kettle clicks off", "and for a second the house"]]);
  assert.equal(items[0].language, "hi");
  assert.equal("text" in items[0], false);
});

test("the library tells which pieces are drafts and which are finished", async () => {
  const ctx = await setup();
  const [a, b] = [randomUUID(), randomUUID()];
  for (const id of [a, b]) {
    const d = device();
    d.write(["A line to find later"]);
    await syncFrom(ctx, ASHA, id, d, null);
  }
  await ctx.app.inject({ method: "PATCH", url: `/api/pieces/${b}`, headers: ctx.as(ASHA), payload: { status: "finished" } });
  const items = (await ctx.app.inject({ method: "GET", url: "/api/library", headers: ctx.as(ASHA) })).json().items;
  assert.equal(items.find((i: { id: string }) => i.id === a).status, "draft");
  assert.equal(items.find((i: { id: string }) => i.id === b).status, "finished");
});

test("search finds the writer's own pieces by the words they remember", async () => {
  const ctx = await setup();
  const poem = device();
  poem.write(["पहली पंक्ति"], ["छत पर बैठा चाँद देखता रहा"]);
  const poemId = randomUUID();
  await syncFrom(ctx, ASHA, poemId, poem, null);
  const theirs = device();
  theirs.write(["चाँद chand moon"]);
  await syncFrom(ctx, RAVI, randomUUID(), theirs, null);

  const search = (q: string, user = ASHA) =>
    ctx.app.inject({ method: "GET", url: `/api/search?q=${encodeURIComponent(q)}`, headers: ctx.as(user) });

  const found = (await search("chaand")).json().items;
  assert.equal(found.length, 1);
  assert.equal(found[0].id, poemId);
  assert.equal(found[0].firstLine.text, "पहली पंक्ति");
  assert.deepEqual(found[0].match, { text: "छत पर बैठा चाँद देखता रहा", marks: [[11, 15]] });

  assert.equal((await search("चांद देख")).json().items.length, 1);
  assert.deepEqual((await search("moon")).json().items, []);
  assert.deepEqual((await search("!!")).json().items, []);
  assert.equal((await search("   ")).statusCode, 400);
  assert.equal((await ctx.app.inject({ method: "GET", url: "/api/search", headers: ctx.as(ASHA) })).statusCode, 400);
});

test("English pieces match by their exact words; Hinglish and unlabelled pieces match loosely", async () => {
  const ctx = await setup();
  const save = async (language: string | null, ...lines: string[]) => {
    const d = device();
    d.write(lines);
    if (language) d.setMeta({ language });
    const id = randomUUID();
    await syncFrom(ctx, ASHA, id, d, null);
    return id;
  };
  const renew = await save("en", "Renew the passport before March");
  await save("en", "She never talks to me");
  const wah = await save("hi-Latn", "wah wah, kya baat hai");
  const unlabelled = await save(null, "vah, kya baat");
  const search = async (q: string) => (await ctx.app.inject({ method: "GET", url: `/api/search?q=${encodeURIComponent(q)}`, headers: ctx.as(ASHA) })).json().items;

  // "new" is "nev" once loosened, which sits inside "never": English pieces must not match that way.
  const found = await search("new");
  assert.deepEqual(found.map((i: { id: string }) => i.id), [renew]);
  assert.deepEqual(found[0].firstLine.marks, [[0, 5]]);
  // Hinglish keeps the loose spellings: w and v meet.
  assert.deepEqual((await search("vah")).map((i: { id: string }) => i.id).sort(), [unlabelled, wah].sort());
});

test("search adds pieces close in meaning after the words, never repeats one, and stays the writer's own", async () => {
  const embedder = fakeEmbeddingProvider();
  const ctx = await setup(memoryRepo(), embedder);
  const save = async (user: string, ...lines: string[]) => {
    const d = device();
    d.write(lines);
    if (lines[0]?.startsWith("hinglish:")) d.setMeta({ language: "hi-Latn" });
    const id = randomUUID();
    await syncFrom(ctx, user, id, d, null);
    return id;
  };
  const hit = await save(ASHA, "kettle cold tea");
  const near = await save(ASHA, "kettle cold tonight again");
  await save(ASHA, "kettle cold"); // very close, but too short to count
  await save(ASHA, "hinglish: kettle cold tonight again"); // labelled Hinglish: words only, never by meaning
  await save(ASHA, "taxes receipts");
  await save(RAVI, "kettle cold tonight again");

  const res = await ctx.app.inject({ method: "GET", url: "/api/search?q=kettle%20cold%20tea", headers: ctx.as(ASHA) });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json().items.map((i: { id: string }) => i.id), [hit]);
  const close = res.json().close;
  assert.deepEqual(close.map((i: { id: string }) => i.id), [near]);
  assert.deepEqual(close[0].firstLine, { text: "kettle cold tonight again", marks: [] });
  assert.equal(close[0].match, null);

  // The dialog can ask for each half alone: the quick words, then the slow meaning.
  const wordsOnly = await ctx.app.inject({ method: "GET", url: "/api/search?q=kettle%20cold%20tea&part=words", headers: ctx.as(ASHA) });
  assert.deepEqual(wordsOnly.json().items.map((i: { id: string }) => i.id), [hit]);
  assert.deepEqual(wordsOnly.json().close, []);
  const closeOnly = await ctx.app.inject({ method: "GET", url: "/api/search?q=kettle%20cold%20tea&part=close", headers: ctx.as(ASHA) });
  assert.deepEqual(closeOnly.json().items, []);
  assert.deepEqual(closeOnly.json().close.map((i: { id: string }) => i.id), [near]);
  assert.equal((await ctx.app.inject({ method: "GET", url: "/api/search?q=kettle&part=nonsense", headers: ctx.as(ASHA) })).statusCode, 400);

  // The embedder being down must not break word search.
  const broken: EmbeddingProvider = { model: "down", embed: async () => { throw new Error("down"); } };
  const down = await setup(memoryRepo(), broken);
  const d = device();
  d.write(["kettle cold"]);
  await syncFrom(down, ASHA, randomUUID(), d, null);
  const fallback = await down.app.inject({ method: "GET", url: "/api/search?q=kettle", headers: down.as(ASHA) });
  assert.equal(fallback.statusCode, 200);
  assert.equal(fallback.json().items.length, 1);
  assert.deepEqual(fallback.json().close, []);

  // Not a word at all: nothing is embedded.
  const before = embedder.calls.length;
  assert.deepEqual((await ctx.app.inject({ method: "GET", url: "/api/search?q=!!", headers: ctx.as(ASHA) })).json(), { items: [], close: [] });
  assert.equal(embedder.calls.length, before);
});

test("a save that writes queues the piece for embedding; a read or a refused save does not", async () => {
  const ctx = await setup();
  const id = randomUUID();
  const d = device();
  d.write(["The kettle clicks off"]);
  await syncFrom(ctx, ASHA, id, d, null);
  assert.deepEqual(ctx.queued, [id]);

  await ctx.app.inject({ method: "GET", url: `/api/pieces/${id}`, headers: ctx.as(ASHA) });
  await ctx.app.inject({ method: "PATCH", url: `/api/pieces/${id}`, headers: ctx.as(RAVI), payload: { isFragment: true } }); // not his piece
  assert.deepEqual(ctx.queued, [id]);

  await ctx.app.inject({ method: "PATCH", url: `/api/pieces/${id}`, headers: ctx.as(ASHA), payload: { includeInMemory: false } });
  assert.deepEqual(ctx.queued, [id, id]);
});
