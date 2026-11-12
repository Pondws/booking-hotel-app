import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import {
  BOOKING_CODE_PATTERN,
  HOLD_MINUTES,
  bookingSchema,
  type CreateBookingData,
  type PublicUser,
} from "@booking/shared";
import { AppError } from "../lib/app-error";
import { generateBookingCode } from "../lib/booking-code";
import { prisma } from "../lib/prisma";
import {
  addBooking,
  addRatePeriod,
  cleanupCatalogFixtures,
  clearBookings,
  createCatalogFixture,
  createFixtureUser,
  type CatalogFixture,
} from "../test/catalog-fixtures";
import { blockingBookingWhere } from "./availability.service";
import { createBooking } from "./booking.service";
import { quoteStay } from "./pricing.service";

const LABEL = "bk-svc";
const MIN = 60_000;

const isAppError = (code: string, status?: number) => (err: unknown) =>
  err instanceof AppError && err.code === code && (status === undefined || err.status === status);

const roomIdOf = async (code: string) =>
  (await prisma.booking.findUniqueOrThrow({ where: { code }, select: { roomId: true } })).roomId;

describe("createBooking", () => {
  let fx: CatalogFixture;
  let inactiveHotel: CatalogFixture;
  let user: PublicUser;
  let [single, pair, retired] = ["", "", ""];
  let singleRoom = "";

  const stay = (
    roomTypeId: string,
    checkIn: string,
    checkOut: string,
    extra: Partial<CreateBookingData> = {},
  ): CreateBookingData => ({ roomTypeId, checkIn, checkOut, guests: 2, ...extra });

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    fx = await createCatalogFixture(LABEL, {
      roomTypes: [
        { name: "Single", capacity: 2, basePrice: 3200, rooms: 1, inactiveRooms: 1 },
        { name: "Pair", capacity: 2, basePrice: 1000, rooms: 2 },
        { name: "Retired", capacity: 2, basePrice: 900, rooms: 1, isActive: false },
      ],
    });
    [single, pair, retired] = fx.roomTypes.map((r) => r.id);
    singleRoom = fx.roomTypes[0]!.roomIds[0]!;
    await addRatePeriod(single, "2030-05-11", "2030-05-12", 4500);
    inactiveHotel = await createCatalogFixture(LABEL, {
      isActive: false,
      roomTypes: [{ capacity: 2, basePrice: 1000, rooms: 1 }],
    });
    user = await createFixtureUser(LABEL);
  });
  beforeEach(() => clearBookings(fx));
  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  test("createBooking creates a PENDING hold priced by quoteStay with guest defaults", async () => {
    const now = new Date();
    const booking = await createBooking(user, stay(single, "2030-05-10", "2030-05-13"), now);

    assert.equal(booking.status, "PENDING");
    assert.match(booking.code, BOOKING_CODE_PATTERN);
    assert.ok(booking.expiresAt);
    assert.equal(new Date(booking.expiresAt).getTime(), now.getTime() + HOLD_MINUTES * MIN);
    assert.equal(new Date(booking.expiresAt).getTime(), now.getTime() + 15 * 60_000);
    const quote = await quoteStay(single, "2030-05-10", "2030-05-13");
    assert.equal(booking.totalAmount, quote.total);
    assert.equal(booking.totalAmount, 3200 + 4500 + 3200);
    assert.equal(booking.currency, quote.currency);
    assert.equal(booking.guestName, user.name);
    assert.equal(booking.guestEmail, user.email);
    assert.equal(booking.guestPhone, null);
    assert.equal(booking.nights, 3);
    assert.equal(booking.checkIn, "2030-05-10");
    assert.equal(booking.checkOut, "2030-05-13");
    assert.equal(booking.cancellable, true);
    assert.equal(booking.cancelledAt, null);
    assert.deepEqual(booking.roomType, { id: single, name: "Single" });
    assert.equal(booking.hotel.slug, fx.slug);
    assert.equal(booking.hotel.name, fx.name);
    assert.equal(booking.hotel.coverImage, null);
    assert.equal("room" in booking, false);
    assert.doesNotThrow(() => bookingSchema.parse(booking));
    assert.equal(await roomIdOf(booking.code), singleRoom);
  });

  test("createBooking keeps explicit guest fields", async () => {
    const booking = await createBooking(
      user,
      stay(single, "2030-05-10", "2030-05-12", {
        guestName: "Ann Guest",
        guestEmail: "ann@guest.test",
        guestPhone: "+66 81 234 5678",
      }),
    );
    assert.equal(booking.guestName, "Ann Guest");
    assert.equal(booking.guestEmail, "ann@guest.test");
    assert.equal(booking.guestPhone, "+66 81 234 5678");
  });

  test("createBooking expires a stale hold on the only room and takes that room", async () => {
    const now = new Date();
    const stale = await addBooking(fx, singleRoom, "2030-05-10", "2030-05-12", "PENDING", new Date(now.getTime() - MIN));
    const booking = await createBooking(user, stay(single, "2030-05-10", "2030-05-12"), now);

    assert.equal(await roomIdOf(booking.code), singleRoom);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: stale.id }, select: { status: true } });
    assert.equal(after.status, "EXPIRED");
  });

  test("createBooking allows a back-to-back stay on the only room", async () => {
    await addBooking(fx, singleRoom, "2030-05-10", "2030-05-12", "PENDING", new Date(Date.now() + 10 * MIN));
    const booking = await createBooking(user, stay(single, "2030-05-12", "2030-05-14"));
    assert.equal(await roomIdOf(booking.code), singleRoom);
  });

  test("createBooking rejects guests over capacity with a guests field error", async () => {
    await assert.rejects(createBooking(user, stay(single, "2030-05-10", "2030-05-12", { guests: 3 })), (err) => {
      assert.ok(err instanceof AppError);
      assert.equal(err.status, 400);
      assert.equal(err.code, "VALIDATION_FAILED");
      assert.deepEqual(err.details, { formErrors: [], fieldErrors: { guests: ["This room sleeps 2 guests"] } });
      return true;
    });
  });

  test("createBooking 404s an inactive room type or inactive hotel", async () => {
    for (const roomTypeId of [retired, inactiveHotel.roomTypes[0]!.id, "missing-room-type"]) {
      await assert.rejects(createBooking(user, stay(roomTypeId, "2030-05-10", "2030-05-12")), (err) => {
        assert.ok(isAppError("NOT_FOUND", 404)(err));
        assert.equal((err as AppError).message, "Room type not found");
        return true;
      });
    }
  });

  test("createBooking rejects a 4th active hold with CONFLICT", async () => {
    const capped = await createFixtureUser(LABEL);
    const now = new Date();
    await createBooking(capped, stay(single, "2030-06-01", "2030-06-02"), now);
    await createBooking(capped, stay(single, "2030-06-03", "2030-06-04"), now);
    await createBooking(capped, stay(single, "2030-06-05", "2030-06-06"), now);
    await assert.rejects(createBooking(capped, stay(single, "2030-06-07", "2030-06-08"), now), (err) => {
      assert.ok(isAppError("CONFLICT", 409)(err));
      assert.equal((err as AppError).message, "You have 3 bookings waiting for payment");
      return true;
    });
  });

  test("createBooking ignores expired holds when counting the cap", async () => {
    const lapsed = await createFixtureUser(LABEL);
    const now = new Date();
    // Created 16 minutes ago → expiresAt = now − 1 min.
    const earlier = new Date(now.getTime() - (HOLD_MINUTES + 1) * MIN);
    for (const [checkIn, checkOut] of [
      ["2030-07-01", "2030-07-02"],
      ["2030-07-03", "2030-07-04"],
      ["2030-07-05", "2030-07-06"],
    ] as const) {
      const old = await createBooking(lapsed, stay(single, checkIn, checkOut), earlier);
      assert.equal(new Date(old.expiresAt!).getTime(), now.getTime() - MIN);
    }
    const booking = await createBooking(lapsed, stay(single, "2030-07-10", "2030-07-11"), now);
    assert.equal(booking.status, "PENDING");
  });

  test("createBooking concurrency: two racers for the last room → one hold, one ROOM_UNAVAILABLE", async () => {
    const [a, b] = [await createFixtureUser(LABEL), await createFixtureUser(LABEL)];
    for (let i = 0; i < 5; i++) {
      await clearBookings(fx);
      const now = new Date();
      const input = stay(single, "2030-08-10", "2030-08-12");
      const results = await Promise.allSettled([createBooking(a, input, now), createBooking(b, input, now)]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      assert.equal(fulfilled.length, 1, `iteration ${i}`);
      assert.equal(rejected.length, 1, `iteration ${i}`);
      const reason: unknown = rejected[0]!.reason;
      assert.ok(isAppError("ROOM_UNAVAILABLE", 409)(reason), `iteration ${i}: ${String(reason)}`);
      assert.equal((reason as AppError).message, "This room was just booked for these dates");

      const blocking = await prisma.booking.count({
        where: { room: { roomTypeId: single }, ...blockingBookingWhere("2030-08-10", "2030-08-12", now) },
      });
      assert.equal(blocking, 1, `iteration ${i}`);
    }
  });

  test("createBooking retry path: two racers, two free rooms → both hold, different rooms", async () => {
    const [a, b] = [await createFixtureUser(LABEL), await createFixtureUser(LABEL)];
    for (let i = 0; i < 5; i++) {
      await clearBookings(fx);
      const now = new Date();
      const input = stay(pair, "2030-08-10", "2030-08-12");
      const results = await Promise.allSettled([createBooking(a, input, now), createBooking(b, input, now)]);

      const codes = results.map((r) => {
        assert.equal(r.status, "fulfilled", `iteration ${i}: ${r.status === "rejected" ? String(r.reason) : ""}`);
        return r.value.code;
      });
      const rooms = await Promise.all(codes.map(roomIdOf));
      assert.notEqual(rooms[0], rooms[1], `iteration ${i}`);
      assert.deepEqual([...rooms].sort(), [...fx.roomTypes[1]!.roomIds].sort());
    }
  });

  test("createBooking regenerates the code on a collision", async () => {
    const existing = await createBooking(user, stay(pair, "2030-09-01", "2030-09-03"));
    let calls = 0;
    const generateCode = () => (++calls === 1 ? existing.code : generateBookingCode());

    const booking = await createBooking(user, stay(single, "2030-09-10", "2030-09-12"), new Date(), { generateCode });
    assert.notEqual(booking.code, existing.code);
    assert.match(booking.code, BOOKING_CODE_PATTERN);
    assert.equal(calls, 2);
  });
});
