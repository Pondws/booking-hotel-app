import assert from "node:assert/strict";
import { after, test } from "node:test";
import express from "express";
import request from "supertest";
import { app as realApp } from "../app";
import { hashToken } from "../lib/session-token";
import { prisma } from "../lib/prisma";
import { errorHandler } from "./error-handler";
import { loadSession } from "./load-session";
import { requireHotelAccess } from "./require-hotel-access";

const testApp = express();
testApp.get("/hotels/:hotelId", loadSession("ADMIN"), requireHotelAccess(), (_req, res) => {
  res.json({ data: "ok" });
});
testApp.use(errorHandler);

const tokens: string[] = [];

after(async () => {
  const sessions = await prisma.session.findMany({
    where: { tokenHash: { in: tokens.map(hashToken) } },
    select: { id: true },
  });
  await prisma.session.deleteMany({
    where: { id: { in: sessions.map((s) => s.id) } },
  });
  await prisma.$disconnect();
});

async function login(email: string): Promise<string> {
  const res = await request(realApp)
    .post("/api/auth/admin/login")
    .send({ email, password: "Password123!" });
  assert.equal(res.status, 200);
  const raw: unknown = res.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : [];
  const header = list.find((c): c is string => typeof c === "string" && c.startsWith("admin_sid="));
  assert.ok(header);
  const value = decodeURIComponent(header.slice("admin_sid=".length).split(";")[0] ?? "");
  tokens.push(value);
  return `admin_sid=${encodeURIComponent(value)}`;
}

async function hotelId(slug: string): Promise<string> {
  const hotel = await prisma.hotel.findUniqueOrThrow({
    where: { slug },
    select: { id: true },
  });
  return hotel.id;
}

test("staff → assigned hotel → 200", async () => {
  const cookie = await login("staff@booking.local");
  const res = await request(testApp)
    .get(`/hotels/${await hotelId("riverside-bangkok")}`)
    .set("Cookie", cookie);
  assert.equal(res.status, 200);
});

test("staff → unassigned hotel → 403 No access to this hotel", async () => {
  const cookie = await login("staff@booking.local");
  const res = await request(testApp)
    .get(`/hotels/${await hotelId("old-town-chiang-mai")}`)
    .set("Cookie", cookie);
  assert.equal(res.status, 403);
  assert.equal(res.body.error.message, "No access to this hotel");
});

test("admin → any hotel → 200", async () => {
  const cookie = await login("admin@booking.local");
  const res = await request(testApp)
    .get(`/hotels/${await hotelId("andaman-beach-resort")}`)
    .set("Cookie", cookie);
  assert.equal(res.status, 200);
});

test("no cookie → 401", async () => {
  const res = await request(testApp).get(`/hotels/${await hotelId("riverside-bangkok")}`);
  assert.equal(res.status, 401);
  assert.equal(res.body.error.message, "Authentication required");
});
