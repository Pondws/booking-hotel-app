import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Prisma } from "../generated/prisma/client";
import {
  addBooking,
  cleanupCatalogFixtures,
  createCatalogFixture,
  type CatalogFixture,
} from "../test/catalog-fixtures";
import { prisma } from "./prisma";
import { isExclusionViolation, isUniqueViolationOn } from "./prisma-errors";

const LABEL = "bk-code";
let fx: CatalogFixture;
let overlapErr: unknown;
let duplicateCodeErr: unknown;

before(async () => {
  fx = await createCatalogFixture(LABEL, { roomTypes: [{ capacity: 2, basePrice: 1000, rooms: 1 }] });
  const roomId = fx.roomTypes[0]!.roomIds[0]!;
  const hold = new Date(Date.now() + 10 * 60_000);
  const first = await addBooking(fx, roomId, "2030-03-10", "2030-03-12", "PENDING", hold);
  try {
    await addBooking(fx, roomId, "2030-03-11", "2030-03-13", "PENDING", hold);
  } catch (err) {
    overlapErr = err;
  }
  const later = await addBooking(fx, roomId, "2030-04-10", "2030-04-12", "PENDING", hold);
  try {
    await prisma.booking.update({ where: { id: later.id }, data: { code: first.code } });
  } catch (err) {
    duplicateCodeErr = err;
  }
});
after(() => cleanupCatalogFixtures(LABEL));

test("overlapping PENDING inserts raise an exclusion violation", () => {
  assert.ok(overlapErr, "second insert should throw");
  assert.equal(isExclusionViolation(overlapErr), true);
});
test("exclusion violation is matched only for the named constraint", () => {
  assert.equal(isExclusionViolation(overlapErr, "other_constraint"), false);
  assert.equal(isExclusionViolation(overlapErr, "bookings_no_overlap"), true);
});
test("a duplicate booking code is not an exclusion violation", () => {
  assert.ok(duplicateCodeErr, "duplicate code should throw");
  assert.equal(isUniqueViolationOn(duplicateCodeErr, "code"), true);
  assert.equal(isExclusionViolation(duplicateCodeErr), false);
});
test("a plain Error is not an exclusion violation", () => {
  assert.equal(isExclusionViolation(new Error("x")), false);
});

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
