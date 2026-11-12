import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { allowedOriginsFor, corsPolicy } from "./cors-policy";

const WEB = "http://web.test";
const ADMIN = "http://admin.test";
const origins = { web: [WEB], admin: [ADMIN] };

test("admin API and admin auth only allow admin origins", () => {
  for (const path of ["/api/admin", "/api/admin/hotels", "/api/auth/admin/login", "/api/auth/admin/me"]) {
    assert.deepEqual(allowedOriginsFor(path, origins), [ADMIN], path);
  }
});

test("customer auth only allows web origins", () => {
  for (const path of ["/api/auth/login", "/api/auth/register", "/api/auth/me", "/api/auth/logout"]) {
    assert.deepEqual(allowedOriginsFor(path, origins), [WEB], path);
  }
});

test("public routes allow both apps", () => {
  for (const path of ["/api/hotels", "/api/health", "/api/nope"]) {
    assert.deepEqual(allowedOriginsFor(path, origins), [WEB, ADMIN], path);
  }
});

test("prefix match respects path segments", () => {
  // "/api/administrator" is not under "/api/admin"; "/api/authx" is not under "/api/auth"
  assert.deepEqual(allowedOriginsFor("/api/administrator", origins), [WEB, ADMIN]);
  assert.deepEqual(allowedOriginsFor("/api/authx", origins), [WEB, ADMIN]);
});

function corsApp() {
  const app = express();
  app.use(corsPolicy(origins));
  app.all(/.*/, (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

test("preflight from web origin to /api/admin is not allowed", async () => {
  const res = await request(corsApp())
    .options("/api/admin/hotels")
    .set("Origin", WEB)
    .set("Access-Control-Request-Method", "POST");
  assert.equal(res.headers["access-control-allow-origin"], undefined);
});

test("preflight from admin origin to /api/admin is allowed with credentials", async () => {
  const res = await request(corsApp())
    .options("/api/admin/hotels")
    .set("Origin", ADMIN)
    .set("Access-Control-Request-Method", "POST");
  assert.equal(res.headers["access-control-allow-origin"], ADMIN);
  assert.equal(res.headers["access-control-allow-credentials"], "true");
});

test("admin origin cannot read customer auth responses", async () => {
  const res = await request(corsApp()).get("/api/auth/me").set("Origin", ADMIN);
  assert.equal(res.headers["access-control-allow-origin"], undefined);
});

test("both origins can read public routes", async () => {
  for (const origin of [WEB, ADMIN]) {
    const res = await request(corsApp()).get("/api/hotels").set("Origin", origin);
    assert.equal(res.headers["access-control-allow-origin"], origin);
  }
});
