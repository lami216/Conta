import assert from "node:assert/strict";
import test from "node:test";
import { createSession, verifySession } from "../lib/auth.ts";

test("sessions are signed and expire", () => {
  process.env.SESSION_SECRET = "test-session-secret-that-is-longer-than-32-characters";
  const now = Date.now(), token = createSession(now);
  assert.equal(verifySession(token, now), true);
  assert.equal(verifySession(`${token}x`, now), false);
  assert.equal(verifySession(token, now + 13 * 60 * 60 * 1000), false);
});
