import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { app } from "./app";

test("GET /api/health → 200 { data: { ok: true, db: true, timestamp } }", async () => {
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.ok, true);
  assert.equal(res.body.data.db, true);
  assert.equal(typeof res.body.data.timestamp, "string");
});

test("GET /api/does-not-exist → 404 NOT_FOUND envelope", async () => {
  const res = await request(app).get("/api/does-not-exist");
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, "NOT_FOUND");
});
