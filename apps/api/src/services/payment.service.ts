import { prisma } from "../lib/prisma";
import { getPaymentProvider, type PaymentProvider } from "../lib/payments";

export type SettleOutcome = "SUCCEEDED" | "FAILED";
export type SettleResult = "confirmed" | "refunded" | "failed" | "noop";

type ProviderOpts = { provider?: PaymentProvider };

/**
 * The only function that moves a payment out of PENDING (booking cancel excepted) and owns the
 * booking side of it. It claims the payment row first (`updateMany … WHERE status PENDING`), so two
 * settlers — the webhook and the sync endpoint — can never both act on one intent.
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
    select: { id: true, bookingId: true },
  });
  if (!payment) {
    console.warn(`settlePayment: no payment for ${provider.name} ref ${providerRef}`);
    return "noop";
  }

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: outcome, paidAt: outcome === "SUCCEEDED" ? now : null },
    });
    if (claimed.count === 0) return "noop";
    if (outcome === "FAILED") return "failed";

    const confirmed = await tx.booking.updateMany({
      where: { id: payment.bookingId, status: "PENDING", expiresAt: { gt: now } },
      data: { status: "CONFIRMED", expiresAt: null },
    });
    return confirmed.count === 1 ? "confirmed" : "noop";
  });
}
