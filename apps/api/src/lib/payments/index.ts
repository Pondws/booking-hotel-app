import { env } from "../../env";
import { MockProvider } from "./mock-provider";
import type { PaymentProvider } from "./provider";
import { StripeProvider } from "./stripe-provider";

export type { PaymentProvider } from "./provider";

let provider: PaymentProvider | undefined;

/** The process-wide provider chosen by `PAYMENT_PROVIDER` (env validation guarantees the Stripe keys). */
export function getPaymentProvider(): PaymentProvider {
  if (!provider) {
    provider =
      env.PAYMENT_PROVIDER === "mock"
        ? new MockProvider()
        : new StripeProvider(env.STRIPE_SECRET_KEY ?? "", env.STRIPE_WEBHOOK_SECRET ?? "");
  }
  return provider;
}
