import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import request from "supertest";
import { bookingSchema, hotelReviewListSchema, REVIEW_COMMENT_MAX, type PublicUser } from "@booking/shared";
import { app } from "../app";
import { prisma } from "../lib/prisma";
import {
  addBooking,
  cleanupCatalogFixtures,
  createCatalogFixture,
  createFixtureUser,
  signIn,
  type CatalogFixture,
} from "../test/catalog-fixtures";

const LABEL = "rv-http";

describe("POST /api/bookings/:code/review", () => {
  let fx: CatalogFixture;
  let otherFx: CatalogFixture;
  let alice: PublicUser;
  let bob: PublicUser;
  let aliceCookie = "";
  let bobCookie = "";

  const cookie = (token: string) => `sid=${token}`;
  const post = (code: string, who: string | null, body: object) => {
    const req = request(app).post(`/api/bookings/${code}/review`);
    return (who ? req.set("Cookie", who) : req).send(body);
  };

  // Every stay gets its own past dates (COMPLETED rows don't overlap-check, but keep them distinct anyway).
  let day = 0;
  const completed = async (status: "COMPLETED" | "CONFIRMED" | "CANCELLED" = "COMPLETED", f = fx) => {
    const start = new Date(Date.UTC(2025, 0, 1) + day * 2 * 86_400_000);
    day++;
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const checkOut = new Date(start.getTime() + 86_400_000);
    return addBooking(f, f.roomTypes[0]!.roomIds[0]!, iso(start), iso(checkOut), status, null, alice.id);
  };
  const hotel = (id: string) =>
    prisma.hotel.findUniqueOrThrow({ where: { id }, select: { ratingAvg: true, reviewCount: true } });

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    fx = await createCatalogFixture(LABEL, { roomTypes: [{ capacity: 2, basePrice: 1000, rooms: 1 }] });
    otherFx = await createCatalogFixture(LABEL, { roomTypes: [{ capacity: 2, basePrice: 1000, rooms: 1 }] });
    [alice, bob] = [await createFixtureUser(LABEL), await createFixtureUser(LABEL)];
    aliceCookie = cookie(await signIn(alice.id, "WEB"));
    bobCookie = cookie(await signIn(bob.id, "WEB"));
  });

  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  test("201 for an own COMPLETED booking: review on the booking, hotel avg/count updated", async () => {
    const first = await completed();
    const res = await post(first.code, aliceCookie, { rating: 4, comment: "  Nice  " });
    assert.equal(res.status, 201);
    const b = bookingSchema.parse(res.body.data);
    assert.equal(b.code, first.code);
    assert.equal(b.review?.rating, 4);
    assert.equal(b.review?.comment, "Nice");
    assert.equal(b.reviewable, false);
    assert.deepEqual(await hotel(fx.hotelId), { ratingAvg: 4, reviewCount: 1 });

    const second = await completed();
    assert.equal((await post(second.code, aliceCookie, { rating: 5 })).status, 201);
    assert.deepEqual(await hotel(fx.hotelId), { ratingAvg: 4.5, reviewCount: 2 });
  });

  test("whitespace-only comment is stored as null", async () => {
    const b = await completed("COMPLETED", otherFx);
    const res = await post(b.code, aliceCookie, { rating: 3, comment: "   " });
    assert.equal(res.status, 201);
    assert.equal(bookingSchema.parse(res.body.data).review?.comment, null);
    const row = await prisma.review.findUniqueOrThrow({ where: { bookingId: b.id } });
    assert.equal(row.comment, null);
  });

  test("body hotelId/userId are ignored", async () => {
    const b = await completed();
    const res = await post(b.code, aliceCookie, { rating: 3, hotelId: otherFx.hotelId, userId: bob.id });
    assert.equal(res.status, 201);
    const row = await prisma.review.findUniqueOrThrow({ where: { bookingId: b.id } });
    assert.equal(row.hotelId, fx.hotelId);
    assert.equal(row.userId, alice.id);
  });

  test("hidden reviews are not counted", async () => {
    const h = await createCatalogFixture(LABEL, { roomTypes: [{ capacity: 2, basePrice: 1000, rooms: 1 }] });
    const hidden = await completed("COMPLETED", h);
    await prisma.review.create({
      data: { bookingId: hidden.id, userId: alice.id, hotelId: h.hotelId, rating: 1, isHidden: true, hiddenAt: new Date() },
    });
    const b = await completed("COMPLETED", h);
    assert.equal((await post(b.code, aliceCookie, { rating: 5 })).status, 201);
    assert.deepEqual(await hotel(h.hotelId), { ratingAvg: 5, reviewCount: 1 });
  });

  test("409 CONFLICT for CONFIRMED and CANCELLED bookings; 409 on a second review", async () => {
    for (const status of ["CONFIRMED", "CANCELLED"] as const) {
      const b = await completed(status);
      const res = await post(b.code, aliceCookie, { rating: 4 });
      assert.equal(res.status, 409, status);
      assert.equal(res.body.error.code, "CONFLICT");
    }
    const b = await completed();
    assert.equal((await post(b.code, aliceCookie, { rating: 4 })).status, 201);
    const again = await post(b.code, aliceCookie, { rating: 2 });
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, "CONFLICT");
    assert.equal((await prisma.review.findUniqueOrThrow({ where: { bookingId: b.id } })).rating, 4);
  });

  test("concurrent double submit → one 201 and one 409", async () => {
    const b = await completed();
    const results = await Promise.all([
      post(b.code, aliceCookie, { rating: 5 }),
      post(b.code, aliceCookie, { rating: 1 }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await prisma.review.count({ where: { bookingId: b.id } }), 1);
  });

  test("concurrent reviews of two bookings at one hotel → both 201, both counted", async () => {
    const h = await createCatalogFixture(LABEL, { roomTypes: [{ capacity: 2, basePrice: 1000, rooms: 1 }] });
    const bookings = await Promise.all(Array.from({ length: 4 }, () => completed("COMPLETED", h)));
    const results = await Promise.all(bookings.map((b, i) => post(b.code, aliceCookie, { rating: i + 2 })));
    assert.deepEqual(results.map((r) => r.status), [201, 201, 201, 201]);
    assert.deepEqual(await hotel(h.hotelId), { ratingAvg: 3.5, reviewCount: 4 });
  });

  test("404 for bob on alice's booking; 400 for bad input; 401 without cookie", async () => {
    const b = await completed();
    const other = await post(b.code, bobCookie, { rating: 4 });
    assert.equal(other.status, 404);
    assert.equal(other.body.error.message, "Booking not found");

    for (const body of [{ rating: 0 }, { rating: 6 }, { rating: 2.5 }, { rating: 4, comment: "x".repeat(REVIEW_COMMENT_MAX + 1) }, {}]) {
      const res = await post(b.code, aliceCookie, body);
      assert.equal(res.status, 400, JSON.stringify(body).slice(0, 40));
      assert.equal(res.body.error.code, "VALIDATION_FAILED");
    }

    assert.equal((await post(b.code, null, { rating: 4 })).status, 401);
    assert.equal(await prisma.review.count({ where: { bookingId: b.id } }), 0);
  });
});

