import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "../generated/prisma/client";
import { isUniqueViolationOn } from "./prisma-errors";

const p2002 = (meta: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test", meta });
const adapterMeta = (index: string) => ({
  modelName: "Hotel",
  driverAdapterError: {
    name: "DriverAdapterError",
    cause: { kind: "UniqueConstraintViolation", constraint: { index }, table: "hotels" },
  },
});

test("driver-adapter slug violation is recognised", () => {
  assert.equal(isUniqueViolationOn(p2002(adapterMeta("hotels_slug_key")), "slug"), true);
});

test("classic meta.target shape is recognised", () => {
  assert.equal(isUniqueViolationOn(p2002({ target: ["slug"] }), "slug"), true);
});

test("P2002 on another constraint is not a slug violation", () => {
  assert.equal(isUniqueViolationOn(p2002(adapterMeta("users_email_key")), "slug"), false);
  assert.equal(isUniqueViolationOn(p2002({ target: ["email"] }), "slug"), false);
  assert.equal(isUniqueViolationOn(p2002({}), "slug"), false);
});

test("non-P2002 and non-Prisma errors are not matched", () => {
  const other = new Prisma.PrismaClientKnownRequestError("x", {
    code: "P2025",
    clientVersion: "test",
    meta: adapterMeta("hotels_slug_key"),
  });
  assert.equal(isUniqueViolationOn(other, "slug"), false);
  assert.equal(isUniqueViolationOn(new Error("x"), "slug"), false);
});
