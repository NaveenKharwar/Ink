import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../app.js";
import type { VerifyToken } from "../auth.js";
import { memoryExportRepo } from "../export/repo.js";
import type { PiecesRepo } from "../pieces/repo.js";
import { memoryPicturesRepo } from "../pictures/repo.js";
import { memoryPictureStore } from "../pictures/store.js";
import { memoryRateLimits } from "../rate-limit.js";
import { memoryRelatedRepo } from "../related/repo.js";
import { memoryMailer, noMailer, type Mailer } from "./mail.js";
import { memoryAccountRepo } from "./repo.js";
import { hashToken } from "./routes.js";

const ASHA = "11111111-1111-4111-8111-111111111111";
const RAVI = "22222222-2222-4222-8222-222222222222";

const verify: VerifyToken = async (token) => {
  if (!token.startsWith("token-")) throw new Error("bad token");
  return { userId: token.slice("token-".length) };
};
const noPieces = {} as PiecesRepo;

async function setup({ mailer = memoryMailer() as Mailer, appUrl = "https://app.example" as string | null } = {}) {
  const repo = memoryAccountRepo({ [ASHA]: "asha@example.com", [RAVI]: "ravi@example.com" });
  const store = memoryPictureStore();
  const deleted: string[] = [];
  const auth = {
    async deleteUser(userId: string) {
      deleted.push(userId);
      repo.deleteUser(userId);
    }
  };
  const exports = memoryExportRepo([
    { userId: ASHA, id: "33333333-3333-4333-8333-333333333333", title: "Asha's", status: "draft", style: "poem", content: { type: "doc" }, cover: null, createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-02T00:00:00.000Z" },
    { userId: RAVI, id: "44444444-4444-4444-8444-444444444444", title: "Ravi's", status: "draft", style: "poem", content: { type: "doc" }, cover: null, createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-02T00:00:00.000Z" }
  ]);
  const app = await buildApp({
    repo: noPieces,
    related: memoryRelatedRepo(noPieces),
    pictures: { store, repo: memoryPicturesRepo() },
    verify,
    limits: memoryRateLimits(),
    account: { repo, auth, pictures: store, mailer, appUrl },
    exports
  });
  const as = (userId: string) => ({ authorization: `Bearer token-${userId}` });
  return { app, as, repo, store, deleted, mailer };
}

const tokenIn = (text: string) => /#t=([A-Za-z0-9_-]{43})/.exec(text)?.[1] ?? "";

test("asking for the link emails the writer's own address and deletes nothing", async () => {
  const { app, as, mailer, deleted } = await setup();
  const res = await app.inject({ method: "POST", url: "/api/account/delete-link", headers: as(ASHA) });
  assert.equal(res.statusCode, 204);
  const sent = (mailer as ReturnType<typeof memoryMailer>).sent;
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.to, "asha@example.com");
  assert.match(sent[0]!.text, /https:\/\/app\.example\/delete-account#t=[A-Za-z0-9_-]{43}/);
  assert.ok(sent[0]!.html.includes(tokenIn(sent[0]!.text)));
  assert.deepEqual(deleted, []);
});

test("the link needs a signed-in writer", async () => {
  const { app } = await setup();
  assert.equal((await app.inject({ method: "POST", url: "/api/account/delete-link" })).statusCode, 401);
});

test("opening the page shows whose account it is; only confirming deletes it, and the link then stops working", async () => {
  const { app, as, mailer, deleted, store } = await setup();
  await store.put(ASHA, "p1", { bytes: Buffer.from([1]), type: "image/jpeg" });
  await store.put(RAVI, "p2", { bytes: Buffer.from([2]), type: "image/jpeg" });
  await app.inject({ method: "POST", url: "/api/account/delete-link", headers: as(ASHA) });
  const sent = (mailer as ReturnType<typeof memoryMailer>).sent;
  const token = tokenIn(sent[0]!.text);

  const check = await app.inject({ method: "POST", url: "/api/account/deletion/check", payload: { token } });
  assert.equal(check.statusCode, 200);
  assert.equal(check.json().email, "asha@example.com");
  assert.deepEqual(deleted, [], "opening the page deletes nothing");

  const confirm = await app.inject({ method: "POST", url: "/api/account/deletion", payload: { token } });
  assert.equal(confirm.statusCode, 204);
  assert.deepEqual(deleted, [ASHA]);
  assert.equal(await store.get(ASHA, "p1"), null, "the writer's pictures are gone");
  assert.ok(await store.get(RAVI, "p2"), "another writer's pictures stay");
  assert.equal(sent[1]!.subject, "Your Ink account is deleted");
  assert.equal(sent[1]!.to, "asha@example.com");

  const again = await app.inject({ method: "POST", url: "/api/account/deletion", payload: { token } });
  assert.equal(again.statusCode, 404);
  assert.equal(again.json().error, "link_expired");
});

test("a new link replaces the earlier one", async () => {
  const { app, as, mailer } = await setup();
  await app.inject({ method: "POST", url: "/api/account/delete-link", headers: as(ASHA) });
  await app.inject({ method: "POST", url: "/api/account/delete-link", headers: as(ASHA) });
  const sent = (mailer as ReturnType<typeof memoryMailer>).sent;
  const [first, second] = [tokenIn(sent[0]!.text), tokenIn(sent[1]!.text)];
  assert.notEqual(first, second);
  assert.equal((await app.inject({ method: "POST", url: "/api/account/deletion/check", payload: { token: first } })).statusCode, 404);
  assert.equal((await app.inject({ method: "POST", url: "/api/account/deletion/check", payload: { token: second } })).statusCode, 200);
});

test("an expired, made-up or malformed link is refused, and deletes nothing", async () => {
  const { app, repo, deleted } = await setup();
  const old = "a".repeat(43);
  await repo.saveDeletion(ASHA, hashToken(old), new Date(Date.now() - 1000));
  for (const token of [old, "b".repeat(43), "short", 42, ""]) {
    const res = await app.inject({ method: "POST", url: "/api/account/deletion", payload: { token } });
    assert.equal(res.statusCode, 404, `token ${String(token)}`);
  }
  assert.equal((await app.inject({ method: "POST", url: "/api/account/deletion", payload: "{}", headers: { "content-type": "application/json" } })).statusCode, 404);
  assert.deepEqual(deleted, []);
});

test("when the pictures can't be deleted, the account stays and the same link works again", async () => {
  const { app, as, mailer, deleted, store } = await setup();
  await app.inject({ method: "POST", url: "/api/account/delete-link", headers: as(ASHA) });
  const token = tokenIn((mailer as ReturnType<typeof memoryMailer>).sent[0]!.text);
  const deleteAll = store.deleteAll;
  store.deleteAll = async () => {
    throw new Error("Storage could not delete the pictures (503)");
  };
  assert.equal((await app.inject({ method: "POST", url: "/api/account/deletion", payload: { token } })).statusCode, 500);
  assert.deepEqual(deleted, []);
  store.deleteAll = deleteAll;
  assert.equal((await app.inject({ method: "POST", url: "/api/account/deletion", payload: { token } })).statusCode, 204);
  assert.deepEqual(deleted, [ASHA]);
});

test("without a way to send email, asking for the link says so and saves nothing that could be used", async () => {
  for (const options of [{ mailer: noMailer }, { appUrl: null }]) {
    const { app, as } = await setup(options);
    const res = await app.inject({ method: "POST", url: "/api/account/delete-link", headers: as(ASHA) });
    assert.equal(res.statusCode, 503);
    assert.equal(res.json().error, "email_unavailable");
  }
});

test("asking for links again and again is stopped", async () => {
  const { app, as } = await setup();
  const codes: number[] = [];
  for (let i = 0; i < 7; i++) codes.push((await app.inject({ method: "POST", url: "/api/account/delete-link", headers: as(RAVI) })).statusCode);
  assert.deepEqual(codes, [204, 204, 204, 204, 204, 429, 429]);
});

test("the export holds only the signed-in writer's pieces", async () => {
  const { app, as } = await setup();
  const res = await app.inject({ method: "GET", url: "/api/export", headers: as(ASHA) });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json().items.map((p: { title: string }) => p.title), ["Asha's"]);
  assert.equal(res.json().nextCursor, null);
  assert.equal((await app.inject({ method: "GET", url: "/api/export" })).statusCode, 401);
  assert.equal((await app.inject({ method: "GET", url: "/api/export?cursor=nonsense", headers: as(ASHA) })).statusCode, 400);
});
