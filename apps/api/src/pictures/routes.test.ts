import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { buildApp } from "../app.js";
import type { VerifyToken } from "../auth.js";
import type { PiecesRepo } from "../pieces/repo.js";
import { PICTURE_MAX_BYTES, sniffPicture } from "./routes.js";
import { memoryPicturesRepo, type PictureUse } from "./repo.js";
import { memoryPictureStore } from "./store.js";

const ASHA = "11111111-1111-4111-8111-111111111111";
const RAVI = "22222222-2222-4222-8222-222222222222";

const verify: VerifyToken = async (token) => {
  if (!token.startsWith("token-")) throw new Error("bad token");
  return { userId: token.slice("token-".length) };
};

// Picture routes never touch pieces.
const noPieces = {} as PiecesRepo;

// The first bytes are what count: a JPEG starts FF D8 FF, a WebP "RIFF....WEBP".
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(64, 2)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

async function setup(uses = new Map<string, PictureUse[]>()) {
  const app = await buildApp({ repo: noPieces, pictures: { store: memoryPictureStore(), repo: memoryPicturesRepo(uses) }, verify });
  const as = (userId: string, type = "image/jpeg") => ({ authorization: `Bearer token-${userId}`, "content-type": type });
  return { app, as };
}

test("pictures are recognised by their bytes, not by what the request claims", () => {
  assert.equal(sniffPicture(JPEG), "image/jpeg");
  assert.equal(sniffPicture(WEBP), "image/webp");
  assert.equal(sniffPicture(PNG), null);
  assert.equal(sniffPicture(Buffer.alloc(0)), null);
});

test("every pictures route needs a valid token", async () => {
  const { app } = await setup();
  const id = randomUUID();
  const put = await app.inject({ method: "PUT", url: `/api/pictures/${id}`, headers: { "content-type": "image/jpeg" }, payload: JPEG });
  assert.equal(put.statusCode, 401);
  const get = await app.inject({ method: "GET", url: `/api/pictures/${id}`, headers: { authorization: "Bearer nope" } });
  assert.equal(get.statusCode, 401);
});

test("a writer uploads a picture and reads it back", async () => {
  const { app, as } = await setup();
  const id = randomUUID();
  const put = await app.inject({ method: "PUT", url: `/api/pictures/${id}`, headers: as(ASHA, "image/webp"), payload: WEBP });
  assert.equal(put.statusCode, 204);

  const get = await app.inject({ method: "GET", url: `/api/pictures/${id}`, headers: as(ASHA) });
  assert.equal(get.statusCode, 200);
  assert.equal(get.headers["content-type"], "image/webp");
  assert.match(String(get.headers["cache-control"]), /^private/);
  assert.deepEqual(get.rawPayload, WEBP);

  // A retried upload with the same id simply replaces it.
  const again = await app.inject({ method: "PUT", url: `/api/pictures/${id}`, headers: as(ASHA, "image/webp"), payload: WEBP });
  assert.equal(again.statusCode, 204);
});

test("a writer can neither read nor overwrite another writer's picture", async () => {
  const { app, as } = await setup();
  const id = randomUUID();
  await app.inject({ method: "PUT", url: `/api/pictures/${id}`, headers: as(ASHA), payload: JPEG });

  const peek = await app.inject({ method: "GET", url: `/api/pictures/${id}`, headers: as(RAVI) });
  assert.equal(peek.statusCode, 404);

  // Ravi's upload with the same id lands in Ravi's own folder; Asha's picture is untouched.
  await app.inject({ method: "PUT", url: `/api/pictures/${id}`, headers: as(RAVI, "image/webp"), payload: WEBP });
  const mine = await app.inject({ method: "GET", url: `/api/pictures/${id}`, headers: as(ASHA) });
  assert.deepEqual(mine.rawPayload, JPEG);
});

test("only JPEG and WebP are kept, and never too large", async () => {
  const { app, as } = await setup();
  const id = randomUUID();
  // Claims to be a JPEG, but is a PNG.
  const lying = await app.inject({ method: "PUT", url: `/api/pictures/${id}`, headers: as(ASHA), payload: PNG });
  assert.equal(lying.statusCode, 415);
  const png = await app.inject({ method: "PUT", url: `/api/pictures/${id}`, headers: as(ASHA, "image/png"), payload: PNG });
  assert.equal(png.statusCode, 415);
  const huge = Buffer.concat([JPEG, Buffer.alloc(PICTURE_MAX_BYTES)]);
  const big = await app.inject({ method: "PUT", url: `/api/pictures/${id}`, headers: as(ASHA), payload: huge });
  assert.equal(big.statusCode, 413);
  assert.equal((await app.inject({ method: "GET", url: `/api/pictures/${id}`, headers: as(ASHA) })).statusCode, 404);
});

test("a picture address that isn't an id finds nothing", async () => {
  const { app, as } = await setup();
  const res = await app.inject({ method: "GET", url: "/api/pictures/..%2Fsomeone-else", headers: as(ASHA) });
  assert.equal(res.statusCode, 404);
});

