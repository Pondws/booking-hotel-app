import type { Booking, PublicUser, StartPayment } from "@booking/shared";
import { AppError } from "../lib/app-error";
import { toMinorUnits } from "../lib/money";
import { getPaymentProvider, type PaymentProvider } from "../lib/payments";
import { prisma } from "../lib/prisma";
import { isUniqueViolationOnIndex } from "../lib/prisma-errors";
import { expireLapsedHolds, getMyBooking } from "./booking.service";

export type SettleOutcome = "SUCCEEDED" | "FAILED";
export type SettleResult = "confirmed" | "refunded" | "failed" | "noop";

type ProviderOpts = { provider?: PaymentProvider };

/**
 * The only function that moves a payment out of PENDING (booking cancel excepted) and owns the
 * booking side of it. It claims the payment row first (`updateMany … WHERE status PENDING`), so two
 * settlers — the webhook and the sync endpoint — can never both act on one intent.
 * A success that can't confirm the booking is refunded after the transaction commits: the hold lapsed
 * or was cancelled, the row was already FAILED (a race with cancel/start), or the amount doesn't match.
 * A later call retries a refund that failed; the refund itself is idempotent at the provider.
 */
export async function settlePayment(
  providerRef: string,
  outcome: SettleOutcome,
  now: Date = new Date(),
  opts: ProviderOpts = {},
): Promise<SettleResult> {
  const provider = opts.provider ?? getPaymentProvider();
  const payment = await prisma.payment.findUnique({
    where: { providerRef },
    select: { id: true, bookingId: true, amount: true, currency: true, booking: { select: { code: true } } },
  });
  if (!payment) {
    console.warn(`settlePayment: no payment for ${provider.name} ref ${providerRef}`);
    return "noop";
  }
  const bookingCode = payment.booking.code;

  if (outcome === "SUCCEEDED") {
    const intent = await provider.getIntent(providerRef);
    if (intent.amountMinor !== toMinorUnits(payment.amount) || intent.currency !== payment.currency) {
      // Never confirm a booking for a different amount — give the money back instead.
      const current = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id }, select: { status: true } });
      if (current.status === "REFUNDED") return "noop";
      console.error(
        `settlePayment: amount mismatch for booking ${bookingCode} (intent ${intent.amountMinor} ${intent.currency}, ` +
          `payment ${payment.amount.toString()} ${payment.currency}) — refunding`,
      );
      return refundPayment(provider, providerRef, payment.id, bookingCode, now);
    }
  }

  const settled = await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: outcome, paidAt: outcome === "SUCCEEDED" ? now : null },
    });
    if (claimed.count === 0) return "lost" as const;
    if (outcome === "FAILED") return "failed" as const;

    const confirmed = await tx.booking.updateMany({
      where: { id: payment.bookingId, status: "PENDING", expiresAt: { gt: now } },
      data: { status: "CONFIRMED", expiresAt: null },
    });
    return confirmed.count === 1 ? ("confirmed" as const) : ("refund" as const);
  });
  if (settled === "failed" || settled === "confirmed") return settled;

  if (settled === "lost") {
    if (outcome !== "SUCCEEDED") return "noop";
    // Someone else settled the row. Act only if that leaves a charge nothing paid for.
    const current = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
      select: { status: true, booking: { select: { status: true } } },
    });
    // SUCCEEDED on a CONFIRMED/COMPLETED booking paid for the stay — never refund it from a repeated event.
    const paidFor = current.booking.status === "CONFIRMED" || current.booking.status === "COMPLETED";
    // FAILED: the row was given up (cancel, or a failed start) but the card was charged anyway.
    const stranded = current.status === "FAILED" || (current.status === "SUCCEEDED" && !paidFor);
    if (!stranded) return "noop";
  }

  return refundPayment(provider, providerRef, payment.id, bookingCode, now);
}

async function refundPayment(
  provider: PaymentProvider,
  providerRef: string,
  paymentId: string,
  bookingCode: string,
  now: Date,
): Promise<"refunded"> {
  try {
    await provider.refund(providerRef, { idempotencyKey: `refund-${paymentId}` });
  } catch (err) {
    console.error(`settlePayment: refund failed for booking ${bookingCode}`, err);
    throw err;
  }
  await prisma.payment.updateMany({
    where: { id: paymentId, status: { not: "REFUNDED" } },
    data: { status: "REFUNDED", refundedAt: now },
  });
  return "refunded";
}

const notPayable = () => new AppError(409, "CONFLICT", "This booking can't be paid");

const pendingPaymentOf = (bookingId: string) =>
  prisma.payment.findFirst({
    where: { bookingId, status: "PENDING" },
    select: { id: true, providerRef: true },
  });

