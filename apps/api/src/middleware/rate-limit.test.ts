import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import request from "supertest";
import { errorHandler } from "./error-handler";
import { createAuthLimiter } from "./rate-limit";

test("3rd request over a limit of 2 → 429 RATE_LIMITED envelope", async () => {
  const testApp = express();
  testApp.post("/limited", createAuthLimiter({ limit: 2, windowMs: 60_000 }), (_req, res) => {
    res.status(204).end();
  });
  testApp.use(errorHandler);

  assert.equal((await request(testApp).post("/limited")).status, 204);
  assert.equal((await request(testApp).post("/limited")).status, 204);
  const third = await request(testApp).post("/limited");
  assert.equal(third.status, 429);
  assert.deepEqual(third.body, {
    error: { code: "RATE_LIMITED", message: "Too many attempts, try again later" },
  });
});
