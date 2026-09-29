import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { WIDE_MIN_PX } from "./layout.ts";

test("code and CSS switch to desktop at the same width", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const match = /--breakpoint-wide:\s*(\d+)px/.exec(css);
  assert.ok(match, "styles.css defines --breakpoint-wide");
  assert.equal(Number(match[1]), WIDE_MIN_PX);
  // No other breakpoints hiding in the CSS.
  assert.equal(/@media\s*\([^)]*(min|max)-width/.test(css), false);
});
