import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { docToPlainText, fromBase64, toBase64, ydocToEditorDoc, type SyncPieceInput } from "@ink/schemas";
import * as Y from "yjs";
import { bufferKey, openBuffer, type Buffer, type BufferedPiece } from "./buffer";
import { createSync, type SyncApi } from "./sync";

let n = 0;
const fresh = () => openBuffer(`test-${n++}`);
const ID = "11111111-1111-4111-8111-111111111111";

// A piece with one stanza, built the way the editor's Yjs binding stores it.
function piece(text = "") {
  const ydoc = new Y.Doc();
  const p = new Y.XmlElement("paragraph");
  ydoc.getXmlFragment("default").push([p]);
  const t = new Y.XmlText();
  p.push([t]);
  if (text) t.insert(0, text);
  return { ydoc, type: t };
}
const textOf = (ydoc: Y.Doc) => docToPlainText(ydocToEditorDoc(ydoc));

function record(userId: string, ydoc: Y.Doc, updatedAt = 1, serverVector: Uint8Array | null = null, id = ID): BufferedPiece {
  return { key: bufferKey(userId, id), userId, id, state: Y.encodeStateAsUpdate(ydoc), serverVector, updatedAt };
}

// A server that merges like the real one, and remembers what it was sent.
function fakeServer(over: Partial<SyncApi> = {}) {
  const doc = new Y.Doc();
  const sent: Array<SyncPieceInput> = [];
  const api: SyncApi = {
    sync: async (_id, input) => {
      sent.push(input);
      if (input.update) Y.applyUpdate(doc, fromBase64(input.update));
      return {
        update: toBase64(Y.encodeStateAsUpdate(doc, fromBase64(input.stateVector))),
        stateVector: toBase64(Y.encodeStateVector(doc)),
        piece: {} as never
      };
    },
    ...over
  };
  return { doc, api, sent };
}

test("a sent piece is removed from the device and the server has the words", async () => {
  const buffer = fresh();
  const server = fakeServer();
  const { ydoc } = piece("hello");
  await buffer.put(record("u1", ydoc));
  const r = await createSync(buffer, server.api).syncPiece(bufferKey("u1", ID));
  assert.equal(r.status, "synced");
  assert.equal(textOf(server.doc), "hello");
  assert.equal(await buffer.get(bufferKey("u1", ID)), undefined);
});

test("a failed send keeps the writing on the device", async () => {
  const buffer = fresh();
  const server = fakeServer({
    sync: async () => {
      throw new TypeError("offline");
    }
  });
  const { ydoc } = piece("hello");
  await buffer.put(record("u1", ydoc));
  assert.equal((await createSync(buffer, server.api).syncPiece(bufferKey("u1", ID))).status, "failed");
  const kept = await buffer.get(bufferKey("u1", ID));
  const copy = new Y.Doc();
  Y.applyUpdate(copy, kept!.state);
  assert.equal(textOf(copy), "hello");
});

test("writing typed while a send is out is sent next, not lost", async () => {
  const buffer = fresh();
  const { ydoc, type } = piece("hello");
  const server = fakeServer();
  let first = true;
  const api: SyncApi = {
    sync: async (id, input) => {
      if (first) {
        first = false;
        type.insert(type.length, " world");
        await buffer.put(record("u1", ydoc, 2));
      }
      return server.api.sync(id, input);
    }
  };
  await buffer.put(record("u1", ydoc, 1));
  const r = await createSync(buffer, api).syncPiece(bufferKey("u1", ID));
  assert.equal(r.status, "synced");
  assert.equal(textOf(server.doc), "hello world");
  assert.equal(await buffer.get(bufferKey("u1", ID)), undefined);
});

test("a second send only carries what is new, and nothing at all when nothing is", async () => {
  const buffer = fresh();
  const server = fakeServer();
  const { ydoc } = piece("hello");
  await buffer.put(record("u1", ydoc, 1));
  const s = createSync(buffer, server.api);
  const first = await s.syncPiece(bufferKey("u1", ID));

  // Same writing, now that the server's vector is known: a fetch with no update.
  await buffer.put(record("u1", ydoc, 2, first.serverVector!));
  await s.syncPiece(bufferKey("u1", ID));
  assert.ok(server.sent[0]!.update);
  assert.equal(server.sent[1]!.update, undefined);
});

