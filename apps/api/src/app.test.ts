import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { app } from "./app";
import { prisma } from "./lib/prisma";

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

test("GET /api/hotels → 200 { data: [...] }, seeded hotels present", async () => {
  const res = await request(app).get("/api/hotels");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.some((h: { slug: string }) => h.slug === "riverside-bangkok"));
});

test("POST /api/admin/hotels with a valid body → 401 UNAUTHORIZED, nothing created", async () => {
  const name = `App Test ${Date.now()}`;
  const res = await request(app).post("/api/admin/hotels").send({
    name,
    city: "Testville",
    address: "1 Test Street",
    description: "Created by a test",
  });
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, {
    error: { code: "UNAUTHORIZED", message: "Authentication required" },
  });
  assert.equal(await prisma.hotel.count({ where: { name } }), 0);
});

test("POST /api/admin/hotels with an invalid body → still 401 (guard runs before validation)", async () => {
  const res = await request(app).post("/api/admin/hotels").send({});
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, "UNAUTHORIZED");
});

test("POST /api/hotels is no longer a route → 404", async () => {
  const res = await request(app).post("/api/hotels").send({});
  assert.equal(res.status, 404);
});
