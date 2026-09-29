import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { fromBase64, toBase64, type Piece } from "@ink/schemas";
import * as Y from "yjs";
import { buildApp } from "../app.js";
import type { VerifyToken } from "../auth.js";
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
      if (request.update) Object.assign(row, { ydoc: merged.state, content: merged.content, text: merged.text });
      if (request.title !== undefined) row.title = request.title || null;
      if (request.language !== undefined) row.language = request.language;
      if (request.update || request.title !== undefined || request.language !== undefined) row.updatedAt = tick();
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
    async update(userId, id, patch) {
      const row = rows.get(id);
      if (!row || row.userId !== userId) return null;
      const next = { ...row, ...patch, title: patch.title === "" ? null : patch.title === undefined ? row.title : patch.title, updatedAt: tick() };
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

async function setup(repo: PiecesRepo = memoryRepo()) {
  const app = await buildApp({ repo, verify });
  const as = (userId: string) => ({ authorization: `Bearer token-${userId}` });
  return { app, as };
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
  const { res } = await syncFrom(ctx, ASHA, id, d, null, { language: "hi" });
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

test("title and language travel with a sync; patch changes the rest and cannot write the words", async () => {
  const ctx = await setup();
  const id = randomUUID();
  const d = device();
  d.write(["The kettle clicks off"]);
  const { known } = await syncFrom(ctx, ASHA, id, d, null, { title: "Kettle" });
  const cleared = await syncFrom(ctx, ASHA, id, d, known, { title: null });
  assert.equal(cleared.body.piece.title, null);

  const patched = await ctx.app.inject({ method: "PATCH", url: `/api/pieces/${id}`, headers: ctx.as(ASHA), payload: { status: "finished", isFragment: true } });
  assert.equal(patched.statusCode, 200);
  assert.equal(patched.json().status, "finished");
  assert.equal(patched.json().text, "The kettle clicks off");

  const words = await ctx.app.inject({ method: "PATCH", url: `/api/pieces/${id}`, headers: ctx.as(ASHA), payload: { content: { type: "doc" } } });
  assert.equal(words.statusCode, 400);
  const empty = await ctx.app.inject({ method: "PATCH", url: `/api/pieces/${id}`, headers: ctx.as(ASHA), payload: {} });
  assert.equal(empty.statusCode, 400);
  const created = await ctx.app.inject({ method: "POST", url: "/api/pieces", headers: ctx.as(ASHA), payload: {} });
  assert.equal(created.statusCode, 404);
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
  const app = await buildApp({ repo: memoryRepo(), verify, docs: true });
  const page = await app.inject({ method: "GET", url: "/docs" });
  assert.ok(page.statusCode === 200 || page.statusCode === 302);
  const spec = await app.inject({ method: "GET", url: "/docs/json" });
  assert.equal(spec.statusCode, 200);
  const doc = spec.json();
  assert.deepEqual(Object.keys(doc.paths).sort(), ["/api/pieces", "/api/pieces/{id}", "/api/pieces/{id}/sync", "/health"]);
  assert.ok(doc.paths["/api/pieces/{id}/sync"].post.requestBody.content["application/json"].schema.properties.stateVector);
});
