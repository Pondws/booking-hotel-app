import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import request from "supertest";
import {
  adminPromotionListSchema,
  adminPromotionSchema,
  availabilitySchema,
  bookingSchema,
  dealListSchema,
  type PromotionInput,
  type PublicUser,
} from "@booking/shared";
import { app } from "../app";
import { prisma } from "../lib/prisma";
import {
  addPromotion,
  assignStaff,
  cleanupCatalogFixtures,
  clearBookings,
  createCatalogFixture,
  createFixtureUser,
  signIn,
  type CatalogFixture,
} from "../test/catalog-fixtures";

const LABEL = "deals";
const RUN = Date.now().toString(36).toUpperCase();
const CODE = `DEAL${RUN}`;

after(async () => {
  await cleanupCatalogFixtures(LABEL);
  await prisma.$disconnect();
});

describe("deals: pricing, /api/deals, booking with a code", () => {
  let fx: CatalogFixture;
  let plain: CatalogFixture;
  let webCookie = "";

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    fx = await createCatalogFixture(LABEL, {
      roomTypes: [
        { capacity: 2, basePrice: 1000, rooms: 2 },
        { capacity: 2, basePrice: 2500, rooms: 1 },
      ],
    });
    plain = await createCatalogFixture(LABEL, { roomTypes: [{ capacity: 2, basePrice: 800, rooms: 1 }] });
    await addPromotion(fx.hotelId, { type: "LONG_STAY", percentOff: 10, minNights: 3, name: "Stay 3" });
    await addPromotion(fx.hotelId, { type: "EARLY_BIRD", percentOff: 15, minDaysAhead: 30, name: "Early" });
    await addPromotion(fx.hotelId, { type: "CODE", percentOff: 25, code: CODE, name: "Secret" });
    await addPromotion(fx.hotelId, { type: "LONG_STAY", percentOff: 50, isActive: false, name: "Off" });
    await addPromotion(fx.hotelId, { type: "LONG_STAY", percentOff: 60, validUntil: "2020-01-01", name: "Old" });
    webCookie = `sid=${await signIn(fx.userId, "WEB")}`;
  });
  beforeEach(() => clearBookings(fx));

  const availability = (query: Record<string, string>) =>
    request(app).get(`/api/hotels/${fx.slug}/availability`).query({ guests: "1", ...query });

  test("availability applies the best automatic deal and shows the subtotal", async () => {
    const res = await availability({ checkIn: "2030-03-01", checkOut: "2030-03-04" });
    assert.equal(res.status, 200);
    const body = availabilitySchema.parse(res.body.data);
    const q = body.roomTypes.find((r) => r.roomTypeId === fx.roomTypes[0]!.id)!.quote;
    assert.equal(q.subtotal, 3000);
    assert.equal(q.discount?.name, "Early");
    assert.equal(q.discount?.amount, 450);
    assert.equal(q.total, 2550);
    assert.equal(body.promoCode, null);
  });

  test("a valid code wins when it's bigger; an unknown code is reported invalid", async () => {
    const withCode = availabilitySchema.parse(
      (await availability({ checkIn: "2030-03-01", checkOut: "2030-03-02", promoCode: CODE.toLowerCase() })).body
        .data,
    );
    assert.deepEqual(withCode.promoCode, { code: CODE, valid: true });
    assert.equal(withCode.roomTypes[0]!.quote.discount?.code, CODE);
    assert.equal(withCode.roomTypes[0]!.quote.total, 750);

    const bad = availabilitySchema.parse(
      (await availability({ checkIn: "2030-03-01", checkOut: "2030-03-02", promoCode: "NOPE123" })).body.data,
    );
    assert.deepEqual(bad.promoCode, { code: "NOPE123", valid: false });
    assert.equal(bad.roomTypes[0]!.quote.discount?.name, "Early");
  });

  test("another hotel's code doesn't apply", async () => {
    const res = await request(app)
      .get(`/api/hotels/${plain.slug}/availability`)
      .query({ checkIn: "2030-03-01", checkOut: "2030-03-02", promoCode: CODE });
    const body = availabilitySchema.parse(res.body.data);
    assert.deepEqual(body.promoCode, { code: CODE, valid: false });
    assert.equal(body.roomTypes[0]!.quote.discount, null);
  });

  test("booking stores the discount; the payment amount is the net total", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .set("Cookie", webCookie)
      .send({ roomTypeId: fx.roomTypes[1]!.id, checkIn: "2030-04-01", checkOut: "2030-04-03", guests: 1, promoCode: CODE });
    assert.equal(res.status, 201);
    const booking = bookingSchema.parse(res.body.data);
    assert.equal(booking.subtotalAmount, 5000);
    assert.equal(booking.discountAmount, 1250);
    assert.equal(booking.totalAmount, 3750);
    assert.equal(booking.discountLabel, "Secret");
  });

  test("booking with a code that can't be used is a field error", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .set("Cookie", webCookie)
      .send({ roomTypeId: fx.roomTypes[0]!.id, checkIn: "2030-04-01", checkOut: "2030-04-02", guests: 1, promoCode: "NOPE123" });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.details.fieldErrors.promoCode);
  });

  test("GET /api/deals lists active, current deals best first with a discounted from price", async () => {
    const res = await request(app).get("/api/deals");
    assert.equal(res.status, 200);
    const mine = dealListSchema.parse(res.body.data).filter((d) => d.hotel.slug === fx.slug);
    assert.deepEqual(
      mine.map((d) => d.name),
      ["Secret", "Early", "Stay 3"],
    );
    assert.equal(mine[0]!.hotel.fromPrice, 1000);
    assert.equal(mine[0]!.hotel.discountedFromPrice, 750);
  });
});

