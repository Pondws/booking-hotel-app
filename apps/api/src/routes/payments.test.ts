import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import request from "supertest";
import { bookingSchema, startPaymentSchema, type PublicUser } from "@booking/shared";
import { app } from "../app";
import { getPaymentProvider } from "../lib/payments";
import { MOCK_WEBHOOK_SIGNATURE, MockProvider } from "../lib/payments/mock-provider";
import { prisma } from "../lib/prisma";
import { cancelMyBooking, createBooking } from "../services/booking.service";
import {
  cleanupCatalogFixtures,
  clearBookings,
  createCatalogFixture,
  createFixtureUser,
  signIn,
  type CatalogFixture,
} from "../test/catalog-fixtures";

const LABEL = "pay-http";
const MIN = 60_000;

describe("payments API", () => {
  let fx: CatalogFixture;
  let roomTypeId = "";
  let alice: PublicUser;
  let aliceCookie = "";
  let bobCookie = "";
  let adminOnlyCookie = "";
  let mock: MockProvider;

  const post = (path: string, who?: string) => {
    const req = request(app).post(path);
    return who ? req.set("Cookie", who) : req;
  };
  /** A fresh PENDING hold for alice (created `ageMin` minutes ago). */
  const hold = (ageMin = 0) =>
    createBooking(
      alice,
      { roomTypeId, checkIn: "2031-03-01", checkOut: "2031-03-03", guests: 2 },
      new Date(Date.now() - ageMin * MIN),
    );
  const paymentsOf = (code: string) =>
    prisma.payment.findMany({ where: { booking: { code } }, orderBy: { createdAt: "asc" } });
  const start = (code: string, who = aliceCookie) => post(`/api/bookings/${code}/payments`, who);

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    fx = await createCatalogFixture(LABEL, { roomTypes: [{ capacity: 2, basePrice: 1500, rooms: 1 }] });
    roomTypeId = fx.roomTypes[0]!.id;
    const bob = await createFixtureUser(LABEL);
    alice = await createFixtureUser(LABEL);
    aliceCookie = `sid=${await signIn(alice.id, "WEB")}`;
    bobCookie = `sid=${await signIn(bob.id, "WEB")}`;
    adminOnlyCookie = `admin_sid=${await signIn(alice.id, "ADMIN")}`;
    const provider = getPaymentProvider();
    assert.ok(provider instanceof MockProvider);
    mock = provider;
  });
  beforeEach(() => clearBookings(fx));
  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  describe("POST /api/bookings/:code/payments", () => {
    test("start returns a client secret", async () => {
      const booking = await hold();
      const res = await start(booking.code);
      assert.equal(res.status, 201);
      const { clientSecret } = startPaymentSchema.parse(res.body.data);
      const rows = await paymentsOf(booking.code);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.status, "PENDING");
      assert.equal(rows[0]!.provider, "mock");
      assert.equal(rows[0]!.amount.toNumber(), booking.totalAmount);
      assert.equal(clientSecret, `${rows[0]!.providerRef}_secret`);
    });

    test("start again reuses the intent", async () => {
      const booking = await hold();
      const a = await start(booking.code);
      const b = await start(booking.code);
      assert.equal(b.status, 201);
      assert.equal(b.body.data.clientSecret, a.body.data.clientSecret);
      assert.equal((await paymentsOf(booking.code)).length, 1);
    });

    test("two concurrent starts share one payment", async () => {
      const booking = await hold();
      const [a, b] = await Promise.all([start(booking.code), start(booking.code)]);
      assert.equal(a.status, 201);
      assert.equal(b.status, 201);
      assert.equal(a.body.data.clientSecret, b.body.data.clientSecret);
      assert.equal((await paymentsOf(booking.code)).length, 1);
    });

    test("start on an expired / cancelled / confirmed booking → 409 CONFLICT", async () => {
      const expired = await hold(20);
      const cancelled = await hold();
      await cancelMyBooking(alice, cancelled.code);
      const confirmed = await hold();
      await prisma.booking.update({ where: { code: confirmed.code }, data: { status: "CONFIRMED", expiresAt: null } });
      for (const code of [expired.code, cancelled.code, confirmed.code]) {
        const res = await start(code);
        assert.equal(res.status, 409, code);
        assert.deepEqual(res.body.error, { code: "CONFLICT", message: "This booking can't be paid" });
      }
    });

    test("start after the intent succeeded settles instead", async () => {
      const booking = await hold();
      await start(booking.code);
      const [payment] = await paymentsOf(booking.code);
      mock.succeed(payment!.providerRef!);
      const res = await start(booking.code);
      assert.equal(res.status, 409);
      const row = await prisma.booking.findUniqueOrThrow({ where: { code: booking.code } });
      assert.equal(row.status, "CONFIRMED");
      assert.equal((await paymentsOf(booking.code))[0]!.status, "SUCCEEDED");
    });

    test("other user's booking → 404", async () => {
      const booking = await hold();
      const res = await start(booking.code, bobCookie);
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, "NOT_FOUND");
    });

    test("no cookie or admin_sid only → 401", async () => {
      const booking = await hold();
      for (const who of [undefined, adminOnlyCookie]) {
        const res = await post(`/api/bookings/${booking.code}/payments`, who);
        assert.equal(res.status, 401);
      }
    });
  });

  describe("POST /api/webhooks/stripe", () => {
    const webhook = (event: object, signature = MOCK_WEBHOOK_SIGNATURE) =>
      request(app)
        .post("/api/webhooks/stripe")
        .set("Content-Type", "application/json")
        .set("stripe-signature", signature)
        .send(JSON.stringify(event));
    /** Starts payment on a fresh hold and returns its booking code + intent ref. */
    const started = async () => {
      const booking = await hold();
      await start(booking.code);
      const [payment] = await paymentsOf(booking.code);
      return { code: booking.code, ref: payment!.providerRef! };
    };

    test("webhook with a bad signature → 400", async () => {
      const { code, ref } = await started();
      mock.succeed(ref);
      const res = await webhook({ type: "payment_intent.succeeded", providerRef: ref }, "forged");
      assert.equal(res.status, 400);
      assert.equal((await paymentsOf(code))[0]!.status, "PENDING");
    });

    test("signed webhook confirms the booking", async () => {
      const { code, ref } = await started();
      mock.succeed(ref);
      const res = await webhook({ type: "payment_intent.succeeded", providerRef: ref });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { data: { received: true } });
      const detail = bookingSchema.parse((await request(app).get(`/api/bookings/${code}`).set("Cookie", aliceCookie)).body.data);
      assert.equal(detail.status, "CONFIRMED");
      assert.equal(detail.payable, false);
      assert.equal(detail.payment?.status, "SUCCEEDED");
    });

    test("repeated webhook → 200, paidAt unchanged", async () => {
      const { code, ref } = await started();
      mock.succeed(ref);
      await webhook({ type: "payment_intent.succeeded", providerRef: ref });
      const first = (await paymentsOf(code))[0]!.paidAt;
      const res = await webhook({ type: "payment_intent.succeeded", providerRef: ref });
      assert.equal(res.status, 200);
      assert.deepEqual((await paymentsOf(code))[0]!.paidAt, first);
    });

    test("canceled webhook marks the payment FAILED", async () => {
      const { code, ref } = await started();
      mock.cancel(ref);
      assert.equal((await webhook({ type: "payment_intent.canceled", providerRef: ref })).status, 200);
      assert.equal((await paymentsOf(code))[0]!.status, "FAILED");
    });

    test("webhook for an unknown ref or an ignored event type → 200", async () => {
      assert.equal((await webhook({ type: "payment_intent.succeeded", providerRef: "mock_pi_unknown" })).status, 200);
      assert.equal((await webhook({ type: "charge.updated", providerRef: "mock_pi_unknown" })).status, 200);
    });
  });
});
