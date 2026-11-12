import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createBookingSchema,
  createHotelSchema,
  errorCodeSchema,
  loginSchema,
  registerSchema,
  safeNextPath,
} from "@booking/shared";

const base = { roomTypeId: "rt1", checkIn: "2027-01-10", checkOut: "2027-01-13", guests: 2 };

test("booking dates stay as the same calendar day strings", () => {
  const r = createBookingSchema.parse(base);
  assert.equal(r.checkIn, "2027-01-10");
  assert.equal(r.checkOut, "2027-01-13");
});
test("booking rejects zero nights and reversed dates on checkOut", () => {
  for (const checkOut of ["2027-01-10", "2027-01-09"]) {
    const r = createBookingSchema.safeParse({ ...base, checkOut });
    assert.equal(r.success, false);
    assert.deepEqual(r.error?.issues[0]?.path, ["checkOut"]);
  }
});
test("booking rejects non-date strings and guests < 1", () => {
  assert.equal(createBookingSchema.safeParse({ ...base, checkIn: "2027-13-01" }).success, false);
  assert.equal(createBookingSchema.safeParse({ ...base, guests: 0 }).success, false);
});
test("createHotel requires address and no longer accepts rating", () => {
  assert.equal(createHotelSchema.safeParse({ name: "A", city: "B" }).success, false);
  const r = createHotelSchema.parse({ name: "A", city: "B", address: "1 Road", rating: 5 });
  assert.equal("rating" in r, false);
});

test("registerSchema lowercases+trims email, keeps password spaces, rejects password < 8 or > 128", () => {
  const r = registerSchema.parse({ email: "  Foo@Bar.COM ", password: "  pass word  ", name: " Ann " });
  assert.equal(r.email, "foo@bar.com");
  assert.equal(r.password, "  pass word  ");
  assert.equal(r.name, "Ann");
  const base = { email: "a@b.co", name: "A" };
  assert.equal(registerSchema.safeParse({ ...base, password: "1234567" }).success, false);
  assert.equal(registerSchema.safeParse({ ...base, password: "x".repeat(129) }).success, false);
  assert.equal(registerSchema.safeParse({ ...base, password: "x".repeat(128) }).success, true);
});
test("loginSchema lowercases email", () => {
  assert.equal(loginSchema.parse({ email: " A@B.Co ", password: "x" }).email, "a@b.co");
});
test("errorCodeSchema includes RATE_LIMITED", () => {
  assert.equal(errorCodeSchema.safeParse("RATE_LIMITED").success, true);
});
test("safeNextPath", () => {
  assert.equal(safeNextPath("/account"), "/account");
  assert.equal(safeNextPath("//evil.com"), "/");
  assert.equal(safeNextPath("https://evil.com"), "/");
  assert.equal(safeNextPath("/\\evil"), "/");
  assert.equal(safeNextPath(undefined), "/");
  assert.equal(safeNextPath(null), "/");
});
