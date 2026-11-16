import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import request from "supertest";
import { errorHandler } from "./error-handler";
import { createAccountLimiter, createAuthLimiter } from "./rate-limit";

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

test("account limiter: failed logins counted per normalized email; successes and other emails pass", async () => {
  const testApp = express();
  testApp.use(express.json());
  testApp.post("/login", createAccountLimiter({ limit: 2, windowMs: 60_000 }), (req, res) => {
    res.status(req.body.password === "right" ? 200 : 401).end();
  });
  testApp.use(errorHandler);
  const login = (email: unknown, password = "wrong") => request(testApp).post("/login").send({ email, password });

  assert.equal((await login("a@x.com", "right")).status, 200);
  assert.equal((await login("a@x.com")).status, 401);
  assert.equal((await login("A@X.com")).status, 401);
  const locked = await login("  A@x.COM ", "right");
  assert.equal(locked.status, 429);
  assert.equal(locked.body.error.code, "RATE_LIMITED");
  assert.equal((await login("b@x.com")).status, 401);
  // No email string → left to validation (and the per-IP limiter).
  assert.equal((await login(42)).status, 401);
  assert.equal((await login(42)).status, 401);
  assert.equal((await login(42)).status, 401);
});
