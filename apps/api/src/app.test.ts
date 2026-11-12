import assert from "node:assert/strict";
import { after, test } from "node:test";
import express from "express";
import request from "supertest";
import { hashToken } from "./lib/session-token";
import { app } from "./app";
import { env } from "./env";
import { prisma } from "./lib/prisma";

const sessionTokens: string[] = [];

after(async () => {
  await prisma.hotel.deleteMany({
    where: { name: { startsWith: "App Test" } },
  });
  const sessions = await prisma.session.findMany({
    where: { tokenHash: { in: sessionTokens.map(hashToken) } },
    select: { id: true },
  });
  await prisma.session.deleteMany({
    where: { id: { in: sessions.map((s) => s.id) } },
  });
  await prisma.$disconnect();
});

async function adminCookie(email: string): Promise<string> {
  const res = await request(app)
    .post("/api/auth/admin/login")
    .send({ email, password: "Password123!" });
  assert.equal(res.status, 200);
  const raw: unknown = res.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : [];
  const header = list.find((c): c is string => typeof c === "string" && c.startsWith("admin_sid="));
  assert.ok(header);
  const value = decodeURIComponent(header.slice("admin_sid=".length).split(";")[0] ?? "");
  sessionTokens.push(value);
  return `admin_sid=${encodeURIComponent(value)}`;
}

test("GET /api/health → 200 { data: { ok: true, db: true, timestamp } }", async () => {
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.ok, true);
  assert.equal(res.body.data.db, true);
  assert.equal(typeof res.body.data.timestamp, "string");
});

test("GET /api/health with DB down → 503 { data: { ok: true, db: false } }", async (t) => {
  t.mock.property(prisma, "$queryRaw", () => {
    throw new Error("db down");
  });
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 503);
  assert.equal(res.body.data.ok, true);
  assert.equal(res.body.data.db, false);
});

test("GET /api/does-not-exist → 404 NOT_FOUND envelope", async () => {
  const res = await request(app).get("/api/does-not-exist");
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, "NOT_FOUND");
});

test("GET /api/hotels → 200 { data: { items: [...] } }, seeded hotels present", async () => {
  const res = await request(app).get("/api/hotels").query({ city: "Bangkok" });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data.items));
  assert.ok(res.body.data.items.some((h: { slug: string }) => h.slug === "riverside-bangkok"));
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

test("POST /api/admin/hotels as STAFF → 403 Insufficient permissions", async () => {
  const cookie = await adminCookie("staff@booking.local");
  const res = await request(app)
    .post("/api/admin/hotels")
    .set("Cookie", cookie)
    .send({
      name: `App Test ${Date.now()} staff`,
      city: "Testville",
      address: "1 Test Street",
    });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.message, "Insufficient permissions");
});

test("POST /api/admin/hotels as STAFF with an invalid body → 403 (guard before validation)", async () => {
  const cookie = await adminCookie("staff@booking.local");
  const res = await request(app).post("/api/admin/hotels").set("Cookie", cookie).send({});
  assert.equal(res.status, 403);
});

test("POST /api/admin/hotels as ADMIN → 201 with slug", async () => {
  const cookie = await adminCookie("admin@booking.local");
  const res = await request(app)
    .post("/api/admin/hotels")
    .set("Cookie", cookie)
    .send({
      name: `App Test ${Date.now()} admin`,
      city: "Testville",
      address: "1 Test Street",
      description: "Created by a test",
    });
  assert.equal(res.status, 201);
  assert.equal(typeof res.body.data.slug, "string");
});

test("trust proxy defaults to 0 and X-Forwarded-For does not change req.ip", async () => {
  assert.equal(env.TRUST_PROXY, 0);
  assert.equal(app.get("trust proxy"), 0);
  const probe = express();
  probe.set("trust proxy", app.get("trust proxy"));
  probe.get("/ip", (req, res) => {
    res.json({ ip: req.ip });
  });
  const spoofed = "203.0.113.7";
  const res = await request(probe).get("/ip").set("X-Forwarded-For", spoofed);
  assert.equal(res.status, 200);
  assert.notEqual(res.body.ip, spoofed);
});

test("POST /api/hotels is no longer a route → 404", async () => {
  const res = await request(app).post("/api/hotels").send({});
  assert.equal(res.status, 404);
});
