import assert from "node:assert/strict";
import { after, afterEach, before, describe, test } from "node:test";
import request from "supertest";
import { BOOKING_TZ, adminDashboardSchema, todayIn, type AdminDashboard } from "@booking/shared";
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

const LABEL = "admin-dashboard";

const today = todayIn(BOOKING_TZ);
const day = (offset: number) => {
  const d = toDbDate(today);
  d.setUTCDate(d.getUTCDate() + offset);
  return fromDbDate(d);
};

describe("admin dashboard API", () => {
  let mine: CatalogFixture;
  let other: CatalogFixture;
  let staffCookie = "";
  let loneStaffCookie = "";
  let adminCookie = "";
  let webCookie = "";

  /** Standard has active rooms 101, 102 and inactive 103. */
  const room = (n: 0 | 1) => mine.roomTypes[0]!.roomIds[n]!;
  const inactiveRoom = () => mine.roomTypes[0]!.inactiveRoomIds[0]!;

  const book = (
    roomId: string,
    checkIn: string,
    checkOut: string,
    status: BookingStatus = "CONFIRMED",
    extra: Partial<Prisma.BookingUncheckedCreateInput> = {},
  ) =>
    prisma.booking.create({
      data: {
        code: generateBookingCode(),
        userId: mine.userId,
        roomId,
        guestName: "Dash Fixture",
        guestEmail: "dash@test.local",
        guests: 2,
        checkIn: toDbDate(checkIn),
        checkOut: toDbDate(checkOut),
        status,
        totalAmount: new Prisma.Decimal(3000),
        currency: "THB",
        ...extra,
      },
    });

  const get = async (query: string, cookie = staffCookie) =>
    request(app).get(`/api/admin/dashboard${query}`).set("Cookie", cookie);

  const dashboard = async (query: string, cookie = staffCookie): Promise<AdminDashboard> => {
    const res = await get(query, cookie);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return adminDashboardSchema.parse(res.body.data);
  };

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    const spec = [{ name: "Standard", capacity: 2, basePrice: 1000, rooms: 2, inactiveRooms: 1 }];
    mine = await createCatalogFixture(LABEL, { roomTypes: spec });
    other = await createCatalogFixture(LABEL, { roomTypes: spec });
    const staff = await createFixtureUser(LABEL, "STAFF");
    const lone = await createFixtureUser(LABEL, "STAFF");
    const admin = await createFixtureUser(LABEL, "ADMIN");
    const customer = await createFixtureUser(LABEL, "CUSTOMER");
    await assignStaff(staff.id, mine.hotelId);
    staffCookie = `admin_sid=${await signIn(staff.id, "ADMIN")}`;
    loneStaffCookie = `admin_sid=${await signIn(lone.id, "ADMIN")}`;
    adminCookie = `admin_sid=${await signIn(admin.id, "ADMIN")}`;
    webCookie = `sid=${await signIn(customer.id, "WEB")}`;
  });

  afterEach(async () => {
    await clearBookings(mine);
    await clearBookings(other);
  });

  after(async () => {
    await cleanupCatalogFixtures(LABEL);
  });

  test("needs an admin session and access to the hotel", async () => {
    assert.equal((await get("", webCookie)).status, 401);
    const res = await get(`?hotelId=${other.hotelId}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "FORBIDDEN");
    const asAdmin = await dashboard(`?hotelId=${other.hotelId}`, adminCookie);
    assert.deepEqual([asAdmin.hotelCount, asAdmin.roomCount], [1, 2]);
  });

  test("rejects a reversed or too-long range", async () => {
    assert.equal((await get(`?from=${day(0)}&to=${day(-1)}`)).status, 400);
    assert.equal((await get(`?from=${day(-92)}&to=${day(0)}`)).status, 400);
    assert.equal((await get(`?from=${day(-91)}&to=${day(0)}`)).status, 200);
  });

  test("defaults to the 30 nights ending today; one bound fills the other", async () => {
    const d = await dashboard("");
    assert.deepEqual([d.today, d.from, d.to, d.nights], [today, day(-29), today, 30]);
    assert.equal(d.occupancy.daily.length, 30);
    const fromOnly = await dashboard(`?from=${day(-10)}`);
    assert.deepEqual([fromOnly.from, fromOnly.to], [day(-10), day(19)]);
    const toOnly = await dashboard(`?to=${day(5)}`);
    assert.deepEqual([toOnly.from, toOnly.to], [day(-24), day(5)]);
  });

  test("staff see only their hotels; staff without hotels get zeros", async () => {
    const d = await dashboard("");
    assert.deepEqual([d.hotelCount, d.roomCount], [1, 2]);

    await book(room(0), day(0), day(1));
    const lone = await dashboard("", loneStaffCookie);
    assert.deepEqual([lone.hotelCount, lone.roomCount, lone.inHouse], [0, 0, 0]);
    assert.equal(lone.occupancy.rate, null);
    assert.equal(lone.occupancy.roomNightsSold, 0);
    assert.ok(lone.occupancy.daily.every((n) => n.rate === null));
    assert.deepEqual(lone.revenue, []);
    assert.equal(lone.arrivals.total, 0);
  });

  test("occupancy counts CONFIRMED and COMPLETED nights only", async () => {
    await book(room(0), day(-2), day(1));
    await book(room(1), day(-1), day(0), "COMPLETED");
    await book(room(1), day(-2), day(-1), "PENDING", { expiresAt: new Date(Date.now() + 600_000) });
    await book(inactiveRoom(), day(-2), day(-1), "CANCELLED");
    await book(other.roomTypes[0]!.roomIds[0]!, day(-2), day(0), "CONFIRMED", { userId: other.userId });

    const d = await dashboard(`?from=${day(-2)}&to=${day(-1)}`);
    assert.equal(d.nights, 2);
    assert.deepEqual(d.occupancy, {
      roomNightsSold: 3,
      roomNightsAvailable: 4,
      rate: 0.75,
      daily: [
        { date: day(-2), sold: 1, rate: 0.5 },
        { date: day(-1), sold: 2, rate: 1 },
      ],
    });
  });

  test("a booking on a room deactivated later still counts as sold", async () => {
    await book(inactiveRoom(), day(0), day(1));
    const d = await dashboard(`?from=${day(0)}&to=${day(0)}`);
    assert.deepEqual([d.occupancy.roomNightsSold, d.occupancy.roomNightsAvailable], [1, 2]);
  });

  test("revenue is split over the nights and clipped to the range", async () => {
    await book(room(0), day(-3), day(0), "CONFIRMED", { totalAmount: new Prisma.Decimal("1000.00") });
    const d = await dashboard(`?from=${day(-3)}&to=${day(-1)}`);
    assert.deepEqual(d.revenue, [
      {
        currency: "THB",
        total: 1000,
        daily: [
          { date: day(-3), amount: 333.34 },
          { date: day(-2), amount: 333.33 },
          { date: day(-1), amount: 333.33 },
        ],
      },
    ]);

    await book(room(1), day(-5), day(5), "CONFIRMED", { totalAmount: new Prisma.Decimal("10000.00") });
    const clipped = await dashboard(`?from=${day(0)}&to=${day(0)}`);
    assert.equal(clipped.occupancy.roomNightsSold, 1);
    assert.deepEqual(clipped.revenue, [{ currency: "THB", total: 1000, daily: [{ date: day(0), amount: 1000 }] }]);
  });

  test("today: arrivals, departures and in-house guests", async () => {
    const checkedIn = new Date();
    await book(room(0), day(0), day(2), "CONFIRMED", { checkedInAt: checkedIn, guestName: "Anan" });
    await book(room(1), day(0), day(1), "CONFIRMED", { guestName: "Boon" });
    await book(inactiveRoom(), day(-1), day(0), "COMPLETED", {
      checkedInAt: checkedIn,
      checkedOutAt: checkedIn,
      guestName: "Chai",
    });
    await book(room(1), day(1), day(3), "CANCELLED");

    const d = await dashboard("");
    assert.deepEqual([d.arrivals.total, d.arrivals.done], [2, 1]);
    assert.deepEqual(
      d.arrivals.items.map((s) => [s.guestName, s.done, s.room.number, s.nights]),
      [
        ["Anan", true, "101", 2],
        ["Boon", false, "102", 1],
      ],
    );
    assert.equal(d.arrivals.items[0]!.hotel.id, mine.hotelId);
    assert.deepEqual([d.departures.total, d.departures.done], [1, 1]);
    assert.equal(d.departures.items[0]!.guestName, "Chai");
    assert.equal(d.inHouse, 1);
  });
});
