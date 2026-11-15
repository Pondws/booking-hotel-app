import assert from "node:assert/strict";
import { test } from "node:test";
import Stripe from "stripe";
import { AppError } from "../app-error";
import { StripeProvider } from "./stripe-provider";

// Offline: only webhook signature verification is exercised (no API calls).
const SECRET = "whsec_test_offline";
const provider = new StripeProvider("sk_test_offline", SECRET);
const sign = (payload: string) => Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
const event = (type: string) =>
  JSON.stringify({ id: "evt_1", object: "event", type, data: { object: { id: "pi_123", object: "payment_intent" } } });

test("stripe parseWebhook maps a signed payment_intent.succeeded", () => {
  const payload = event("payment_intent.succeeded");
  assert.deepEqual(provider.parseWebhook(Buffer.from(payload), sign(payload)), {
    type: "succeeded",
    providerRef: "pi_123",
  });
});

test("stripe parseWebhook ignores other signed events", () => {
  const payload = event("charge.updated");
  assert.deepEqual(provider.parseWebhook(Buffer.from(payload), sign(payload)), { type: "ignored" });
});

test("stripe parseWebhook rejects bad or missing signatures with AppError 400", () => {
  const payload = event("payment_intent.succeeded");
  for (const sig of [undefined, "t=1,v1=deadbeef", sign(payload.replace("pi_123", "pi_999"))]) {
    assert.throws(
      () => provider.parseWebhook(Buffer.from(payload), sig),
      (err: unknown) => err instanceof AppError && err.status === 400,
    );
  }
});
