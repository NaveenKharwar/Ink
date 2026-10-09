import assert from "node:assert/strict";
import { test } from "node:test";
import { passwordProblemOf } from "./password.ts";

test("a used or old link reads as an expired link", () => {
  assert.equal(passwordProblemOf({ code: "otp_expired", status: 403 }), "link-expired");
});

test("other password problems", () => {
  assert.equal(passwordProblemOf({ code: "same_password", status: 422 }), "same");
  assert.equal(passwordProblemOf({ code: "over_email_send_rate_limit", status: 429 }), "rate-limited");
  assert.equal(passwordProblemOf({ status: 0, name: "AuthRetryableFetchError" }), "offline");
  assert.equal(passwordProblemOf({ status: 500 }), "unknown");
});
