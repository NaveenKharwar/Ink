import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type { Piece } from "@ink/schemas";
import { buildApp } from "../app.js";
import type { VerifyToken } from "../auth.js";
import type { PiecesRepo } from "./repo.js";
import { decodeCursor, encodeCursor } from "./routes.js";

const ASHA = "11111111-1111-4111-8111-111111111111";
const RAVI = "22222222-2222-4222-8222-222222222222";

// Tokens in these tests are "token-<userId>".
const verify: VerifyToken = async (token) => {
  if (!token.startsWith("token-")) throw new Error("bad token");
  return { userId: token.slice("token-".length) };
};

function memoryRepo(): PiecesRepo {
  const rows = new Map<string, Piece & { userId: string }>();
  let clock = Date.parse("2026-09-27T10:00:00.000Z");
  const tick = () => new Date((clock += 1000)).toISOString();
  const strip = ({ userId: _userId, ...piece }: Piece & { userId: string }): Piece => piece;
  const summary = ({ content: _content, ...rest }: Piece) => rest;

  return {
    async create(userId, input) {
      const id = input.id ?? randomUUID();
      if (rows.has(id)) return null;
      const now = tick();
      const row = {
        id,
        userId,
        title: input.title || null,
        content: input.content,
        text: input.text,
        status: input.status,
        language: input.language ?? null,
        isFragment: input.isFragment,
        includeInMemory: input.includeInMemory,
        createdAt: now,
        updatedAt: now
      };
      rows.set(id, row);
      return strip(row);
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
      rows.set(id, next as typeof row);
      return strip(next as typeof row);
    }
  };
}

const doc = (...stanzas: string[][]) => ({
  type: "doc",
  content: stanzas.map((lines) => ({
    type: "paragraph",
    content: lines.flatMap((line, i) => (i === 0 ? [{ type: "text", text: line }] : [{ type: "hardBreak" }, { type: "text", text: line }]))
  }))
});

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

test("create stores the editor document and derives plain text", async () => {
  const { app, as } = await setup();
  const res = await app.inject({
    method: "POST",
    url: "/api/pieces",
    headers: as(ASHA),
    payload: { content: doc(["पिता के हाथों में", "लोहे की गंध थी,"], ["और सर्दियों में"]), language: "hi" }
  });
  assert.equal(res.statusCode, 201);
  const piece = res.json();
  assert.equal(piece.text, "पिता के हाथों में\nलोहे की गंध थी,\n\nऔर सर्दियों में");
  assert.equal(piece.status, "draft");
  assert.equal(piece.isFragment, false);
  assert.equal(piece.title, null);
});

test("creating with the same client id again returns the stored piece", async () => {
  const { app, as } = await setup();
  const id = randomUUID();
  const payload = { id, content: doc(["Yaar, aaj phir chai thandi ho gayi."]), language: "hi-Latn", isFragment: true };
  const first = await app.inject({ method: "POST", url: "/api/pieces", headers: as(ASHA), payload });
  const retry = await app.inject({ method: "POST", url: "/api/pieces", headers: as(ASHA), payload });
  assert.equal(first.statusCode, 201);
  assert.equal(retry.statusCode, 200);
  assert.equal(retry.json().id, id);

  const someoneElse = await app.inject({ method: "POST", url: "/api/pieces", headers: as(RAVI), payload });
  assert.equal(someoneElse.statusCode, 409);
});

test("a writer never sees another writer's pieces", async () => {
  const { app, as } = await setup();
  const created = await app.inject({ method: "POST", url: "/api/pieces", headers: as(ASHA), payload: { content: doc(["private"]) } });
  const id = created.json().id;

  const get = await app.inject({ method: "GET", url: `/api/pieces/${id}`, headers: as(RAVI) });
  assert.equal(get.statusCode, 404);
  const patch = await app.inject({ method: "PATCH", url: `/api/pieces/${id}`, headers: as(RAVI), payload: { status: "finished" } });
  assert.equal(patch.statusCode, 404);
  const list = await app.inject({ method: "GET", url: "/api/pieces", headers: as(RAVI) });
  assert.deepEqual(list.json().items, []);
});

