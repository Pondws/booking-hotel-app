import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import request from "supertest";
import {
  availabilitySchema,
  BOOKING_TZ,
  bookingListSchema,
  bookingSchema,
  todayIn,
  type Booking,
  type PublicUser,
} from "@booking/shared";
import { app } from "../app";
import { env } from "../env";
import { AppError } from "../lib/app-error";
import { fromDbDate, toDbDate } from "../lib/dates";
import { prisma } from "../lib/prisma";
import { cancelMyBooking, createBooking } from "../services/booking.service";
import {
  addBooking,
  addRatePeriod,
  cleanupCatalogFixtures,
  createCatalogFixture,
  createFixtureUser,
  signIn,
  type CatalogFixture,
} from "../test/catalog-fixtures";

const LABEL = "bk-http";
const MIN = 60_000;

describe("bookings API", () => {
  let fx: CatalogFixture;
  let solo = "";
  let pair = "";
  let alice: PublicUser;
  let bob: PublicUser;
  let aliceCookie = "";
  let bobCookie = "";
  let adminOnlyCookie = "";

  const cookie = (token: string, name = "sid") => `${name}=${token}`;
  const stay = (roomTypeId: string, checkIn: string, checkOut: string, guests = 2) => ({
    roomTypeId,
    checkIn,
    checkOut,
    guests,
  });
  const post = (path: string, who: string, data?: object) => {
    const req = request(app).post(path).set("Cookie", who);
    return data ? req.send(data) : req;
  };
  const get = (path: string, who: string) => request(app).get(path).set("Cookie", who);

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    fx = await createCatalogFixture(LABEL, {
      roomTypes: [
        { name: "Solo", capacity: 2, basePrice: 1000, rooms: 1 },
        { name: "Pair", capacity: 2, basePrice: 2000, rooms: 2 },
      ],
    });
    solo = fx.roomTypes[0]!.id;
    pair = fx.roomTypes[1]!.id;
    await addRatePeriod(solo, "2031-01-01", "2032-01-01", 1500);
    [alice, bob] = [await createFixtureUser(LABEL), await createFixtureUser(LABEL)];
    aliceCookie = cookie(await signIn(alice.id, "WEB"));
    bobCookie = cookie(await signIn(bob.id, "WEB"));
    adminOnlyCookie = cookie(await signIn(alice.id, "ADMIN"), "admin_sid");
  });

  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  describe("auth and CORS", () => {
    test("401 without a cookie and with only admin_sid", async () => {
      for (const cookieHeader of [undefined, adminOnlyCookie]) {
        for (const [method, path] of [
          ["post", "/api/bookings"],
          ["get", "/api/bookings/me"],
          ["get", "/api/bookings/BK7QX2MA"],
          ["post", "/api/bookings/BK7QX2MA/cancel"],
        ] as const) {
          const req = request(app)[method](path);
          const res = await (cookieHeader ? req.set("Cookie", cookieHeader) : req);
          assert.equal(res.status, 401, `${method} ${path}`);
          assert.equal(res.body.error.code, "UNAUTHORIZED");
        }
      }
    });

    test("preflight is allowed from a web origin and not from an admin origin", async () => {
      const web = env.WEB_ORIGINS[0]!;
      const admin = env.ADMIN_ORIGINS[0]!;
      const allowed = await request(app)
        .options("/api/bookings")
        .set("Origin", web)
        .set("Access-Control-Request-Method", "POST");
      assert.equal(allowed.headers["access-control-allow-origin"], web);
      const denied = await request(app)
        .options("/api/bookings")
        .set("Origin", admin)
        .set("Access-Control-Request-Method", "POST");
      assert.equal(denied.headers["access-control-allow-origin"], undefined);
    });
  });

  describe("POST /api/bookings", () => {
    test("201 with a booking that parses and never exposes the room number", async () => {
      const res = await post("/api/bookings", aliceCookie, stay(pair, "2031-04-01", "2031-04-03"));
      assert.equal(res.status, 201, JSON.stringify(res.body));
      const booking = bookingSchema.parse(res.body.data);
      assert.equal(booking.status, "PENDING");
      assert.equal(booking.cancellable, true);
      assert.equal(booking.totalAmount, 4000);
      assert.equal(booking.guestEmail, alice.email);
      assert.equal("room" in res.body.data, false);
    });

    test("400 VALIDATION_FAILED for a past date and for 31 nights", async () => {
      for (const [checkIn, checkOut] of [
        ["2020-01-01", "2020-01-03"],
        ["2031-05-01", "2031-06-01"],
      ] as const) {
        const res = await post("/api/bookings", aliceCookie, stay(pair, checkIn, checkOut));
        assert.equal(res.status, 400);
        assert.equal(res.body.error.code, "VALIDATION_FAILED");
      }
    });

    test("404 for an unknown room type", async () => {
      const res = await post("/api/bookings", aliceCookie, stay("nope", "2031-04-01", "2031-04-03"));
      assert.equal(res.status, 404);
      assert.equal(res.body.error.message, "Room type not found");
    });

    test("409 ROOM_UNAVAILABLE once the last room is taken", async () => {
      const first = await post("/api/bookings", aliceCookie, stay(solo, "2031-07-01", "2031-07-03"));
      assert.equal(first.status, 201);
      const second = await post("/api/bookings", bobCookie, stay(solo, "2031-07-02", "2031-07-04"));
      assert.equal(second.status, 409);
      assert.equal(second.body.error.code, "ROOM_UNAVAILABLE");
      assert.equal(second.body.error.message, "This room was just booked for these dates");
    });
  });

  describe("reads", () => {
    let carolCookie = "";
    const codes: string[] = [];
    let stale: Booking;

    before(async () => {
      const carol = await createFixtureUser(LABEL);
      carolCookie = cookie(await signIn(carol.id, "WEB"));
      const now = new Date();
      stale = await createBooking(carol, stay(pair, "2031-08-01", "2031-08-03"), new Date(now.getTime() - 60 * MIN));
      for (const [checkIn, checkOut] of [
        ["2031-08-10", "2031-08-11"],
        ["2031-08-12", "2031-08-13"],
      ] as const) {
        codes.push((await createBooking(carol, stay(pair, checkIn, checkOut), now)).code);
        await new Promise((resolve) => setTimeout(resolve, 5)); // distinct createdAt
      }
    });

    test("GET /me returns only the caller's bookings, newest first, paginated", async () => {
      const all = bookingListSchema.parse((await get("/api/bookings/me", carolCookie)).body.data);
      assert.equal(all.total, 3);
      assert.deepEqual(
        all.items.map((b) => b.code),
        [codes[1], codes[0], stale.code],
      );

      const page2 = bookingListSchema.parse(
        (await get("/api/bookings/me?pageSize=1&page=2", carolCookie)).body.data,
      );
      assert.equal(page2.items.length, 1);
      assert.equal(page2.items[0]!.code, codes[0]);
      assert.equal(page2.totalPages, 3);

      const bobs = bookingListSchema.parse((await get("/api/bookings/me", bobCookie)).body.data);
      assert.ok(bobs.items.every((b) => !all.items.some((a) => a.code === b.code)));
    });

    test("GET /me?page=99 → 200 with no items and the real total", async () => {
      const res = await get("/api/bookings/me?page=99", carolCookie);
      assert.equal(res.status, 200);
      const list = bookingListSchema.parse(res.body.data);
      assert.deepEqual(list.items, []);
      assert.equal(list.total, 3);
    });

    test("a stale hold is read as EXPIRED and not cancellable", async () => {
      const res = await get(`/api/bookings/${stale.code}`, carolCookie);
      assert.equal(res.status, 200);
      const b = bookingSchema.parse(res.body.data);
      assert.equal(b.status, "EXPIRED");
      assert.equal(b.cancellable, false);
    });

    test("GET /:code own → 200, other user's → 404, malformed → 400", async () => {
      const own = await get(`/api/bookings/${codes[0]}`, carolCookie);
      assert.equal(own.status, 200);
      assert.equal(bookingSchema.parse(own.body.data).code, codes[0]);
      assert.equal(own.body.data.hotel.checkInTime, "14:00");
      assert.equal(own.body.data.hotel.checkOutTime, "12:00");

      const other = await get(`/api/bookings/${codes[0]}`, bobCookie);
      assert.equal(other.status, 404);
      assert.equal(other.body.error.message, "Booking not found");

      const unknown = await get("/api/bookings/BKAAAAAA", carolCookie);
      assert.equal(unknown.status, 404);

      const bad = await get("/api/bookings/BKxxxx", carolCookie);
      assert.equal(bad.status, 400);
      assert.equal(bad.body.error.code, "VALIDATION_FAILED");
    });
  });

  describe("POST /api/bookings/:code/cancel", () => {
    const freeSoloRooms = async () => {
      const res = await request(app)
        .get(`/api/hotels/${fx.slug}/availability`)
        .query({ checkIn: "2031-09-01", checkOut: "2031-09-03" });
      const a = availabilitySchema.parse(res.body.data);
      return a.roomTypes.find((r) => r.roomTypeId === solo)?.availableRooms;
    };

    test("cancels an own PENDING hold, frees the room, then 409 on repeat", async () => {
      const created = await post("/api/bookings", aliceCookie, stay(solo, "2031-09-01", "2031-09-03"));
      const code = bookingSchema.parse(created.body.data).code;
      assert.equal(await freeSoloRooms(), 0);

      const res = await post(`/api/bookings/${code}/cancel`, aliceCookie);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const b = bookingSchema.parse(res.body.data);
      assert.equal(b.status, "CANCELLED");
      assert.notEqual(b.cancelledAt, null);
      assert.equal(b.cancellable, false);
      assert.equal(await freeSoloRooms(), 1);

      const again = await post(`/api/bookings/${code}/cancel`, aliceCookie);
      assert.equal(again.status, 409);
      assert.equal(again.body.error.code, "CONFLICT");
      assert.equal(again.body.error.message, "This booking can't be cancelled");
    });

    test("409 for an expired hold, which stays EXPIRED", async () => {
      const stale = await createBooking(alice, stay(pair, "2031-10-01", "2031-10-03"), new Date(Date.now() - 60 * MIN));
      const res = await post(`/api/bookings/${stale.code}/cancel`, aliceCookie);
      assert.equal(res.status, 409);
      assert.equal(res.body.error.message, "This booking can't be cancelled");
      const row = await prisma.booking.findUniqueOrThrow({ where: { code: stale.code } });
      assert.equal(row.status, "EXPIRED");
      assert.equal(row.cancelledAt, null);
    });

    test("409 when check-in is today", async () => {
      const today = todayIn(BOOKING_TZ);
      const tomorrow = fromDbDate(new Date(toDbDate(today).getTime() + 86_400_000));
      const row = await addBooking(fx, fx.roomTypes[1]!.roomIds[0]!, today, tomorrow, "CONFIRMED");
      const code = "BKTDAY22";
      await prisma.booking.update({
        where: { id: row.id },
        data: { userId: alice.id, code },
      });
      const res = await post(`/api/bookings/${code}/cancel`, aliceCookie);
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, "CONFLICT");
    });

    test("404 for another user's booking, which stays untouched", async () => {
      const mine = await createBooking(alice, stay(pair, "2031-11-01", "2031-11-03"));
      const res = await post(`/api/bookings/${mine.code}/cancel`, bobCookie);
      assert.equal(res.status, 404);
      assert.equal(res.body.error.message, "Booking not found");
      const row = await prisma.booking.findUniqueOrThrow({ where: { code: mine.code } });
      assert.equal(row.status, "PENDING");
    });
  });

  describe("cancelMyBooking (service, injected clock)", () => {
    test("Bangkok's calendar day decides: 17:00Z on the 12th is already the 13th", async () => {
      const row = await addBooking(fx, fx.roomTypes[1]!.roomIds[1]!, "2031-12-13", "2031-12-15", "CONFIRMED");
      await prisma.booking.update({ where: { id: row.id }, data: { userId: alice.id } });

      await assert.rejects(
        cancelMyBooking(alice, row.code, new Date("2031-12-12T17:00:00Z")),
        (err: unknown) => err instanceof AppError && err.status === 409 && err.code === "CONFLICT",
      );
      const cancelled = await cancelMyBooking(alice, row.code, new Date("2031-12-12T16:59:00Z"));
      assert.equal(cancelled.status, "CANCELLED");
    });
  });
});
