import assert from "node:assert/strict";
import { test } from "node:test";
import { schemeFromStored, systemScheme } from "./theme";

test("a stored scheme is used as it is", () => {
  assert.equal(schemeFromStored("sky", null), "sky");
  assert.equal(schemeFromStored("night", "light"), "night");
});

test("the earlier Light and Dark choices become Moss and Night", () => {
  assert.equal(schemeFromStored(null, "light"), "moss");
  assert.equal(schemeFromStored(null, "dark"), "night");
});

test("anything else follows the device", () => {
  assert.equal(schemeFromStored(null, null), "system");
  assert.equal(schemeFromStored("neon", "purple"), "system");
});

test("following the device gives Moss by day and Night in the dark", () => {
  assert.equal(systemScheme(false), "moss");
  assert.equal(systemScheme(true), "night");
});
