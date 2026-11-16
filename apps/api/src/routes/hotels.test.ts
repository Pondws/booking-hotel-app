import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import request from "supertest";
import {
  amenityListSchema,
  availabilitySchema,
  BOOKING_TZ,
  hotelDetailSchema,
  hotelSearchResultSchema,
  todayIn,
  type HotelSummary,
} from "@booking/shared";
import { app } from "../app";
import { prisma } from "../lib/prisma";
import {
  addBooking,
  addRatePeriod,
  cleanupCatalogFixtures,
  createCatalogFixture,
  type CatalogFixture,
} from "../test/catalog-fixtures";

const LABEL = "hotels";
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const TODAY = todayIn(BOOKING_TZ);
const D0 = addDays(TODAY, 400);
const IN = D0;
const OUT = addDays(D0, 4);
const city = `Cat Test City ${Date.now()}`;

describe("GET /api/hotels", () => {
  let A: CatalogFixture;
  let B: CatalogFixture;
  let C: CatalogFixture;

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    A = await createCatalogFixture(LABEL, {
      city,
      roomTypes: [
        { name: "Twin", capacity: 2, basePrice: 1000, rooms: 1 },
        { name: "Family", capacity: 4, basePrice: 3000, rooms: 1 },
        { name: "Retired", capacity: 6, basePrice: 200, rooms: 1, isActive: false },
      ],
    });
    B = await createCatalogFixture(LABEL, {
      city,
      roomTypes: [{ capacity: 2, basePrice: 500, rooms: 1 }],
    });
    C = await createCatalogFixture(LABEL, {
      city,
      isActive: false,
      roomTypes: [{ capacity: 2, basePrice: 100, rooms: 1 }],
    });
    await prisma.hotel.update({ where: { id: A.hotelId }, data: { ratingAvg: 4.5 } });
    await prisma.hotel.update({ where: { id: B.hotelId }, data: { ratingAvg: 4 } });

    // Nights D0+2 and D0+3 of the stay fall in the rate period.
    await addRatePeriod(A.roomTypes[0].id, addDays(D0, 2), addDays(D0, 9), 1500);
    await addBooking(B, B.roomTypes[0].roomIds[0], IN, OUT, "CONFIRMED");

    await prisma.hotelImage.createMany({
      data: [
        { hotelId: A.hotelId, url: "https://img.test/a-2.jpg", alt: "Second", sortOrder: 2 },
        { hotelId: A.hotelId, url: "https://img.test/a-1.jpg", alt: "First", sortOrder: 1 },
      ],
    });
    const wifi = await prisma.amenity.findUniqueOrThrow({ where: { code: "wifi" } });
    const aircon = await prisma.amenity.findUniqueOrThrow({ where: { code: "aircon" } });
    await prisma.hotelAmenity.create({ data: { hotelId: A.hotelId, amenityId: wifi.id } });
    await prisma.roomTypeAmenity.create({
      data: { roomTypeId: A.roomTypes[0].id, amenityId: aircon.id },
    });
  });
  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  const search = async (query: Record<string, string | number>) => {
    const res = await request(app).get("/api/hotels").query(query);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return hotelSearchResultSchema.parse(res.body.data);
  };
  const ids = (items: HotelSummary[]) => items.map((h) => h.id);

  test("filters by city, excludes inactive hotels, orders by rating", async () => {
    const r = await search({ city });
    assert.deepEqual(ids(r.items), [A.hotelId, B.hotelId]);
    assert.equal(r.total, 2);
    assert.equal(r.page, 1);
    assert.equal(r.pageSize, 12);
    assert.equal(r.totalPages, 1);
    const a = r.items[0];
    assert.deepEqual(a.coverImage, { url: "https://img.test/a-1.jpg", alt: "First" });
    assert.equal(a.fromPrice, 1000);
    assert.equal(r.items[1].coverImage, null);
    assert.ok(!ids(r.items).includes(C.hotelId));
  });

  test("city match ignores case and surrounding whitespace", async () => {
    const r = await search({ city: `  ${city.toUpperCase()} ` });
    assert.deepEqual(ids(r.items), [A.hotelId, B.hotelId]);
  });

  test("with dates: fully booked hotel excluded, fromPrice is lowest nightly average", async () => {
    const r = await search({ city, checkIn: IN, checkOut: OUT });
    assert.deepEqual(ids(r.items), [A.hotelId]);
    // Twin: 2×1000 + 2×1500 = 5000 / 4 nights.
    assert.equal(r.items[0].fromPrice, 1250);
  });

  test("guests filter drops small room types and hotels", async () => {
    const r = await search({ city, guests: 3 });
    assert.deepEqual(ids(r.items), [A.hotelId]);
    assert.equal(r.items[0].fromPrice, 3000);
    const dated = await search({ city, checkIn: IN, checkOut: OUT, guests: 3 });
    assert.equal(dated.items[0].fromPrice, 3000);
  });

  test("pagination meta; a page past the end is empty, not an error", async () => {
    const p2 = await search({ city, pageSize: 1, page: 2 });
    assert.deepEqual(ids(p2.items), [B.hotelId]);
    assert.equal(p2.total, 2);
    assert.equal(p2.totalPages, 2);
    const p99 = await search({ city, page: 99 });
    assert.deepEqual(p99.items, []);
    assert.equal(p99.total, 2);
    assert.equal(p99.totalPages, 1);
  });

  test("price range filters on the lowest nightly price (bounds inclusive)", async () => {
    assert.deepEqual(ids((await search({ city, maxPrice: 500 })).items), [B.hotelId]);
    assert.deepEqual(ids((await search({ city, minPrice: 501 })).items), [A.hotelId]);
    assert.deepEqual(ids((await search({ city, minPrice: 500, maxPrice: 1000 })).items), [A.hotelId, B.hotelId]);
    const none = await search({ city, minPrice: 2000 });
    assert.deepEqual(none.items, []);
    assert.equal(none.total, 0);
    // With dates A's price is 1250 (rate period), so 1000 is no longer enough.
    assert.deepEqual(ids((await search({ city, checkIn: IN, checkOut: OUT, maxPrice: 1000 })).items), []);
    assert.deepEqual(ids((await search({ city, checkIn: IN, checkOut: OUT, maxPrice: 1250 })).items), [A.hotelId]);
  });

  test("min price above max price → 400 on maxPrice", async () => {
    const res = await request(app).get("/api/hotels").query({ minPrice: 900, maxPrice: 100 });
    assert.equal(res.status, 400);
    assert.ok(Array.isArray(res.body.error.details.fieldErrors.maxPrice));
  });

  test("minRating and amenities (all required) filter in the DB", async () => {
    assert.deepEqual(ids((await search({ city, minRating: 4.5 })).items), [A.hotelId]);
    assert.deepEqual(ids((await search({ city, minRating: 4 })).items), [A.hotelId, B.hotelId]);
    assert.deepEqual(ids((await search({ city, amenities: "wifi" })).items), [A.hotelId]);
    assert.deepEqual(ids((await search({ city, amenities: " wifi,,wifi " })).items), [A.hotelId]);
    // aircon is only on A's room type, not the hotel → no hotel has wifi AND aircon.
    assert.deepEqual(ids((await search({ city, amenities: "wifi,aircon" })).items), []);
    const bad = await request(app).get("/api/hotels").query({ amenities: "Wi Fi" });
    assert.equal(bad.status, 400);
  });

  test("sort by price both ways, by rating, and paging after a price sort", async () => {
    assert.deepEqual(ids((await search({ city, sort: "price_asc" })).items), [B.hotelId, A.hotelId]);
    assert.deepEqual(ids((await search({ city, sort: "price_desc" })).items), [A.hotelId, B.hotelId]);
    assert.deepEqual(ids((await search({ city, sort: "rating_desc" })).items), [A.hotelId, B.hotelId]);
    const p2 = await search({ city, sort: "price_asc", pageSize: 1, page: 2 });
    assert.deepEqual(ids(p2.items), [A.hotelId]);
    assert.equal(p2.items[0].fromPrice, 1000);
    assert.equal(p2.total, 2);
    assert.equal(p2.totalPages, 2);
    const bad = await request(app).get("/api/hotels").query({ sort: "cheapest" });
    assert.equal(bad.status, 400);
  });

  test("past check-in → 400 VALIDATION_FAILED", async () => {
    const res = await request(app)
      .get("/api/hotels")
      .query({ checkIn: addDays(TODAY, -1), checkOut: TODAY });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_FAILED");
  });

  describe("GET /api/hotels/:slug", () => {
    test("returns the detail shape with sorted images and active room types only", async () => {
      const res = await request(app).get(`/api/hotels/${A.slug}`);
      assert.equal(res.status, 200);
      const h = hotelDetailSchema.parse(res.body.data);
      assert.equal(h.id, A.hotelId);
      assert.equal(h.checkInTime, "14:00");
      assert.equal(h.checkOutTime, "12:00");
      assert.deepEqual(
        h.images.map((i) => i.url),
        ["https://img.test/a-1.jpg", "https://img.test/a-2.jpg"],
      );
      assert.deepEqual(h.amenities, [{ code: "wifi", name: "Wi-Fi" }]);
      assert.deepEqual(
        h.roomTypes.map((rt) => [rt.name, rt.basePrice]),
        [
          ["Twin", 1000],
          ["Family", 3000],
        ],
      );
      assert.deepEqual(h.roomTypes[0].amenities, [{ code: "aircon", name: "Air conditioning" }]);
      assert.equal(typeof h.roomTypes[0].basePrice, "number");
    });

    for (const [what, slug] of [
      ["inactive", () => C.slug],
      ["unknown", () => "nope"],
    ] as const) {
      test(`${what} hotel → 404 Hotel not found`, async () => {
        const res = await request(app).get(`/api/hotels/${slug()}`);
        assert.equal(res.status, 404);
        assert.deepEqual(res.body.error, { code: "NOT_FOUND", message: "Hotel not found" });
      });
    }
  });

  describe("GET /api/hotels/:slug/availability", () => {
    const availability = async (slug: string, query: Record<string, string | number>) => {
      const res = await request(app).get(`/api/hotels/${slug}/availability`).query(query);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      return availabilitySchema.parse(res.body.data);
    };

    test("quotes each room type across the rate period", async () => {
      const a = await availability(A.slug, { checkIn: IN, checkOut: OUT });
      assert.equal(a.nights, 4);
      assert.equal(a.guests, 1);
      assert.deepEqual(
        a.roomTypes.map((r) => r.roomTypeId),
        [A.roomTypes[0].id, A.roomTypes[1].id],
      );
      const twin = a.roomTypes[0];
      assert.equal(twin.available, true);
      assert.equal(twin.availableRooms, 1);
      assert.deepEqual(
        twin.quote.nightly.map((n) => n.price),
        [1000, 1000, 1500, 1500],
      );
      assert.equal(twin.quote.total, 5000);
      assert.equal(a.roomTypes[1].quote.total, 12000);
    });

    test("guests filter drops room types that are too small", async () => {
      const a = await availability(A.slug, { checkIn: IN, checkOut: OUT, guests: 3 });
      assert.deepEqual(
        a.roomTypes.map((r) => r.roomTypeId),
        [A.roomTypes[1].id],
      );
    });

    test("sold-out room type is unavailable", async () => {
      const b = await availability(B.slug, { checkIn: IN, checkOut: OUT });
      assert.equal(b.roomTypes[0].available, false);
      assert.equal(b.roomTypes[0].availableRooms, 0);
    });

    test("missing checkOut → 400", async () => {
      const res = await request(app).get(`/api/hotels/${A.slug}/availability`).query({ checkIn: IN });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, "VALIDATION_FAILED");
    });

    test("inactive hotel → 404", async () => {
      const res = await request(app)
        .get(`/api/hotels/${C.slug}/availability`)
        .query({ checkIn: IN, checkOut: OUT });
      assert.equal(res.status, 404);
    });
  });
});

test("GET /api/amenities → public list of hotel-level amenities only", async () => {
  const res = await request(app).get("/api/amenities");
  assert.equal(res.status, 200);
  const list = amenityListSchema.parse(res.body.data);
  const codes = list.map((a) => a.code);
  assert.ok(codes.includes("wifi"));
  assert.ok(!codes.includes("aircon"), "room-level amenity left out");
  assert.deepEqual(Object.keys(list[0] ?? {}).sort(), ["code", "name"]);
});