test("get returns the full piece; an unknown or malformed id is 404", async () => {
  const { app, as } = await setup();
  const created = await app.inject({ method: "POST", url: "/api/pieces", headers: as(ASHA), payload: { content: doc(["The kettle clicks off"]) } });
  const got = await app.inject({ method: "GET", url: `/api/pieces/${created.json().id}`, headers: as(ASHA) });
  assert.equal(got.statusCode, 200);
  assert.deepEqual(got.json().content, doc(["The kettle clicks off"]));
  assert.equal((await app.inject({ method: "GET", url: `/api/pieces/${randomUUID()}`, headers: as(ASHA) })).statusCode, 404);
  assert.equal((await app.inject({ method: "GET", url: "/api/pieces/not-a-uuid", headers: as(ASHA) })).statusCode, 404);
});

test("patch updates fields, re-derives text from new content, and can clear the title", async () => {
  const { app, as } = await setup();
  const created = await app.inject({
    method: "POST",
    url: "/api/pieces",
    headers: as(ASHA),
    payload: { title: "Kettle", content: doc(["The kettle clicks off"]) }
  });
  const id = created.json().id;

  const res = await app.inject({
    method: "PATCH",
    url: `/api/pieces/${id}`,
    headers: as(ASHA),
    payload: { content: doc(["The kettle clicks off", "and for a second the house"]), status: "finished", title: null }
  });
  assert.equal(res.statusCode, 200);
  const piece = res.json();
  assert.equal(piece.text, "The kettle clicks off\nand for a second the house");
  assert.equal(piece.status, "finished");
  assert.equal(piece.title, null);
  assert.notEqual(piece.updatedAt, created.json().updatedAt);
});

test("invalid input is a 400 with the problems listed", async () => {
  const { app, as } = await setup();
  const noContent = await app.inject({ method: "POST", url: "/api/pieces", headers: as(ASHA), payload: { title: "x" } });
  assert.equal(noContent.statusCode, 400);
  assert.ok(noContent.json().issues.some((issue: { path: string }) => issue.path === "content"));

  const badStatus = await app.inject({ method: "POST", url: "/api/pieces", headers: as(ASHA), payload: { content: doc(["x"]), status: "published" } });
  assert.equal(badStatus.statusCode, 400);

  const created = await app.inject({ method: "POST", url: "/api/pieces", headers: as(ASHA), payload: { content: doc(["x"]) } });
  const empty = await app.inject({ method: "PATCH", url: `/api/pieces/${created.json().id}`, headers: as(ASHA), payload: {} });
  assert.equal(empty.statusCode, 400);
});

test("list is newest first and pages with a cursor", async () => {
  const { app, as } = await setup();
  for (const line of ["one", "two", "three"]) {
    await app.inject({ method: "POST", url: "/api/pieces", headers: as(ASHA), payload: { content: doc([line]) } });
  }
  const first = await app.inject({ method: "GET", url: "/api/pieces?limit=2", headers: as(ASHA) });
  const page1 = first.json();
  assert.deepEqual(page1.items.map((p: Piece) => p.text), ["three", "two"]);
  assert.equal("content" in page1.items[0], false);
  assert.ok(page1.nextCursor);

  const second = await app.inject({ method: "GET", url: `/api/pieces?limit=2&cursor=${page1.nextCursor}`, headers: as(ASHA) });
  const page2 = second.json();
  assert.deepEqual(page2.items.map((p: Piece) => p.text), ["one"]);
  assert.equal(page2.nextCursor, null);

  const badCursor = await app.inject({ method: "GET", url: "/api/pieces?cursor=nonsense", headers: as(ASHA) });
  assert.equal(badCursor.statusCode, 400);
  const badLimit = await app.inject({ method: "GET", url: "/api/pieces?limit=500", headers: as(ASHA) });
  assert.equal(badLimit.statusCode, 400);
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

  const badJson = await app.inject({
    method: "POST",
    url: "/api/pieces",
    headers: { ...as(ASHA), "content-type": "application/json" },
    payload: "{ not json"
  });
  assert.equal(badJson.statusCode, 400);
  assert.deepEqual(badJson.json(), { error: "invalid_request", message: "The request body is not valid JSON." });

  const wrongType = await app.inject({ method: "POST", url: "/api/pieces", headers: { ...as(ASHA), "content-type": "application/xml" }, payload: "<piece/>" });
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
  assert.deepEqual(Object.keys(doc.paths).sort(), ["/api/pieces", "/api/pieces/{id}", "/health"]);
  assert.ok(doc.paths["/api/pieces"].post.requestBody.content["application/json"].schema.properties.content);
});
