import { loadStripe, type Stripe } from "@stripe/stripe-js";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

/** Loaded once per page; `null` when the publishable key isn't configured ("Payments aren't configured"). */
export const stripePromise: Promise<Stripe | null> | null = publishableKey ? loadStripe(publishableKey) : null;
