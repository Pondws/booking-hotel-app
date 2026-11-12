import { test } from "node:test";
import assert from "node:assert/strict";
import { createBookingSchema, createHotelSchema } from "@booking/shared";

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
