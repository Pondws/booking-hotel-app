import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { errorHandler } from "./error-handler";
import { notFound } from "./not-found";

const testApp = express();
testApp.use(express.json());
testApp.get("/app-error", () => {
  throw new AppError(403, "FORBIDDEN", "Nope", { why: "x" });
});
testApp.post("/zod", (req) => {
  z.object({ name: z.string() }).parse(req.body);
});
testApp.get("/p2002", () => {
  throw new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "7" });
});
testApp.get("/p2025", () => {
  throw new Prisma.PrismaClientKnownRequestError("missing", { code: "P2025", clientVersion: "7" });
});
testApp.get("/boom", () => {
  throw new Error("secret-db-password");
});
testApp.use(notFound);
testApp.use(errorHandler);

test("AppError keeps its status, code, message and details", async () => {
  const res = await request(testApp).get("/app-error");
  assert.equal(res.status, 403);
  assert.deepEqual(res.body, {
    error: { code: "FORBIDDEN", message: "Nope", details: { why: "x" } },
  });
});

test("ZodError → 400 VALIDATION_FAILED with fieldErrors", async () => {
  const res = await request(testApp).post("/zod").send({});
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_FAILED");
  assert.ok(Array.isArray(res.body.error.details.fieldErrors.name));
});

test("malformed JSON → 400 VALIDATION_FAILED", async () => {
  const res = await request(testApp)
    .post("/zod")
    .set("Content-Type", "application/json")
    .send("{bad");
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_FAILED");
});

test("Prisma P2002 → 409 CONFLICT, P2025 → 404 NOT_FOUND", async () => {
  const dup = await request(testApp).get("/p2002");
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, "CONFLICT");
  const missing = await request(testApp).get("/p2025");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, "NOT_FOUND");
});

test("unknown error → 500 INTERNAL without leaking the message", async (t) => {
  t.mock.method(console, "error", () => {});
  const res = await request(testApp).get("/boom");
  assert.equal(res.status, 500);
  assert.equal(res.body.error.code, "INTERNAL");
  assert.equal(res.body.error.message, "Internal server error");
  assert.ok(!JSON.stringify(res.body).includes("secret-db-password"));
});

test("unknown route → 404 NOT_FOUND", async () => {
  const res = await request(testApp).get("/nope");
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: { code: "NOT_FOUND", message: "Route not found" } });
});
