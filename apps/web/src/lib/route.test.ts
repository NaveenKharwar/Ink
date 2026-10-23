import assert from "node:assert/strict";
import { test } from "node:test";
import { allAddress, parseAllQuery, parsePictureQuery, parseRoute, pictureAddress, pieceAddress } from "./route";

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

test("/pictures is the writer's Pictures", () => {
  assert.deepEqual(parseRoute("/pictures"), { kind: "pictures" });
  assert.deepEqual(parseRoute("/pictures/"), { kind: "pictures" });
  assert.deepEqual(parseRoute("/pictures/x"), { kind: "new" });
});

test("All writing's narrowing is read from the address", () => {
  assert.deepEqual(parseAllQuery(""), { season: null, filter: null, style: null });
  assert.deepEqual(parseAllQuery("?season=2025-winter"), { season: "2025-Winter", filter: null, style: null });
  assert.deepEqual(parseAllQuery("?season=2026-MONSOON&style=notes"), { season: "2026-Monsoon", filter: null, style: "notes" });
  assert.deepEqual(parseAllQuery("?filter=draft&style=poem"), { season: null, filter: "draft", style: "poem" });
  assert.deepEqual(parseAllQuery("?filter=finished"), { season: null, filter: "finished", style: null });
});

test("a season and Drafts or Finished are never on at once, and anything unknown is left out", () => {
  assert.deepEqual(parseAllQuery("?season=2025-winter&filter=draft"), { season: "2025-Winter", filter: null, style: null });
  assert.deepEqual(parseAllQuery("?season=winter&filter=published&style=essay"), { season: null, filter: null, style: null });
  assert.deepEqual(parseAllQuery("?season=2025-<b>&style=Notes"), { season: null, filter: null, style: null });
});

test("All writing's address holds only what it is narrowed to", () => {
  assert.equal(allAddress(), "/all");
  assert.equal(allAddress({ season: "2025-Winter" }), "/all?season=2025-winter");
  assert.equal(allAddress({ season: "2025-Winter", filter: "draft", style: "notes" }), "/all?season=2025-winter&style=notes");
  assert.equal(allAddress({ filter: "finished", style: "poem" }), "/all?filter=finished&style=poem");
  for (const q of [{ season: "2026-Monsoon", style: "notes" as const }, { filter: "draft" as const }]) {
    assert.deepEqual(parseAllQuery(allAddress(q).replace("/all", "")), { season: null, filter: null, style: null, ...q });
  }
});

test("one open picture is in the Pictures address as ?id=", () => {
  assert.equal(pictureAddress(ID), `/pictures?id=${ID}`);
  assert.equal(parsePictureQuery(`?id=${ID}`), ID);
  assert.equal(parsePictureQuery(`?id=${ID.toUpperCase()}`), ID);
  assert.equal(parsePictureQuery("?id=not-an-id"), null);
  assert.equal(parsePictureQuery(""), null);
});
