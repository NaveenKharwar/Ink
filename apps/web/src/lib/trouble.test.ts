import assert from "node:assert/strict";
import { test } from "node:test";
import { clearTrouble, currentTrouble, reportTrouble, troubleOf } from "./trouble";

test("a failed request is trouble for the whole app only when it says so", () => {
  assert.equal(troubleOf(401, false), "signed-out");
  assert.equal(troubleOf(401, true), "signed-out");
  assert.equal(troubleOf(null, false), "offline");
  assert.equal(troubleOf(503, false), "broken");
  // Saving keeps the writing on the device, so it never takes the screen over for these.
  assert.equal(troubleOf(null, true), null);
  assert.equal(troubleOf(500, true), null);
  // A 404 or a 400 is about that one request.
  assert.equal(troubleOf(404, false), null);
  assert.equal(troubleOf(400, false), null);
});

test("the worse kind of trouble stays on screen until it is cleared", () => {
  clearTrouble();
  reportTrouble("offline");
  assert.equal(currentTrouble(), "offline");
  reportTrouble("signed-out");
  reportTrouble("broken");
  reportTrouble("offline");
  assert.equal(currentTrouble(), "signed-out");
  clearTrouble();
  assert.equal(currentTrouble(), null);
});