/**
 * Returns the PaymentIntent secret for the owner's payable booking, creating the payment (and intent)
 * or reusing the live one. Amount and currency always come from the booking row.
 */
export async function startPayment(
  user: PublicUser,
  code: string,
  now: Date = new Date(),
  opts: ProviderOpts = {},
): Promise<StartPayment> {
  const provider = opts.provider ?? getPaymentProvider();
  await expireLapsedHolds(user.id, now);
  const booking = await prisma.booking.findFirst({
    where: { code, userId: user.id },
    select: { id: true, code: true, status: true, expiresAt: true, totalAmount: true, currency: true },
  });
  if (!booking) throw new AppError(404, "NOT_FOUND", "Booking not found");

  // At most two rounds: a reused intent that was cancelled is settled FAILED, then a fresh one is made.
  for (;;) {
    if (booking.status !== "PENDING" || booking.expiresAt === null || booking.expiresAt <= now) throw notPayable();

    let payment = await pendingPaymentOf(booking.id);
    if (!payment) {
      try {
        payment = await prisma.payment.create({
          data: {
            bookingId: booking.id,
            amount: booking.totalAmount,
            currency: booking.currency,
            provider: provider.name,
          },
          select: { id: true, providerRef: true },
        });
      } catch (err) {
        if (!isUniqueViolationOnIndex(err, "payments_one_active_per_booking")) throw err;
        payment = await pendingPaymentOf(booking.id); // a concurrent start won — share its payment
        if (!payment) throw notPayable(); // …or it already succeeded
      }
    }

    if (payment.providerRef === null) {
      // New payment, or one a concurrent start is still creating: the shared idempotency key makes
      // the provider return the same intent to both.
      // A createIntent failure leaves the row PENDING with no ref, so the next start retries it with the
      // same key — marking it FAILED could strand a secret a concurrent start already handed out.
      const intent = await provider.createIntent({
        amountMinor: toMinorUnits(booking.totalAmount),
        currency: booking.currency,
        idempotencyKey: payment.id,
        metadata: { bookingCode: booking.code, paymentId: payment.id },
      });
      // Always record the ref (even on a row given up meanwhile): a late success is found by it and refunded.
      await prisma.payment.updateMany({
        where: { id: payment.id, providerRef: null },
        data: { providerRef: intent.providerRef },
      });
      const current = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id }, select: { status: true } });
      if (current.status !== "PENDING") {
        // Cancelled (or settled) while the intent was being created: don't hand out its secret.
        await provider.cancelIntent(intent.providerRef).catch((err: unknown) => {
          console.error(`startPayment: could not cancel intent ${intent.providerRef} of a given-up payment`, err);
        });
        throw notPayable();
      }
      return { clientSecret: intent.clientSecret };
    }

    const intent = await provider.getIntent(payment.providerRef);
    if (intent.status === "pending") return { clientSecret: intent.clientSecret };
    if (intent.status === "succeeded") {
      await settlePayment(payment.providerRef, "SUCCEEDED", now, { provider });
      throw notPayable();
    }
    await settlePayment(payment.providerRef, "FAILED", now, { provider });
  }
}

/** Verifies and applies a provider webhook. Throws (→ 5xx) on DB/provider errors so the provider retries. */
export async function handleWebhook(
  rawBody: Buffer,
  signature: string | undefined,
  now: Date = new Date(),
  opts: ProviderOpts = {},
): Promise<void> {
  const provider = opts.provider ?? getPaymentProvider();
  const event = provider.parseWebhook(rawBody, signature);
  if (event.type === "ignored" || !event.providerRef) return;
  await settlePayment(event.providerRef, event.type === "succeeded" ? "SUCCEEDED" : "FAILED", now, { provider });
}

/**
 * Asks the provider (server-side — never the browser) whether the booking's open intent finished and
 * settles it, so the page can confirm without waiting for the webhook. Returns the fresh booking.
 */
export async function syncPayment(
  user: PublicUser,
  code: string,
  now: Date = new Date(),
  opts: ProviderOpts = {},
): Promise<Booking> {
  const provider = opts.provider ?? getPaymentProvider();
  await getMyBooking(user, code, now); // 404 when it isn't theirs
  const payment = await prisma.payment.findFirst({
    where: { booking: { code, userId: user.id }, status: "PENDING", providerRef: { not: null } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { providerRef: true },
  });
  if (payment?.providerRef) {
    const intent = await provider.getIntent(payment.providerRef);
    if (intent.status !== "pending") {
      await settlePayment(payment.providerRef, intent.status === "succeeded" ? "SUCCEEDED" : "FAILED", now, {
        provider,
      });
    }
  }
  return getMyBooking(user, code, now);
}
