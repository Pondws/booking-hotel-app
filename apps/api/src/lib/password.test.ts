import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password";

test("hash has scrypt format and differs per call", async () => {
  const a = await hashPassword("Password123!");
  const b = await hashPassword("Password123!");
  assert.match(a, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.notEqual(a, b);
});
test("verify accepts the right password and rejects others", async () => {
  const h = await hashPassword("Password123!");
  assert.equal(await verifyPassword("Password123!", h), true);
  assert.equal(await verifyPassword("wrong", h), false);
  assert.equal(await verifyPassword("Password123!", "garbage"), false);
});