test("the Pictures page lists the writer's own pictures, newest first, with the space they take", async () => {
  const { app, as } = await setup();
  const [a, b, c] = [randomUUID(), randomUUID(), randomUUID()];
  await app.inject({ method: "PUT", url: `/api/pictures/${a}`, headers: as(ASHA), payload: JPEG });
  await app.inject({ method: "PUT", url: `/api/pictures/${b}`, headers: as(ASHA, "image/webp"), payload: WEBP });
  await app.inject({ method: "PUT", url: `/api/pictures/${c}`, headers: as(RAVI), payload: JPEG });

  const list = await app.inject({ method: "GET", url: "/api/pictures", headers: as(ASHA) });
  assert.equal(list.statusCode, 200);
  const body = list.json();
  assert.deepEqual(body.items.map((item: { id: string }) => item.id), [b, a]);
  assert.equal(body.totalBytes, JPEG.length + WEBP.length);
  assert.equal(body.items[0].type, "image/webp");
});

test("deleting a picture removes it for good; another writer can't delete it", async () => {
  const id = randomUUID();
  const piece = randomUUID();
  const uses = new Map([[`${ASHA}/${id}`, [{ id: piece, title: null, text: "\nRain on the tin roof,\nthe whole house" }]]]);
  const { app, as } = await setup(uses);
  await app.inject({ method: "PUT", url: `/api/pictures/${id}`, headers: as(ASHA), payload: JPEG });

  const used = await app.inject({ method: "GET", url: `/api/pictures/${id}/uses`, headers: as(ASHA) });
  assert.deepEqual(used.json(), { items: [{ id: piece, title: null, firstLine: "Rain on the tin roof," }] });
  assert.deepEqual((await app.inject({ method: "GET", url: `/api/pictures/${id}/uses`, headers: as(RAVI) })).json(), { items: [] });

  const theirs = await app.inject({ method: "DELETE", url: `/api/pictures/${id}`, headers: as(RAVI) });
  assert.equal(theirs.statusCode, 404);
  assert.equal((await app.inject({ method: "GET", url: `/api/pictures/${id}`, headers: as(ASHA) })).statusCode, 200);

  const mine = await app.inject({ method: "DELETE", url: `/api/pictures/${id}`, headers: as(ASHA) });
  assert.equal(mine.statusCode, 204);
  assert.equal((await app.inject({ method: "GET", url: `/api/pictures/${id}`, headers: as(ASHA) })).statusCode, 404);
  assert.deepEqual((await app.inject({ method: "GET", url: "/api/pictures", headers: as(ASHA) })).json().items, []);
  assert.equal((await app.inject({ method: "DELETE", url: `/api/pictures/${id}`, headers: as(ASHA) })).statusCode, 404);
});

test("a picture has a small copy for grids and a tiny preview in the list; delete removes both", async () => {
  const { app, as } = await setup();
  const id = randomUUID();
  const preview = "data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=";
  const small = await app.inject({ method: "PUT", url: `/api/pictures/${id}?size=small`, headers: as(ASHA, "image/webp"), payload: WEBP });
  assert.equal(small.statusCode, 204);
  // The small copy alone isn't a picture in the list yet.
  assert.deepEqual((await app.inject({ method: "GET", url: "/api/pictures", headers: as(ASHA) })).json().items, []);

  await app.inject({ method: "PUT", url: `/api/pictures/${id}`, headers: { ...as(ASHA), "ink-picture-preview": preview }, payload: JPEG });
  const list = (await app.inject({ method: "GET", url: "/api/pictures", headers: as(ASHA) })).json();
  assert.equal(list.items[0].preview, preview);
  assert.equal(list.totalBytes, JPEG.length);

  const got = await app.inject({ method: "GET", url: `/api/pictures/${id}?size=small`, headers: as(ASHA) });
  assert.deepEqual(got.rawPayload, WEBP);
  assert.equal((await app.inject({ method: "GET", url: `/api/pictures/${id}?size=small`, headers: as(RAVI) })).statusCode, 404);
  assert.equal((await app.inject({ method: "GET", url: `/api/pictures/${id}?size=huge`, headers: as(ASHA) })).statusCode, 404);

  await app.inject({ method: "DELETE", url: `/api/pictures/${id}`, headers: as(ASHA) });
  assert.equal((await app.inject({ method: "GET", url: `/api/pictures/${id}?size=small`, headers: as(ASHA) })).statusCode, 404);
});

test("a preview that isn't a short picture data URL is ignored", async () => {
  const { app, as } = await setup();
  const put = (id: string, preview: string) =>
    app.inject({ method: "PUT", url: `/api/pictures/${id}`, headers: { ...as(ASHA), "ink-picture-preview": preview }, payload: JPEG });
  await put(randomUUID(), "javascript:alert(1)");
  await put(randomUUID(), `data:image/webp;base64,${"A".repeat(5000)}`);
  const items = (await app.inject({ method: "GET", url: "/api/pictures", headers: as(ASHA) })).json().items;
  assert.deepEqual(items.map((item: { preview: string | null }) => item.preview), [null, null]);
});
