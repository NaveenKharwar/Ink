import assert from "node:assert/strict";
import { test } from "node:test";
import { isFollowable } from "./link";

test("web pages and email addresses are followed", () => {
  assert.equal(isFollowable("https://withink.app"), true);
  assert.equal(isFollowable("http://example.com/a?b=c"), true);
  assert.equal(isFollowable("mailto:hello@withink.app"), true);
  assert.equal(isFollowable("  HTTPS://Example.com "), true);
});

test("any other address is never followed", () => {
  for (const href of ["javascript:alert(1)", "JavaScript:alert(1)", " javascript:alert(1)", "java\tscript:alert(1)", "data:text/html,<b>hi</b>", "vbscript:x", "file:///etc/passwd", "", "not a link", "//example.com"]) {
    assert.equal(isFollowable(href), false, href);
  }
});
