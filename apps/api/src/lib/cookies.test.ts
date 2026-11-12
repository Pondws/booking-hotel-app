import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";
import { COOKIE, SESSION_TTL_MS, readCookie } from "./cookies";

const reqWith = (cookie?: string): Pick<Request, "headers"> => ({
  headers: cookie === undefined ? {} : { cookie },
});

test("readCookie: missing header → undefined; picks named cookie among several; decodes %-encoding", () => {
  assert.equal(readCookie(reqWith(), "sid"), undefined);
  assert.equal(readCookie(reqWith("a=1; sid=abc; b=2"), "sid"), "abc");
  assert.equal(readCookie(reqWith("a=1; b=2"), "sid"), undefined);
  assert.equal(readCookie(reqWith("sid=a%20b%2Fc"), "sid"), "a b/c");
});

test("cookie names and TTLs", () => {
  assert.deepEqual(COOKIE, { WEB: "sid", ADMIN: "admin_sid" });
  assert.equal(SESSION_TTL_MS.WEB, 30 * 24 * 60 * 60 * 1000);
  assert.equal(SESSION_TTL_MS.ADMIN, 12 * 60 * 60 * 1000);
});
