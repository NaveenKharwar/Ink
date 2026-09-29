import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { docToPlainText, fromBase64, toBase64, ydocToEditorDoc } from "@ink/schemas";
import * as Y from "yjs";
import { bufferKey, openBuffer } from "./buffer";
import { openPiece } from "./openPiece";

let n = 0;
const ID = "11111111-1111-4111-8111-111111111111";

function piece(text: string) {
  const ydoc = new Y.Doc();
  const p = new Y.XmlElement("paragraph");
  ydoc.getXmlFragment("default").push([p]);
  const t = new Y.XmlText();
  p.push([t]);
  t.insert(0, text);
  return { ydoc, t };
}
const metaOf = (bytes: Uint8Array) => {
  const d = new Y.Doc();
  Y.applyUpdate(d, bytes);
  return d.getMap("meta").toJSON();
};
const textOf = (bytes: Uint8Array) => {
  const d = new Y.Doc();
  Y.applyUpdate(d, bytes);
  return docToPlainText(ydocToEditorDoc(d));
};

// A server holding one piece; `fail` makes it behave like a dead connection or a 404.
function server(source: string | Y.Doc | null, fail?: "offline" | "404") {
  const text = source;
  const doc = source instanceof Y.Doc ? source : piece(source ?? "").ydoc;
  return {
    sync: async (_id: string, input: { stateVector: string }) => {
      if (fail === "offline") throw new TypeError("offline");
      if (fail === "404" || text === null) throw Object.assign(new Error("nope"), { status: 404 });
      return {
        update: toBase64(Y.encodeStateAsUpdate(doc, fromBase64(input.stateVector))),
        stateVector: toBase64(Y.encodeStateVector(doc)),
        piece: {} as never
      };
    }
  };
}

test("a piece on the server opens with its title and language, which are in the document", async () => {
  const onServer = piece("The kettle clicks off").ydoc;
  onServer.getMap("meta").set("title", "Kettle");
  onServer.getMap("meta").set("language", "hi");
  const r = await openPiece(openBuffer(`open-${n++}`), server(onServer), "u1", ID);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(textOf(r.piece.state), "The kettle clicks off");
  assert.deepEqual(metaOf(r.piece.state), { title: "Kettle", language: "hi" });
  assert.ok(r.piece.serverVector);
});

test("writing still waiting on this device is merged with the server's copy", async () => {
  const buffer = openBuffer(`open-${n++}`);
  const onServer = piece("The kettle clicks off");
  // This device opened the piece earlier, wrote more, and has not sent it.
  const mine = new Y.Doc();
  Y.applyUpdate(mine, Y.encodeStateAsUpdate(onServer.ydoc));
  const t = (mine.getXmlFragment("default").get(0) as Y.XmlElement).get(0) as Y.XmlText;
  t.insert(t.length, " and for a second");
  mine.getMap("meta").set("title", "Mine");
  await buffer.put({
    key: bufferKey("u1", ID), userId: "u1", id: ID, state: Y.encodeStateAsUpdate(mine),
    serverVector: null, updatedAt: 5
  });
  const r = await openPiece(buffer, server(onServer.ydoc), "u1", ID);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(textOf(r.piece.state), "The kettle clicks off and for a second");
  // A rename made here and not yet sent is kept.
  assert.equal(metaOf(r.piece.state).title, "Mine");
});

test("offline, the copy on this device opens the piece", async () => {
  const buffer = openBuffer(`open-${n++}`);
  await buffer.put({
    key: bufferKey("u1", ID), userId: "u1", id: ID, state: Y.encodeStateAsUpdate(piece("only here").ydoc),
    serverVector: null, updatedAt: 1
  });
  const r = await openPiece(buffer, server(null, "offline"), "u1", ID);
  assert.equal(r.status, "ok");
  if (r.status === "ok") assert.equal(textOf(r.piece.state), "only here");
});

test("not on the server and not on this device is missing; offline with nothing here is an error", async () => {
  assert.deepEqual(await openPiece(openBuffer(`open-${n++}`), server(null), "u1", ID), { status: "missing" });
  assert.deepEqual(await openPiece(openBuffer(`open-${n++}`), server("x", "404"), "u1", ID), { status: "missing" });
  assert.deepEqual(await openPiece(openBuffer(`open-${n++}`), server("x", "offline"), "u1", ID), { status: "error" });
});

test("another writer's device copy is never used", async () => {
  const buffer = openBuffer(`open-${n++}`);
  await buffer.put({
    key: bufferKey("u2", ID), userId: "u2", id: ID, state: Y.encodeStateAsUpdate(piece("theirs").ydoc),
    serverVector: null, updatedAt: 1
  });
  assert.deepEqual(await openPiece(buffer, server(null), "u1", ID), { status: "missing" });
});