describe("admin promotions API", () => {
  let mine: CatalogFixture;
  let other: CatalogFixture;
  let staff: PublicUser;
  let staffCookie = "";

  const input = (over: Partial<PromotionInput> = {}): PromotionInput => ({
    name: "Summer",
    type: "LONG_STAY",
    percentOff: 12,
    minNights: 4,
    minDaysAhead: null,
    maxDaysAhead: null,
    code: null,
    validFrom: null,
    validUntil: null,
    isActive: true,
    ...over,
  });
  const base = (fx: CatalogFixture) => `/api/admin/hotels/${fx.hotelId}/promotions`;

  before(async () => {
    mine = await createCatalogFixture(LABEL, { roomTypes: [{ capacity: 2, basePrice: 1000, rooms: 1 }] });
    other = await createCatalogFixture(LABEL, { roomTypes: [{ capacity: 2, basePrice: 1000, rooms: 1 }] });
    staff = await createFixtureUser(LABEL, "STAFF");
    await assignStaff(staff.id, mine.hotelId);
    staffCookie = `admin_sid=${await signIn(staff.id, "ADMIN")}`;
  });

  test("create → list → update → delete, with history rows", async () => {
    const created = await request(app).post(base(mine)).set("Cookie", staffCookie).send(input());
    assert.equal(created.status, 201);
    const promo = adminPromotionSchema.parse(created.body.data);
    assert.equal(promo.code, null);

    const list = await request(app).get(base(mine)).set("Cookie", staffCookie);
    assert.equal(adminPromotionListSchema.parse(list.body.data).length, 1);

    const updated = await request(app)
      .put(`${base(mine)}/${promo.id}`)
      .set("Cookie", staffCookie)
      .send(input({ type: "CODE", code: `adm${RUN}`, minNights: 1 }));
    assert.equal(updated.status, 200);
    assert.equal(adminPromotionSchema.parse(updated.body.data).code, `ADM${RUN}`);

    const deleted = await request(app).delete(`${base(mine)}/${promo.id}`).set("Cookie", staffCookie);
    assert.equal(deleted.status, 204);

    const history = await prisma.auditLog.findMany({ where: { entityType: "PROMOTION", entityId: promo.id } });
    assert.deepEqual(history.map((h) => h.action).sort(), ["CREATE", "DELETE", "UPDATE"]);
    assert.ok(history.every((h) => h.parentId === mine.hotelId));
  });

  test("validation: each type needs its condition", async () => {
    const res = await request(app)
      .post(base(mine))
      .set("Cookie", staffCookie)
      .send(input({ type: "EARLY_BIRD", minDaysAhead: null }));
    assert.equal(res.status, 400);
    assert.ok(res.body.error.details.fieldErrors.minDaysAhead);
  });

  test("a duplicate code is a 409", async () => {
    const code = `DUP${RUN}`;
    await addPromotion(other.hotelId, { type: "CODE", percentOff: 5, code });
    const res = await request(app)
      .post(base(mine))
      .set("Cookie", staffCookie)
      .send(input({ type: "CODE", code, minNights: 1 }));
    assert.equal(res.status, 409);
  });

  test("staff can't touch another hotel's promotions", async () => {
    const res = await request(app).get(base(other)).set("Cookie", staffCookie);
    assert.equal(res.status, 403);
  });
});
