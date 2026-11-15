import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import request from "supertest";
import {
  BOOKING_TZ,
  adminBookingListSchema,
  adminBookingRoomOptionListSchema,
  adminBookingSchema,
  todayIn,
} from "@booking/shared";
import { app } from "../../app";
import { BookingStatus, Prisma } from "../../generated/prisma/client";
import { generateBookingCode } from "../../lib/booking-code";
import { fromDbDate, toDbDate } from "../../lib/dates";
import { prisma } from "../../lib/prisma";
import {
  assignStaff,
  cleanupCatalogFixtures,
  clearBookings,
  createCatalogFixture,
  createFixtureUser,
  signIn,
  type CatalogFixture,
} from "../../test/catalog-fixtures";

const LABEL = "admin-bookings";

const today = todayIn(BOOKING_TZ);
const day = (offset: number) => {
  const d = toDbDate(today);
  d.setUTCDate(d.getUTCDate() + offset);
  return fromDbDate(d);
};

describe("admin bookings API", () => {
  let mine: CatalogFixture;
  let other: CatalogFixture;
  let staffCookie = "";
  let adminCookie = "";
  let customerAdminCookie = "";
  let webCookie = "";

  type Method = "get" | "post" | "put";
  const send = (method: Method, path: string, body?: object, cookie = staffCookie) => {
    const req = request(app)[method](path).set("Cookie", cookie);
    return body === undefined ? req : req.send(body);
  };
  const url = (code: string, action = "") => `/api/admin/bookings/${code}${action}`;

  /** Standard (index 0) has rooms 101, 102 and inactive 103; Suite (index 1) has room 201. */
  const roomOf = (fx: CatalogFixture, type = 0, n = 0) => fx.roomTypes[type]!.roomIds[n]!;

  const book = (
    fx: CatalogFixture,
    roomId: string,
    checkIn: string,
    checkOut: string,
    status: BookingStatus = "CONFIRMED",
    extra: Partial<Prisma.BookingUncheckedCreateInput> = {},
  ) =>
    prisma.booking.create({
      data: {
        code: generateBookingCode(),
        userId: fx.userId,
        roomId,
        guestName: "Somchai Fixture",
        guestEmail: "somchai@test.local",
        guests: 1,
        checkIn: toDbDate(checkIn),
        checkOut: toDbDate(checkOut),
        status,
        totalAmount: new Prisma.Decimal(3000),
        currency: "THB",
        ...extra,
      },
      select: { id: true, code: true },
    });

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    const spec = [
      { name: "Standard", capacity: 2, basePrice: 1000, rooms: 2, inactiveRooms: 1 },
      { name: "Suite", capacity: 4, basePrice: 5000, rooms: 1 },
    ];
    mine = await createCatalogFixture(LABEL, { roomTypes: spec });
    other = await createCatalogFixture(LABEL, { roomTypes: spec });
    const staff = await createFixtureUser(LABEL, "STAFF");
    const admin = await createFixtureUser(LABEL, "ADMIN");
    const customer = await createFixtureUser(LABEL, "CUSTOMER");
    await assignStaff(staff.id, mine.hotelId);
    staffCookie = `admin_sid=${await signIn(staff.id, "ADMIN")}`;
    adminCookie = `admin_sid=${await signIn(admin.id, "ADMIN")}`;
    customerAdminCookie = `admin_sid=${await signIn(customer.id, "ADMIN")}`;
    webCookie = `sid=${await signIn(staff.id, "WEB")}`;
  });

  beforeEach(async () => {
    await clearBookings(mine);
    await clearBookings(other);
  });

  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  describe("access", () => {
    test("web session → 401, customer → 403", async () => {
      assert.equal((await send("get", "/api/admin/bookings", undefined, webCookie)).status, 401);
      assert.equal((await send("get", "/api/admin/bookings", undefined, customerAdminCookie)).status, 403);
    });

    test("staff list holds only their hotels; another hotel's filter → 403", async () => {
      const own = await book(mine, roomOf(mine), day(1), day(3));
      await book(other, roomOf(other), day(1), day(3));
      const res = await send("get", "/api/admin/bookings");
      assert.equal(res.status, 200);
      const list = adminBookingListSchema.parse(res.body.data);
      assert.deepEqual(
        list.items.map((b) => b.code),
        [own.code],
      );
      assert.equal((await send("get", `/api/admin/bookings?hotelId=${other.hotelId}`)).status, 403);
    });

    test("another hotel's booking → 404 on every endpoint", async () => {
      const b = await book(other, roomOf(other), today, day(2));
      const calls = [
        send("get", url(b.code)),
        send("get", url(b.code, "/rooms")),
        send("post", url(b.code, "/check-in")),
        send("post", url(b.code, "/check-out")),
        send("post", url(b.code, "/cancel"), { reason: "x" }),
        send("put", url(b.code, "/room"), { roomId: roomOf(other, 0, 1) }),
      ];
      for (const res of await Promise.all(calls)) assert.equal(res.status, 404);
      const row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
      assert.equal(row.status, "CONFIRMED");
      assert.equal(row.checkedInAt, null);
    });

    test("admin sees any hotel", async () => {
      const b = await book(other, roomOf(other), day(1), day(3));
      assert.equal((await send("get", url(b.code), undefined, adminCookie)).status, 200);
    });
  });

  describe("list filters", () => {
    const list = async (qs: string) => {
      const res = await send("get", `/api/admin/bookings?hotelId=${mine.hotelId}&${qs}`);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      return adminBookingListSchema.parse(res.body.data).items.map((b) => b.code);
    };

    test("status: lapsed hold is EXPIRED, CHECKED_IN vs CONFIRMED", async () => {
      const lapsed = await book(mine, roomOf(mine), day(5), day(6), "PENDING", {
        expiresAt: new Date(Date.now() - 60_000),
      });
      const hold = await book(mine, roomOf(mine, 0, 1), day(5), day(6), "PENDING", {
        expiresAt: new Date(Date.now() + 600_000),
      });
      const awaiting = await book(mine, roomOf(mine), day(1), day(2));
      const inHouse = await book(mine, roomOf(mine, 1), day(0), day(2), "CONFIRMED", { checkedInAt: new Date() });

      assert.deepEqual(await list("status=PENDING"), [hold.code]);
      assert.deepEqual(await list("status=EXPIRED"), [lapsed.code]);
      assert.deepEqual(await list("status=CONFIRMED"), [awaiting.code]);
      assert.deepEqual(await list("status=CHECKED_IN"), [inHouse.code]);
      assert.equal((await list("status=all")).length, 4);
    });

    test("dates: stays touching [from, to]; ordered by check-in desc", async () => {
      const early = await book(mine, roomOf(mine), day(10), day(12));
      const late = await book(mine, roomOf(mine), day(20), day(22));
      // A stay ending on `from` (check-out morning) doesn't touch the range.
      assert.deepEqual(await list(`from=${day(12)}&to=${day(19)}`), []);
      assert.deepEqual(await list(`from=${day(11)}&to=${day(20)}`), [late.code, early.code]);
      assert.deepEqual(await list(`from=${day(21)}`), [late.code]);
      assert.deepEqual(await list(`to=${day(10)}`), [early.code]);
    });

    test("q matches code, guest name or email (case-insensitive)", async () => {
      const a = await book(mine, roomOf(mine), day(1), day(2), "CONFIRMED", { guestName: "Malee Unique" });
      const b = await book(mine, roomOf(mine), day(3), day(4));
      assert.deepEqual(await list("q=malee"), [a.code]);
      assert.deepEqual(await list(`q=${b.code.toLowerCase()}`), [b.code]);
      assert.equal((await list("q=SOMCHAI@test")).length, 2);
    });

    test("pagination", async () => {
      for (let i = 0; i < 3; i++) await book(mine, roomOf(mine), day(1 + i * 2), day(2 + i * 2));
      const res = await send("get", `/api/admin/bookings?hotelId=${mine.hotelId}&pageSize=2&page=2`);
      const data = adminBookingListSchema.parse(res.body.data);
      assert.equal(data.total, 3);
      assert.equal(data.totalPages, 2);
      assert.equal(data.items.length, 1);
    });
  });

  test("detail shape and flags", async () => {
    const b = await book(mine, roomOf(mine), today, day(2));
    const res = await send("get", url(b.code));
    assert.equal(res.status, 200);
    const d = adminBookingSchema.parse(res.body.data);
    assert.equal(d.room.number, "101");
    assert.equal(d.nights, 2);
    assert.equal(d.hotel.id, mine.hotelId);
    assert.deepEqual([d.canCheckIn, d.canCheckOut, d.canCancel, d.canMoveRoom], [true, false, true, true]);
  });

  test("room options: current, occupied and inactive rooms are not available", async () => {
    const b = await book(mine, roomOf(mine), day(1), day(3));
    const res = await send("get", url(b.code, "/rooms"));
    assert.equal(res.status, 200);
    const free = adminBookingRoomOptionListSchema.parse(res.body.data);
    assert.deepEqual(
      free.map((r) => [r.number, r.current, r.available]),
      [
        ["101", true, false],
        ["102", false, true],
        ["103", false, false],
      ],
    );
    await book(mine, roomOf(mine, 0, 1), day(2), day(4));
    const after = adminBookingRoomOptionListSchema.parse((await send("get", url(b.code, "/rooms"))).body.data);
    assert.equal(after.find((r) => r.number === "102")!.available, false);
  });

  describe("check-in / check-out", () => {
    test("check-in on the check-in day; twice → 409; a future stay → 409", async () => {
      const b = await book(mine, roomOf(mine), today, day(2));
      const res = await send("post", url(b.code, "/check-in"));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const d = adminBookingSchema.parse(res.body.data);
      assert.equal(d.checkedIn, true);
      assert.ok(d.checkedInAt);
      assert.deepEqual([d.canCheckIn, d.canCheckOut, d.canCancel], [false, true, false]);
      assert.equal((await send("post", url(b.code, "/check-in"))).status, 409);

      const future = await book(mine, roomOf(mine, 0, 1), day(1), day(2));
      assert.equal((await send("post", url(future.code, "/check-in"))).status, 409);
    });

    test("an unpaid hold can't be checked in", async () => {
      const b = await book(mine, roomOf(mine), today, day(1), "PENDING", {
        expiresAt: new Date(Date.now() + 600_000),
      });
      assert.equal((await send("post", url(b.code, "/check-in"))).status, 409);
    });

    test("check-out needs check-in, then COMPLETED and the remaining nights are free", async () => {
      const b = await book(mine, roomOf(mine), today, day(3));
      assert.equal((await send("post", url(b.code, "/check-out"))).status, 409);
      await send("post", url(b.code, "/check-in"));
      const res = await send("post", url(b.code, "/check-out"));
      assert.equal(res.status, 200);
      const d = adminBookingSchema.parse(res.body.data);
      assert.equal(d.status, "COMPLETED");
      assert.ok(d.checkedOutAt);
      assert.deepEqual([d.canCheckOut, d.canCancel, d.canMoveRoom], [false, false, false]);
      // Early check-out frees the room: the exclusion constraint accepts a new stay on it.
      await book(mine, roomOf(mine), day(1), day(3));
    });
  });

  describe("cancel", () => {
    test("needs a reason", async () => {
      const b = await book(mine, roomOf(mine), day(1), day(2));
      assert.equal((await send("post", url(b.code, "/cancel"), { reason: "  " })).status, 400);
      assert.equal((await send("post", url(b.code, "/cancel"), {})).status, 400);
    });

    test("a paid booking is cancelled with the reason and refunded in full", async () => {
      const b = await book(mine, roomOf(mine), day(1), day(2));
      await prisma.payment.create({
        data: {
          bookingId: b.id,
          amount: new Prisma.Decimal(3000),
          currency: "THB",
          status: "SUCCEEDED",
          provider: "mock",
          providerRef: `mock_pi_admin_bookings_${b.code}`,
          paidAt: new Date(),
        },
      });
      const res = await send("post", url(b.code, "/cancel"), { reason: "Guest called the front desk" });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const d = adminBookingSchema.parse(res.body.data);
      assert.equal(d.status, "CANCELLED");
      assert.equal(d.cancelReason, "Guest called the front desk");
      assert.equal(d.payment?.status, "REFUNDED");
      assert.ok(d.payment?.refundedAt);
    });

    test("a no-show (past check-in day, not checked in) can be cancelled", async () => {
      const b = await book(mine, roomOf(mine), day(-2), day(1));
      assert.equal((await send("post", url(b.code, "/cancel"), { reason: "No-show" })).status, 200);
    });

    test("checked-in, already cancelled or lapsed → 409", async () => {
      const inHouse = await book(mine, roomOf(mine), today, day(2), "CONFIRMED", { checkedInAt: new Date() });
      const lapsed = await book(mine, roomOf(mine, 0, 1), day(3), day(4), "PENDING", {
        expiresAt: new Date(Date.now() - 60_000),
      });
      const done = await book(mine, roomOf(mine, 1), day(3), day(4), "CANCELLED");
      for (const code of [inHouse.code, lapsed.code, done.code]) {
        assert.equal((await send("post", url(code, "/cancel"), { reason: "x" })).status, 409, code);
      }
    });
  });

  describe("move room", () => {
    test("to a free room of the same type", async () => {
      const b = await book(mine, roomOf(mine), today, day(2), "CONFIRMED", { checkedInAt: new Date() });
      const res = await send("put", url(b.code, "/room"), { roomId: roomOf(mine, 0, 1) });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(adminBookingSchema.parse(res.body.data).room.number, "102");
    });

    test("occupied, inactive or current room → 409 ROOM_UNAVAILABLE; booking unchanged", async () => {
      const b = await book(mine, roomOf(mine), day(1), day(4));
      await book(mine, roomOf(mine, 0, 1), day(3), day(5));
      const targets = [roomOf(mine, 0, 1), mine.roomTypes[0]!.inactiveRoomIds[0]!, roomOf(mine)];
      for (const roomId of targets) {
        const res = await send("put", url(b.code, "/room"), { roomId });
        assert.equal(res.status, 409);
        assert.equal(res.body.error.code, "ROOM_UNAVAILABLE");
      }
      const row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
      assert.equal(row.roomId, roomOf(mine));
    });

    test("a lapsed hold on the target doesn't block the move", async () => {
      const b = await book(mine, roomOf(mine), day(1), day(3));
      await book(mine, roomOf(mine, 0, 1), day(1), day(3), "PENDING", { expiresAt: new Date(Date.now() - 60_000) });
      assert.equal((await send("put", url(b.code, "/room"), { roomId: roomOf(mine, 0, 1) })).status, 200);
    });

    test("a room of another room type → 404", async () => {
      const b = await book(mine, roomOf(mine), day(1), day(3));
      assert.equal((await send("put", url(b.code, "/room"), { roomId: roomOf(mine, 1) })).status, 404);
      assert.equal((await send("put", url(b.code, "/room"), { roomId: roomOf(other) })).status, 404);
    });

    test("completed or cancelled bookings can't move", async () => {
      const b = await book(mine, roomOf(mine), day(1), day(3), "CANCELLED");
      assert.equal((await send("put", url(b.code, "/room"), { roomId: roomOf(mine, 0, 1) })).status, 409);
    });
  });
});