test("two devices that wrote apart both end up with everything", async () => {
  const server = fakeServer();
  const laptop = piece("The kettle clicks off");
  const laptopBuffer = fresh();
  await laptopBuffer.put(record("u1", laptop.ydoc));
  const laptopSync = createSync(laptopBuffer, server.api);
  const first = await laptopSync.syncPiece(bufferKey("u1", ID));

  // The phone opens the piece from the server.
  const phone = new Y.Doc();
  Y.applyUpdate(phone, Y.encodeStateAsUpdate(server.doc));
  const phoneType = (phone.getXmlFragment("default").get(0) as Y.XmlElement).get(0) as Y.XmlText;

  // Both write while apart; the laptop's forgotten tab saves last.
  phoneType.insert(0, "Cold. ");
  laptop.type.insert(laptop.type.length, " and for a second");
  const phoneBuffer = fresh();
  await phoneBuffer.put(record("u1", phone, 1, Y.encodeStateVector(server.doc)));
  const phoneResult = await createSync(phoneBuffer, server.api).syncPiece(bufferKey("u1", ID));
  await laptopBuffer.put(record("u1", laptop.ydoc, 2, first.serverVector!));
  const laptopResult = await laptopSync.syncPiece(bufferKey("u1", ID));

  // What each got back is merged into its open page.
  Y.applyUpdate(phone, phoneResult.remote!);
  Y.applyUpdate(laptop.ydoc, laptopResult.remote!);
  assert.equal(textOf(server.doc), textOf(laptop.ydoc));
  assert.ok(textOf(laptop.ydoc).includes("Cold."));
  assert.ok(textOf(laptop.ydoc).includes("and for a second"));
});

test("two callers for one piece share a single request", async () => {
  const buffer = fresh();
  const server = fakeServer();
  await buffer.put(record("u1", piece("hello").ydoc));
  const s = createSync(buffer, server.api);
  const key = bufferKey("u1", ID);
  await Promise.all([s.syncPiece(key), s.syncPiece(key)]);
  assert.equal(server.sent.length, 1);
});

test("one writer never sees or sends another writer's leftovers", async () => {
  const buffer: Buffer = fresh();
  const server = fakeServer();
  const other = "22222222-2222-4222-8222-222222222222";
  await buffer.put(record("u1", piece("mine").ydoc));
  await buffer.put(record("u2", piece("theirs").ydoc, 1, null, other));
  const out = await createSync(buffer, server.api).syncAll("u1");
  assert.deepEqual(out, { synced: 1, failed: 0 });
  assert.equal(textOf(server.doc), "mine");
  assert.equal((await buffer.unsynced("u2")).length, 1);
});

test("a piece the server refuses for good is kept on the device and reported as refused", async () => {
  const buffer = fresh();
  const tooLarge = Object.assign(new Error("too large"), { status: 413 });
  const server = fakeServer({ sync: async () => Promise.reject(tooLarge) });
  const { ydoc } = piece("hello");
  await buffer.put(record("u1", ydoc));
  const r = await createSync(buffer, server.api).syncPiece(bufferKey("u1", ID));
  assert.equal(r.status, "refused");
  assert.ok(await buffer.get(bufferKey("u1", ID)));
});

test("signed out for a moment or rate limited is only a failure, tried again later", async () => {
  for (const status of [401, 429, 503]) {
    const buffer = fresh();
    const err = Object.assign(new Error("later"), { status });
    const server = fakeServer({ sync: async () => Promise.reject(err) });
    const { ydoc } = piece("hello");
    await buffer.put(record("u1", ydoc));
    const r = await createSync(buffer, server.api).syncPiece(bufferKey("u1", ID));
    assert.equal(r.status, "failed", `status ${status}`);
  }
});
