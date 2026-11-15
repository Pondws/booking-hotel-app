import Stripe from "stripe";
import { AppError } from "../app-error";
import type { CreateIntentInput, Intent, IntentStatus, PaymentProvider, WebhookEvent } from "./provider";

const toStatus = (s: Stripe.PaymentIntent.Status): IntentStatus =>
  s === "succeeded" ? "succeeded" : s === "canceled" ? "canceled" : "pending";

/**
 * Thin wrapper over the Stripe SDK. Cards only (`allowed_payment_method_types` — the SDK v23 name for the
 * old `payment_method_types`), so PromptPay (auto-enabled for TH/THB) never appears.
 */
export class StripeProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  private readonly stripe: Stripe;

  constructor(
    secretKey: string,
    private readonly webhookSecret: string,
  ) {
    this.stripe = new Stripe(secretKey);
  }

  async createIntent(input: CreateIntentInput): Promise<{ providerRef: string; clientSecret: string }> {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: input.amountMinor,
        currency: input.currency.toLowerCase(),
        allowed_payment_method_types: ["card"],
        metadata: input.metadata,
      },
      { idempotencyKey: input.idempotencyKey },
    );
    return { providerRef: intent.id, clientSecret: secretOf(intent) };
  }

  async getIntent(ref: string): Promise<Intent> {
    const intent = await this.stripe.paymentIntents.retrieve(ref);
    return {
      status: toStatus(intent.status),
      amountMinor: intent.amount,
      currency: intent.currency.toUpperCase(),
      clientSecret: secretOf(intent),
    };
  }

  async cancelIntent(ref: string): Promise<void> {
    await this.stripe.paymentIntents.cancel(ref);
  }

  async refund(ref: string, opts: { idempotencyKey: string }): Promise<void> {
    try {
      await this.stripe.refunds.create({ payment_intent: ref }, { idempotencyKey: opts.idempotencyKey });
    } catch (err) {
      if (err instanceof Stripe.errors.StripeError && err.code === "charge_already_refunded") return;
      throw err;
    }
  }

  parseWebhook(rawBody: Buffer, signature: string | undefined): WebhookEvent {
    let event: Stripe.Event;
    try {
      if (!signature) throw new Error("missing signature");
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      throw new AppError(400, "VALIDATION_FAILED", "Invalid webhook signature");
    }
    if (event.type === "payment_intent.succeeded") return { type: "succeeded", providerRef: event.data.object.id };
    if (event.type === "payment_intent.canceled") return { type: "canceled", providerRef: event.data.object.id };
    return { type: "ignored" };
  }
}

function secretOf(intent: Stripe.PaymentIntent): string {
  if (!intent.client_secret) throw new Error(`PaymentIntent ${intent.id} has no client_secret`);
  return intent.client_secret;
}
