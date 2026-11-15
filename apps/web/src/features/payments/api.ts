import { bookingSchema, startPaymentSchema, type Booking, type StartPayment } from "@booking/shared";
import { request } from "@/lib/api";

const paymentsUrl = (code: string) => `/api/bookings/${encodeURIComponent(code)}/payments`;

/** Creates (or reuses) the booking's PaymentIntent and returns its client secret. */
export function startPayment(code: string): Promise<StartPayment> {
  return request(startPaymentSchema, { method: "POST", url: paymentsUrl(code) });
}

/** Asks the API to check the intent with Stripe and settle it; returns the fresh booking. */
export function syncPayment(code: string): Promise<Booking> {
  return request(bookingSchema, { method: "POST", url: `${paymentsUrl(code)}/sync` });
}
