import { randomBytes } from "node:crypto";
import { AppError } from "../app-error";
import type { CreateIntentInput, Intent, IntentStatus, PaymentProvider, WebhookEvent } from "./provider";

/** The only `stripe-signature` value the mock accepts. */
export const MOCK_WEBHOOK_SIGNATURE = "mock-signature";

type MockIntent = { status: IntentStatus; amountMinor: number; currency: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/**
 * In-memory provider for `npm test` (and local dev without Stripe keys). Env validation forbids it in
 * production. Webhook body: `{ "type": "payment_intent.succeeded", "providerRef": "mock_pi_1" }`.
 */
export class MockProvider implements PaymentProvider {
  readonly name = "mock" as const;
  /** Refs actually refunded (once each) / intents cancelled via `cancelIntent`. */
  readonly refunds: string[] = [];
  readonly cancelled: string[] = [];
  /** When true, the next `refund()` rejects once. */
  failNextRefund = false;

  private seq = 0;
  /** Per-instance, so parallel test processes never collide on the unique `providerRef`. */
  private readonly prefix = randomBytes(6).toString("hex");
  private readonly intents = new Map<string, MockIntent>();
  private readonly byKey = new Map<string, string>();

  async createIntent(input: CreateIntentInput): Promise<{ providerRef: string; clientSecret: string }> {
    let ref = this.byKey.get(input.idempotencyKey);
    if (!ref) {
      ref = `mock_pi_${this.prefix}_${++this.seq}`;
      this.byKey.set(input.idempotencyKey, ref);
      this.intents.set(ref, { status: "pending", amountMinor: input.amountMinor, currency: input.currency });
    }
    return { providerRef: ref, clientSecret: secretOf(ref) };
  }

  async getIntent(ref: string): Promise<Intent> {
    const intent = this.intent(ref);
    return { ...intent, clientSecret: secretOf(ref) };
  }

  async cancelIntent(ref: string): Promise<void> {
    this.intent(ref).status = "canceled";
    this.cancelled.push(ref);
  }

  async refund(ref: string, _opts: { idempotencyKey: string }): Promise<void> {
    if (this.failNextRefund) {
      this.failNextRefund = false;
      throw new Error(`mock refund failed for ${ref}`);
    }
    if (!this.refunds.includes(ref)) this.refunds.push(ref);
  }

  parseWebhook(rawBody: Buffer, signature: string | undefined): WebhookEvent {
    if (signature !== MOCK_WEBHOOK_SIGNATURE) {
      throw new AppError(400, "VALIDATION_FAILED", "Invalid webhook signature");
    }
    let event: unknown;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new AppError(400, "VALIDATION_FAILED", "Webhook body is not JSON");
    }
    if (!isRecord(event) || typeof event.providerRef !== "string") return { type: "ignored" };
    if (event.type === "payment_intent.succeeded") return { type: "succeeded", providerRef: event.providerRef };
    if (event.type === "payment_intent.canceled") return { type: "canceled", providerRef: event.providerRef };
    return { type: "ignored" };
  }

  // Test helpers.
  succeed(ref: string): void {
    this.intent(ref).status = "succeeded";
  }
  cancel(ref: string): void {
    this.intent(ref).status = "canceled";
  }
  setAmount(ref: string, amountMinor: number): void {
    this.intent(ref).amountMinor = amountMinor;
  }

  private intent(ref: string): MockIntent {
    const intent = this.intents.get(ref);
    if (!intent) throw new Error(`Unknown mock intent ${ref}`);
    return intent;
  }
}

const secretOf = (ref: string) => `${ref}_secret`;
