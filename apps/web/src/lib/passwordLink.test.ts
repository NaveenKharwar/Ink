import assert from "node:assert/strict";
import { test } from "node:test";
import { readPasswordLink } from "./passwordLink.ts";

test("a recovery link gives its token", () => {
  assert.equal(readPasswordLink("?token_hash=abc123def456&type=recovery"), "abc123def456");
});

test("anything else is not a password link", () => {
  assert.equal(readPasswordLink(""), null);
  assert.equal(readPasswordLink("?token_hash=abc123def456"), null);
  assert.equal(readPasswordLink("?token_hash=abc123def456&type=email"), null);
  assert.equal(readPasswordLink("?type=recovery"), null);
  assert.equal(readPasswordLink("?token_hash=<script>&type=recovery"), null);
});
