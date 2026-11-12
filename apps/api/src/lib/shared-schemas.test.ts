import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createBookingSchema,
  createHotelSchema,
  errorCodeSchema,
  loginSchema,
  registerSchema,
  safeNextPath,
  BOOKING_TZ,
  MAX_NIGHTS,
  availabilitySchema,
  hotelSearchQuerySchema,
  hotelSearchResultSchema,
  nightsBetween,
  stayRangeSchema,
  todayIn,
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
test("safeNextPath rejects control chars and whitespace that URL parsing strips", () => {
  for (const next of ["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/ /evil.com"]) {
    assert.equal(safeNextPath(next), "/", JSON.stringify(next));
  }
});
test("safeNextPath keeps encoded slashes as a same-origin path", () => {
  const r = safeNextPath("/%2F%2Fevil.com");
  assert.ok(r.startsWith("/"), r);
  assert.ok(!r.startsWith("//"), r);
});
test("safeNextPath rejects dot segments that normalize into a protocol-relative path", () => {
  for (const next of ["/.//evil.com", "/..//evil.com", "/a/..//evil.com"]) {
    assert.equal(safeNextPath(next), "/", next);
  }
});
test("safeNextPath keeps query and hash", () => {
  assert.equal(safeNextPath("/account?tab=1#x"), "/account?tab=1#x");
});

// ---------- Catalog ----------
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const today = todayIn(BOOKING_TZ);

test("todayIn uses the Bangkok calendar date, not UTC", () => {
  assert.equal(todayIn("Asia/Bangkok", new Date("2026-11-12T16:59:59Z")), "2026-11-12");
  assert.equal(todayIn("Asia/Bangkok", new Date("2026-11-12T17:00:00Z")), "2026-11-13");
});
test("nightsBetween counts nights in a half-open range", () => {
  assert.equal(nightsBetween("2027-01-10", "2027-01-13"), 3);
  assert.equal(MAX_NIGHTS, 30);
});

test("stayRangeSchema accepts today → +1 and defaults guests to 1", () => {
  const r = stayRangeSchema.parse({ checkIn: today, checkOut: addDays(today, 1) });
  assert.equal(r.guests, 1);
  assert.equal(r.checkIn, today);
});
test("stayRangeSchema rejects a past check-in on checkIn", () => {
  const r = stayRangeSchema.safeParse({ checkIn: addDays(today, -1), checkOut: addDays(today, 1) });
  assert.equal(r.success, false);
  assert.deepEqual(r.error?.issues[0]?.path, ["checkIn"]);
  assert.equal(r.error?.issues[0]?.message, "Check-in can't be in the past");
});
test("stayRangeSchema allows 30 nights and rejects 31 on checkOut", () => {
  assert.equal(stayRangeSchema.safeParse({ checkIn: today, checkOut: addDays(today, 30) }).success, true);
  const r = stayRangeSchema.safeParse({ checkIn: today, checkOut: addDays(today, 31) });
  assert.equal(r.success, false);
  assert.deepEqual(r.error?.issues[0]?.path, ["checkOut"]);
  assert.equal(r.error?.issues[0]?.message, "Stays are limited to 30 nights");
});
test("stayRangeSchema rejects zero-night stays on checkOut", () => {
  const r = stayRangeSchema.safeParse({ checkIn: today, checkOut: today });
  assert.equal(r.success, false);
  assert.deepEqual(r.error?.issues[0]?.path, ["checkOut"]);
  assert.equal(r.error?.issues[0]?.message, "Check-out must be after check-in");
});

test("hotelSearchQuerySchema defaults page/pageSize and has no city/dates", () => {
  const r = hotelSearchQuerySchema.parse({});
  assert.equal(r.page, 1);
  assert.equal(r.pageSize, 12);
  assert.equal(r.city, undefined);
  assert.equal(r.checkIn, undefined);
  assert.equal(r.checkOut, undefined);
  assert.equal(r.guests, undefined);
});
test("hotelSearchQuerySchema trims city and treats empty city as absent", () => {
  assert.equal(hotelSearchQuerySchema.parse({ city: "  bAnGkOk " }).city, "bAnGkOk");
  assert.equal(hotelSearchQuerySchema.parse({ city: "" }).city, undefined);
});
test("hotelSearchQuerySchema requires both dates", () => {
  const r = hotelSearchQuerySchema.safeParse({ checkIn: today });
  assert.equal(r.success, false);
  assert.deepEqual(r.error?.issues[0]?.path, ["checkOut"]);
  assert.equal(r.error?.issues[0]?.message, "Choose both check-in and check-out");
});
test("hotelSearchQuerySchema applies stay rules when dates are given", () => {
  const r = hotelSearchQuerySchema.safeParse({ checkIn: addDays(today, -1), checkOut: addDays(today, 2) });
  assert.equal(r.success, false);
  assert.deepEqual(r.error?.issues[0]?.path, ["checkIn"]);
});
test("hotelSearchQuerySchema coerces page and caps pageSize at 50", () => {
  assert.equal(hotelSearchQuerySchema.parse({ page: "2" }).page, 2);
  assert.equal(hotelSearchQuerySchema.safeParse({ pageSize: "51" }).success, false);
  assert.equal(hotelSearchQuerySchema.parse({ pageSize: "50" }).pageSize, 50);
});

test("availabilitySchema parses a minimal sample", () => {
  const r = availabilitySchema.parse({
    checkIn: "2027-01-10",
    checkOut: "2027-01-11",
    guests: 2,
    nights: 1,
    roomTypes: [
      {
        roomTypeId: "rt1",
        available: true,
        availableRooms: 2,
        quote: { nights: 1, nightly: [{ date: "2027-01-10", price: 3200 }], total: 3200, currency: "THB" },
      },
    ],
  });
  assert.equal(r.roomTypes[0]?.quote.total, 3200);
});
test("hotelSearchResultSchema parses a minimal page", () => {
  const r = hotelSearchResultSchema.parse({
    items: [
      {
        id: "h1",
        name: "A",
        slug: "a",
        city: "Bangkok",
        currency: "THB",
        ratingAvg: 4.5,
        reviewCount: 3,
        coverImage: { url: "https://x/y.jpg", alt: null },
        fromPrice: null,
      },
    ],
    page: 1,
    pageSize: 12,
    total: 1,
    totalPages: 1,
  });
  assert.equal(r.items[0]?.fromPrice, null);
});
