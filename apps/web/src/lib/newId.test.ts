import assert from "node:assert/strict";
import { test } from "node:test";
import { newId } from "./newId.ts";

test("new ids are version 4 UUIDs, as the API expects", () => {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const ids = new Set(Array.from({ length: 200 }, newId));
  for (const id of ids) assert.match(id, uuid);
  assert.equal(ids.size, 200);
});
