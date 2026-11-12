import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password";

test("hash has scrypt format with cost params and differs per call", async () => {
  const a = await hashPassword("Password123!");
  const b = await hashPassword("Password123!");
  assert.match(a, /^scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.notEqual(a, b);
});
test("verify accepts the right password and rejects others", async () => {
  const h = await hashPassword("Password123!");
  assert.equal(await verifyPassword("Password123!", h), true);
  assert.equal(await verifyPassword("wrong", h), false);
  assert.equal(await verifyPassword("Password123!", "garbage"), false);
});
test("verify rejects malformed stored values without throwing", async () => {
  const h = await hashPassword("Password123!");
  const [, n, r, p, salt, hash] = h.split("$");
  const cases = [
    `bcrypt$${n}$${r}$${p}$${salt}$${hash}`,
    `scrypt$${n}$${r}$${salt}$${hash}`,
    `scrypt$${n}$${r}$${p}$${salt}$${"z".repeat(128)}`,
    `scrypt$${n}$${r}$${p}$${salt}$${hash.slice(0, 126)}`,
    `scrypt$${n}$${r}$${p}$${salt.slice(0, 31)}$${hash}`,
    `scrypt$1000$${r}$${p}$${salt}$${hash}`,
    `scrypt$0$${r}$${p}$${salt}$${hash}`,
  ];
  for (const c of cases) assert.equal(await verifyPassword("Password123!", c), false, c);
});
test("verify rejects a tampered hash", async () => {
  const h = await hashPassword("Password123!");
  const last = h.slice(-1);
  const tampered = h.slice(0, -1) + (last === "0" ? "1" : "0");
  assert.equal(await verifyPassword("Password123!", tampered), false);
});
