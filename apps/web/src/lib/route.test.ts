import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRoute, pieceAddress } from "./route";

const ID = "3f0c7a52-8b1e-4d2a-9c3e-5a6b7c8d9e01";

test("the root and anything unknown is a blank page", () => {
  assert.deepEqual(parseRoute("/"), { kind: "new" });
  assert.deepEqual(parseRoute("/whatever"), { kind: "new" });
  assert.deepEqual(parseRoute("/p"), { kind: "new" });
});

test("/p/<id> opens that piece", () => {
  assert.deepEqual(parseRoute(pieceAddress(ID)), { kind: "piece", id: ID });
  assert.deepEqual(parseRoute(`/p/${ID}/`), { kind: "piece", id: ID });
  assert.deepEqual(parseRoute(`/p/${ID.toUpperCase()}`), { kind: "piece", id: ID });
});

test("/p/ with something that is not an id is missing, not a blank page", () => {
  assert.deepEqual(parseRoute("/p/not-an-id"), { kind: "missing" });
  assert.deepEqual(parseRoute(`/p/${ID}/extra`), { kind: "new" });
});

test("/all is All writing", () => {
  assert.deepEqual(parseRoute("/all"), { kind: "all" });
  assert.deepEqual(parseRoute("/all/"), { kind: "all" });
  assert.deepEqual(parseRoute("/allx"), { kind: "new" });
});

test("/profile is the writer's Profile", () => {
  assert.deepEqual(parseRoute("/profile"), { kind: "profile" });
  assert.deepEqual(parseRoute("/profile/"), { kind: "profile" });
  assert.deepEqual(parseRoute("/profiles"), { kind: "new" });
});
