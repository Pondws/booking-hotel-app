/** Provider-neutral intent status: anything not finished yet is `pending`. */
export type IntentStatus = "succeeded" | "canceled" | "pending";

export type WebhookEvent = { type: "succeeded" | "canceled" | "ignored"; providerRef?: string };

export type CreateIntentInput = {
  /** Integer minor units (THB satang). */
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
};

export type Intent = { status: IntentStatus; amountMinor: number; currency: string; clientSecret: string };

/** The only seam between payment.service and a payment gateway (Stripe in dev/prod, a mock in tests). */
export interface PaymentProvider {
  /** Stored in `Payment.provider`. */
  readonly name: "stripe" | "mock";
  createIntent(input: CreateIntentInput): Promise<{ providerRef: string; clientSecret: string }>;
  getIntent(ref: string): Promise<Intent>;
  cancelIntent(ref: string): Promise<void>;
  /** Full refund. "Already refunded" counts as success. */
  refund(ref: string, opts: { idempotencyKey: string }): Promise<void>;
  /** Verifies the signature (throws `AppError(400)` when bad) and maps the event. */
  parseWebhook(rawBody: Buffer, signature: string | undefined): WebhookEvent;
}
