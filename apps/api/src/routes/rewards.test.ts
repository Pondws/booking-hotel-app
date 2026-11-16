import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import request from "supertest";
import { bookingSchema, rewardsSummarySchema } from "@booking/shared";
import { app } from "../app";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { pointsBalance, pointsForStay } from "../services/rewards.service";
import {
  addBooking,
  assignStaff,
  cleanupCatalogFixtures,
  clearBookings,
  createCatalogFixture,
  createFixtureUser,
  signIn,
  type CatalogFixture,
} from "../test/catalog-fixtures";

const LABEL = "rewards";

describe("rewards", () => {
  let fx: CatalogFixture;
  let webCookie = "";
  let adminCookie = "";

  /** A completed stay that earned `points` (lifetime ≥ 500 → SILVER). */
  const earn = async (points: number) => {
    const row = await addBooking(fx, fx.roomTypes[0]!.roomIds[0]!, "2026-01-01", "2026-01-02", "COMPLETED");
    await prisma.booking.update({ where: { id: row.id }, data: { pointsEarned: points } });
  };

  const hold = (pointsToRedeem: number, checkIn = "2030-05-01", checkOut = "2030-05-03") =>
    request(app)
      .post("/api/bookings")
      .set("Cookie", webCookie)
      .send({ roomTypeId: fx.roomTypes[0]!.id, checkIn, checkOut, guests: 1, pointsToRedeem });

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    fx = await createCatalogFixture(LABEL, { roomTypes: [{ capacity: 2, basePrice: 1000, rooms: 3 }] });
    webCookie = `sid=${await signIn(fx.userId, "WEB")}`;
    const admin = await createFixtureUser(LABEL, "ADMIN");
    await assignStaff(admin.id, fx.hotelId);
    adminCookie = `admin_sid=${await signIn(admin.id, "ADMIN")}`;
  });
  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });
  beforeEach(() => clearBookings(fx));

  test("GET /api/rewards/me needs a web session", async () => {
    assert.equal((await request(app).get("/api/rewards/me")).status, 401);
  });

  test("tier, balance and next tier come from completed stays", async () => {
    await earn(600);
    const res = await request(app).get("/api/rewards/me").set("Cookie", webCookie);
    assert.equal(res.status, 200);
    const r = rewardsSummarySchema.parse(res.body.data);
    assert.equal(r.tier, "SILVER");
    assert.equal(r.lifetimePoints, 600);
    assert.equal(r.balance, 600);
    assert.deepEqual(r.nextTier, { tier: "GOLD", minPoints: 2000, pointsToGo: 1400 });
    assert.equal(r.history.length, 1);
  });

  test("redeeming takes points off the total; cancelling gives them back", async () => {
    await earn(600);
    const res = await hold(200);
    assert.equal(res.status, 201);
    const booking = bookingSchema.parse(res.body.data);
    assert.equal(booking.pointsRedeemed, 200);
    assert.equal(booking.totalAmount, 1800);
    assert.equal(booking.subtotalAmount, 2000);
    assert.equal(await pointsBalance(fx.userId), 400);

    const cancelled = await request(app).post(`/api/bookings/${booking.code}/cancel`).set("Cookie", webCookie);
    assert.equal(cancelled.status, 200);
    assert.equal(await pointsBalance(fx.userId), 600);
  });

  test("a lapsed hold gives its points back", async () => {
    await earn(600);
    const row = await addBooking(fx, fx.roomTypes[0]!.roomIds[1]!, "2030-06-01", "2030-06-02", "PENDING", new Date(Date.now() - 1000));
    await prisma.booking.update({ where: { id: row.id }, data: { pointsRedeemed: 300 } });
    assert.equal(await pointsBalance(fx.userId), 600);
  });

  test("redeem rules: minimum, half the price, and the balance", async () => {
    await earn(600);
    const field = (res: request.Response) => res.body.error?.details?.fieldErrors?.pointsToRedeem?.[0];
    const tooFew = await hold(50);
    assert.equal(tooFew.status, 400);
    assert.match(field(tooFew), /at least 100/);
    const tooMany = await hold(1001); // 2 nights × 1000 → at most 1000
    assert.equal(tooMany.status, 400);
    assert.match(field(tooMany), /at most 1000/);
    const overBalance = await hold(700, "2030-05-01", "2030-05-08"); // cap 3500, balance 600
    assert.equal(overBalance.status, 400);
    assert.match(field(overBalance), /enough points/);
  });

  test("check-out writes the earned points with COMPLETED, at the guest's tier", async () => {
    await earn(600); // SILVER: 1.5 points per 100
    const row = await addBooking(fx, fx.roomTypes[0]!.roomIds[2]!, "2026-11-10", "2026-11-12", "CONFIRMED");
    await prisma.booking.update({
      where: { id: row.id },
      data: { checkedInAt: new Date(), totalAmount: new Prisma.Decimal("2999.99") },
    });
    const res = await request(app).post(`/api/admin/bookings/${row.code}/check-out`).set("Cookie", adminCookie);
    assert.equal(res.status, 200);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: row.id } });
    assert.equal(after.status, "COMPLETED");
    assert.equal(after.pointsEarned, 44); // floor(2999.99 × 1.5 / 100)
  });

  test("pointsForStay floors per tier", () => {
    assert.equal(pointsForStay(new Prisma.Decimal(1999), "MEMBER"), 19);
    assert.equal(pointsForStay(new Prisma.Decimal(1000), "GOLD"), 20);
  });
});
