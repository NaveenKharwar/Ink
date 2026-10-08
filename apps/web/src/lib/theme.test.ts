import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SCHEMES, schemeFromStored, systemScheme } from "./theme";

test("a stored scheme is used as it is", () => {
  assert.equal(schemeFromStored("paper", null), "paper");
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

test("following the device gives Paper in light and Night in dark", () => {
  assert.equal(systemScheme(false), "paper");
  assert.equal(systemScheme(true), "night");
});

test("the stylesheet has a colour block for every scheme and keeps the theme mapping", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  for (const s of SCHEMES) assert.match(css, new RegExp(`\\[data-scheme="${s.value}"\\]\\s*[,{]`), s.value);
  assert.match(css, /\[data-scheme="night"\]\s*\{[^}]*--ground: #14120f/);
  assert.match(css, /@theme inline \{/);
  assert.equal(css.split("{").length, css.split("}").length);
});
