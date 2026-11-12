import { test } from "node:test";
import assert from "node:assert/strict";
import { generateToken, hashToken } from "./session-token";

test("generateToken → 43-char base64url, unique per call", () => {
  const a = generateToken();
  const b = generateToken();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
});

test("hashToken → deterministic 64-hex, not equal to token", () => {
  const token = generateToken();
  const h = hashToken(token);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(hashToken(token), h);
  assert.notEqual(h, token);
});
