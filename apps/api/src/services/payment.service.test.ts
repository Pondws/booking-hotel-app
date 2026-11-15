import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import type { PublicUser } from "@booking/shared";
import { Prisma } from "../generated/prisma/client";
import { MockProvider } from "../lib/payments/mock-provider";
import { prisma } from "../lib/prisma";
import {
  addBooking,
  cleanupCatalogFixtures,
  clearBookings,
  createCatalogFixture,
  type CatalogFixture,
} from "../test/catalog-fixtures";
import { settlePayment, startPayment } from "./payment.service";

const LABEL = "pay-svc";
const MIN = 60_000;

describe("settlePayment", () => {
  let fx: CatalogFixture;
  let roomId = "";
  let mock: MockProvider;

  /** A PENDING hold (expiring at `expiresAt`) with a PENDING ฿3,000 payment on a fresh mock intent. */
  const holdWithPayment = async (expiresAt: Date) => {
    const booking = await addBooking(fx, roomId, "2030-03-01", "2030-03-03", "PENDING", expiresAt);
    const payment = await prisma.payment.create({
      data: { bookingId: booking.id, amount: new Prisma.Decimal("3000.00"), currency: "THB", provider: "mock" },
    });
    const { providerRef } = await mock.createIntent({
      amountMinor: 300000,
      currency: "THB",
      idempotencyKey: payment.id,
      metadata: {},
    });
    await prisma.payment.update({ where: { id: payment.id }, data: { providerRef } });
    return { bookingId: booking.id, paymentId: payment.id, ref: providerRef };
  };
  const bookingOf = (id: string) => prisma.booking.findUniqueOrThrow({ where: { id } });
  const paymentOf = (id: string) => prisma.payment.findUniqueOrThrow({ where: { id } });

  before(async () => {
    await cleanupCatalogFixtures(LABEL);
    fx = await createCatalogFixture(LABEL, { roomTypes: [{ capacity: 2, basePrice: 1500, rooms: 1 }] });
    roomId = fx.roomTypes[0]!.roomIds[0]!;
  });
  beforeEach(async () => {
    await clearBookings(fx);
    mock = new MockProvider();
  });
  after(async () => {
    await cleanupCatalogFixtures(LABEL);
    await prisma.$disconnect();
  });

  test("confirms the booking on success", async () => {
    const now = new Date();
    const { bookingId, paymentId, ref } = await holdWithPayment(new Date(now.getTime() + 10 * MIN));
    mock.succeed(ref);
    assert.equal(await settlePayment(ref, "SUCCEEDED", now, { provider: mock }), "confirmed");
    const booking = await bookingOf(bookingId);
    assert.equal(booking.status, "CONFIRMED");
    assert.equal(booking.expiresAt, null);
    const payment = await paymentOf(paymentId);
    assert.equal(payment.status, "SUCCEEDED");
    assert.deepEqual(payment.paidAt, now);
  });

  test("is a no-op when repeated", async () => {
    const now = new Date();
    const { paymentId, ref } = await holdWithPayment(new Date(now.getTime() + 10 * MIN));
    mock.succeed(ref);
    await settlePayment(ref, "SUCCEEDED", now, { provider: mock });
    const later = new Date(now.getTime() + MIN);
    assert.equal(await settlePayment(ref, "SUCCEEDED", later, { provider: mock }), "noop");
    assert.deepEqual((await paymentOf(paymentId)).paidAt, now);
  });

  test("settles once when two settlers race", async () => {
    const now = new Date();
    const { bookingId, ref } = await holdWithPayment(new Date(now.getTime() + 10 * MIN));
    mock.succeed(ref);
    const results = await Promise.all([
      settlePayment(ref, "SUCCEEDED", now, { provider: mock }),
      settlePayment(ref, "SUCCEEDED", now, { provider: mock }),
    ]);
    assert.deepEqual(results.sort(), ["confirmed", "noop"]);
    assert.equal((await bookingOf(bookingId)).status, "CONFIRMED");
    assert.deepEqual(mock.refunds, []);
  });

  test("marks FAILED", async () => {
    const now = new Date();
    const { bookingId, paymentId, ref } = await holdWithPayment(new Date(now.getTime() + 10 * MIN));
    mock.cancel(ref);
    assert.equal(await settlePayment(ref, "FAILED", now, { provider: mock }), "failed");
    assert.equal((await paymentOf(paymentId)).status, "FAILED");
    assert.equal((await bookingOf(bookingId)).status, "PENDING");
  });

  test("refunds a success after the hold lapsed", async () => {
    const now = new Date();
    const { bookingId, paymentId, ref } = await holdWithPayment(new Date(now.getTime() - MIN));
    mock.succeed(ref);
    assert.equal(await settlePayment(ref, "SUCCEEDED", now, { provider: mock }), "refunded");
    assert.notEqual((await bookingOf(bookingId)).status, "CONFIRMED");
    const payment = await paymentOf(paymentId);
    assert.equal(payment.status, "REFUNDED");
    assert.deepEqual(payment.refundedAt, now);
    assert.deepEqual(mock.refunds, [ref]);
  });

  test("refund retry is idempotent", async () => {
    const now = new Date();
    const { paymentId, ref } = await holdWithPayment(new Date(now.getTime() - MIN));
    mock.succeed(ref);
    mock.failNextRefund = true;
    await assert.rejects(settlePayment(ref, "SUCCEEDED", now, { provider: mock }));
    assert.equal((await paymentOf(paymentId)).status, "SUCCEEDED");
    assert.equal(await settlePayment(ref, "SUCCEEDED", now, { provider: mock }), "refunded");
    assert.equal(await settlePayment(ref, "SUCCEEDED", now, { provider: mock }), "noop");
    assert.equal(mock.refunds.length, 1);
    assert.equal((await paymentOf(paymentId)).status, "REFUNDED");
  });

  test("refunds an amount mismatch instead of confirming", async () => {
    const now = new Date();
    const { bookingId, paymentId, ref } = await holdWithPayment(new Date(now.getTime() + 10 * MIN));
    mock.succeed(ref);
    mock.setAmount(ref, 1);
    assert.equal(await settlePayment(ref, "SUCCEEDED", now, { provider: mock }), "refunded");
    assert.equal((await paymentOf(paymentId)).status, "REFUNDED");
    assert.equal((await bookingOf(bookingId)).status, "PENDING");
    assert.deepEqual(mock.refunds, [ref]);
  });

  test("refunds a success that lands on a payment already marked FAILED", async () => {
    const now = new Date();
    const { bookingId, paymentId, ref } = await holdWithPayment(new Date(now.getTime() + 10 * MIN));
    await prisma.payment.update({ where: { id: paymentId }, data: { status: "FAILED" } });
    mock.succeed(ref);
    assert.equal(await settlePayment(ref, "SUCCEEDED", now, { provider: mock }), "refunded");
    const payment = await paymentOf(paymentId);
    assert.equal(payment.status, "REFUNDED");
    assert.ok(payment.refundedAt);
    assert.notEqual((await bookingOf(bookingId)).status, "CONFIRMED");
    assert.deepEqual(mock.refunds, [ref]);
    assert.equal(await settlePayment(ref, "SUCCEEDED", now, { provider: mock }), "noop");
    assert.equal(mock.refunds.length, 1);
  });

  test("a repeated success after the stay COMPLETED does not refund", async () => {
    const now = new Date();
    const { bookingId, paymentId, ref } = await holdWithPayment(new Date(now.getTime() + 10 * MIN));
    mock.succeed(ref);
    await settlePayment(ref, "SUCCEEDED", now, { provider: mock });
    await prisma.booking.update({ where: { id: bookingId }, data: { status: "COMPLETED" } });
    assert.equal(await settlePayment(ref, "SUCCEEDED", now, { provider: mock }), "noop");
    assert.deepEqual(mock.refunds, []);
    assert.equal((await paymentOf(paymentId)).status, "SUCCEEDED");
  });

  const ownerOf = (): Promise<PublicUser> =>
    prisma.user.findUniqueOrThrow({
      where: { id: fx.userId },
      select: { id: true, email: true, name: true, phone: true, role: true },
    });

  test("startPayment: a failed createIntent leaves the payment PENDING so a retry reuses it", async () => {
    const now = new Date();
    const booking = await addBooking(fx, roomId, "2030-03-01", "2030-03-03", "PENDING", new Date(now.getTime() + 10 * MIN));
    const flaky = new (class extends MockProvider {
      failNext = true;
      override async createIntent(i: Parameters<MockProvider["createIntent"]>[0]) {
        if (this.failNext) {
          this.failNext = false;
          throw new Error("stripe down");
        }
        return super.createIntent(i);
      }
    })();
    const user = await ownerOf();
    await assert.rejects(startPayment(user, booking.code, now, { provider: flaky }));
    const [row] = await prisma.payment.findMany({ where: { bookingId: booking.id } });
    assert.equal(row!.status, "PENDING");
    const { clientSecret } = await startPayment(user, booking.code, now, { provider: flaky });
    const rows = await prisma.payment.findMany({ where: { bookingId: booking.id } });
    assert.equal(rows.length, 1);
    assert.equal(clientSecret, `${rows[0]!.providerRef}_secret`);
  });

  test("startPayment: a payment given up while its intent was being created is not handed out", async () => {
    const now = new Date();
    const booking = await addBooking(fx, roomId, "2030-03-01", "2030-03-03", "PENDING", new Date(now.getTime() + 10 * MIN));
    // A concurrent cancel marks the row FAILED while createIntent is in flight.
    const racing = new (class extends MockProvider {
      override async createIntent(i: Parameters<MockProvider["createIntent"]>[0]) {
        await prisma.payment.updateMany({ where: { bookingId: booking.id }, data: { status: "FAILED" } });
        return super.createIntent(i);
      }
    })();
    await assert.rejects(startPayment(await ownerOf(), booking.code, now, { provider: racing }), (err: unknown) =>
      err instanceof Error && "status" in err && err.status === 409,
    );
    const [row] = await prisma.payment.findMany({ where: { bookingId: booking.id } });
    assert.equal(row!.status, "FAILED");
    assert.ok(row!.providerRef, "the intent is recorded so a late success can still be refunded");
    assert.deepEqual(racing.cancelled, [row!.providerRef]);
  });

  test("unknown ref is a no-op", async () => {
    assert.equal(await settlePayment("mock_pi_nope", "SUCCEEDED", new Date(), { provider: mock }), "noop");
  });
});
