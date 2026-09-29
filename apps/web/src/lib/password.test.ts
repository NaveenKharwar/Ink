import assert from "node:assert/strict";
import { test } from "node:test";
import { passwordProblemOf } from "./password.ts";

test("a wrong, expired or missing email code reads as a wrong code", () => {
  assert.equal(passwordProblemOf({ code: "reauthentication_not_valid", status: 400 }), "wrong-code");
  assert.equal(passwordProblemOf({ code: "reauthentication_needed", status: 400 }), "wrong-code");
});

test("other password problems", () => {
  assert.equal(passwordProblemOf({ code: "same_password", status: 422 }), "same");
  assert.equal(passwordProblemOf({ code: "over_email_send_rate_limit", status: 429 }), "rate-limited");
  assert.equal(passwordProblemOf({ status: 0, name: "AuthRetryableFetchError" }), "offline");
  assert.equal(passwordProblemOf({ status: 500 }), "unknown");
});
