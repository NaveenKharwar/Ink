import assert from "node:assert/strict";
import { test } from "node:test";
import { withLiveSession, type VerifyToken } from "./auth.js";

const signed: VerifyToken = async (token) =>
  token === "no-session" ? { userId: "u1" } : { userId: "u1", sessionId: token };

test("a valid token works only while its sign-in session still exists", async () => {
  const live = new Set(["s-open"]);
  const verify = withLiveSession(signed, async (sessionId, userId) => userId === "u1" && live.has(sessionId));
  assert.deepEqual(await verify("s-open"), { userId: "u1", sessionId: "s-open" });
  await assert.rejects(verify("s-signed-out"));
  await assert.rejects(verify("no-session"));
  live.delete("s-open");
  await assert.rejects(verify("s-open"));
});