describe("GET /api/hotels/:slug/reviews", () => {
  const LIST_LABEL = "rv-list";
  let fx: CatalogFixture;
  let inactive: CatalogFixture;
  const ids: string[] = []; // visible, oldest → newest

  const get = (slug: string, query = "") => request(app).get(`/api/hotels/${slug}/reviews${query}`);

  before(async () => {
    await cleanupCatalogFixtures(LIST_LABEL);
    fx = await createCatalogFixture(LIST_LABEL, { roomTypes: [{ capacity: 2, basePrice: 1000, rooms: 1 }] });
    inactive = await createCatalogFixture(LIST_LABEL, {
      isActive: false,
      roomTypes: [{ capacity: 2, basePrice: 1000, rooms: 1 }],
    });
    const guest = await createFixtureUser(LIST_LABEL);
    const roomId = fx.roomTypes[0]!.roomIds[0]!;
    // 3 visible + 1 hidden (i = 2), createdAt one minute apart so the order is deterministic.
    for (let i = 0; i < 4; i++) {
      const day = (n: number) => `2025-03-${String(n).padStart(2, "0")}`;
      const b = await addBooking(fx, roomId, day(1 + i * 2), day(2 + i * 2), "COMPLETED", null, guest.id);
      const hidden = i === 2;
      const r = await prisma.review.create({
        data: {
          bookingId: b.id,
          userId: guest.id,
          hotelId: fx.hotelId,
          rating: i + 2,
          comment: i === 0 ? null : `Comment ${i}`,
          isHidden: hidden,
          hiddenAt: hidden ? new Date() : null,
          createdAt: new Date(Date.UTC(2025, 3, 1, 0, i)),
        },
      });
      if (!hidden) ids.push(r.id);
    }
  });

  after(async () => {
    await cleanupCatalogFixtures(LIST_LABEL);
    await prisma.$disconnect();
  });

  test("visible reviews newest first, first name only, stayedAt = check-out", async () => {
    const res = await get(fx.slug);
    assert.equal(res.status, 200);
    const list = hotelReviewListSchema.parse(res.body.data);
    assert.deepEqual(
      list.items.map((r) => r.id),
      [...ids].reverse(),
    );
    assert.deepEqual([list.page, list.pageSize, list.total, list.totalPages], [1, 10, 3, 1]);
    const newest = list.items[0]!;
    assert.equal(newest.rating, 5);
    assert.equal(newest.comment, "Comment 3");
    assert.equal(newest.authorName, "Cat");
    assert.equal(newest.stayedAt, "2025-03-08");
    assert.equal(list.items[2]!.comment, null);
    const raw = JSON.stringify(res.body);
    assert.ok(!raw.includes("@test.local"), "no email");
    assert.ok(!raw.includes("Customer"), "no full name");
  });

  test("pagination", async () => {
    const res = await get(fx.slug, "?page=2&pageSize=2");
    assert.equal(res.status, 200);
    const list = hotelReviewListSchema.parse(res.body.data);
    assert.deepEqual(
      list.items.map((r) => r.id),
      [ids[0]],
    );
    assert.deepEqual([list.page, list.pageSize, list.total, list.totalPages], [2, 2, 3, 2]);
  });

  test("404 for unknown and inactive hotels; 400 for a bad page", async () => {
    for (const slug of ["no-such-hotel-xyz", inactive.slug]) {
      const res = await get(slug);
      assert.equal(res.status, 404, slug);
      assert.equal(res.body.error.code, "NOT_FOUND");
    }
    for (const q of ["?page=0", "?pageSize=51", "?page=abc"]) {
      const res = await get(fx.slug, q);
      assert.equal(res.status, 400, q);
      assert.equal(res.body.error.code, "VALIDATION_FAILED");
    }
  });
});
