# Payments (Phase 5) — Design

Date: 2026-11-15
Status: Approach picked in chat (Stripe Payment Element, cards only); builder check done — awaiting user review
Roadmap: `PLAN.md` Phase 5 · Branch: `feat/payments` · Builds on Phase 4 (`2026-11-12-booking-flow-design.md`)

## Intent

A booking becomes `CONFIRMED` **only** once it has been paid. In Phase 4 a customer gets a 15-minute `PENDING`
hold that simply expires. Phase 5 lets them pay that hold with **Stripe (test mode)** through an embedded Payment
Element on the booking detail page, and refunds the full amount when they cancel a paid booking. Card data never
touches our servers.

## Goals

- `POST /api/bookings/:code/payments` creates (or reuses) a Stripe PaymentIntent for `Booking.totalAmount` and
  returns its `clientSecret`; the browser confirms it with Stripe.
- Stripe's webhook (`payment_intent.succeeded`) is the source of truth: the `Payment` → `SUCCEEDED` and the
  `Booking` → `CONFIRMED` (`expiresAt` cleared) in one transaction.
- A declined card stays on the form with Stripe's message; the customer retries while the hold lasts.
- Paying an `EXPIRED` / `CANCELLED` / `CONFIRMED` / `COMPLETED` booking → `409`.
- A success that arrives after the hold lapsed is refunded automatically; the booking is never confirmed.
- Cancelling a `CONFIRMED` booking refunds in full (`Payment` → `REFUNDED`).
- A booking is never charged twice (concurrent requests, repeated webhooks, sync + webhook racing).
- `npm test` runs offline against a `MockProvider` behind the same interface.

## Non-goals

- Stripe Checkout / redirect-only flows (approach B, rejected), saved cards, Customers, receipts by email.
- Partial refunds or tiered cancellation policy.
- A background job: lazy expiry at request time (Phase 4) stays; late successes are refunded on arrival.
- Admin payment views: web-admin has no booking pages yet → move "admin sees payment status" to **Phase 6**.
- Other currencies or a live-mode launch (Phase 8 decides keys / account setup).

## Anti-goals (failure even if it "works")

- A booking that is `CONFIRMED` without a `SUCCEEDED` payment, or a succeeded charge on an unconfirmed booking
  that is never refunded (except the logged reconciliation case below).
- Card numbers, `STRIPE_SECRET_KEY` or the webhook secret appearing in the API, logs, DB, or the web bundle.
- Trusting the browser about payment outcome or amount: the API only believes Stripe (webhook signature or a
  server-side PaymentIntent retrieve).
- The mock provider being usable in production.

## Decisions

| Topic | Decision |
| --- | --- |
| Approach | **Stripe Payment Element** embedded on `/account/bookings/[code]` (picked in chat). See Approaches |
| Dependencies | `stripe` (api), `@stripe/stripe-js` + `@stripe/react-stripe-js` (web) — approved in chat. Pin current versions |
| Refund policy | **Full refund** whenever the booking is cancellable (before the check-in day). PLAN.md decision #5 settled |
| Gateway | Stripe, test mode, THB, **Thai account**. PLAN.md decision #6 settled |
| Payment methods | **Cards only**: `paymentIntents.create({ payment_method_types: ["card"] })` so PromptPay (auto-enabled for TH/THB) never appears. "Pending" just means "not finished yet" |
| Keys | User has no keys yet. Build + `npm test` run on `MockProvider`; browser verification of the Stripe flow waits until the user adds `pk_test`/`sk_test`/`whsec` to their own `.env` files (never shared in chat). Until then local `.env` uses `PAYMENT_PROVIDER=mock` so the API still boots, and the web pay card shows "Payments aren't configured" when `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is missing *(my call)* |
| Provider selection | `PAYMENT_PROVIDER` = `stripe` \| `mock` (default `stripe`); `.env.test` sets `mock`. Env validation: `mock` rejected when `NODE_ENV=production`; `STRIPE_SECRET_KEY` (`sk_test_…`/`sk_live_…`) and `STRIPE_WEBHOOK_SECRET` (`whsec_…`) required when `stripe` |
| Web env | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_…`) in `apps/web/.env.local` + `.env.example` |
| Amount | Always `booking.totalAmount` / `booking.currency` from the DB. Converted to Stripe minor units (THB satang, ×100) by one helper in `lib/`, Decimal-safe. Stripe's THB minimum (฿10) is not pre-checked; a Stripe error there surfaces as 500 *(seeded prices are far above it)* |
| One payment per attempt | New partial unique index `payments_one_active_per_booking` on `payments(booking_id) WHERE status IN ('PENDING','SUCCEEDED')` (raw SQL in the migration, documented on the model like `bookings_no_overlap`; `constraints.sql` cases added) |
| Reuse | While the booking is payable, `POST …/payments` returns the existing `PENDING` payment's PaymentIntent `clientSecret` (retrieved from Stripe) instead of creating another. A declined card leaves the PaymentIntent `requires_payment_method` → same intent is retried, payment row stays `PENDING` |
| Stripe idempotency | `paymentIntents.create` uses `idempotencyKey = payment.id` and `metadata = { bookingCode, paymentId }` |
| Settling | `settlePayment(providerRef, outcome, now)` is the **only** function that moves a payment out of `PENDING` and owns the booking side. **Claim the payment row first**, then touch the booking, so two settlers (sync + webhook) can never both act: in one `$transaction`, `updateMany payments WHERE providerRef, status PENDING → SUCCEEDED, paidAt` — counted 0 → someone else settled, no-op. Counted 1 → booking `updateMany WHERE id, status PENDING, expiresAt > now → CONFIRMED, expiresAt null`; if that counted 0 (hold lapsed / cancelled) the payment is marked `REFUNDING`-intent by leaving it `SUCCEEDED` and the transaction commits. **After commit**, the refund runs outside the transaction: `provider.refund(ref, { idempotencyKey: "refund-" + payment.id })` → payment `REFUNDED` + `refundedAt`. A Stripe "already refunded" answer counts as success, so webhook retries can't loop. `FAILED` → payment only. Verifies the intent's amount/currency equal the row's before claiming (mismatch → log + leave PENDING) *(revised after builder check)* |
| Refund state | Payment → `REFUNDED` as soon as `refunds.create` returns (even `pending`). No `refund.updated` webhook in Phase 5 — fine for test mode; revisit before live mode *(my call)* |
| Settle-on-reuse | A reloaded payment whose `providerRef` is still null (concurrent start) → `createIntent` again with the same idempotency key (Stripe returns the same intent). A reused payment whose intent already succeeded/cancelled → settle it first, don't hand back its secret *(my calls)* |
| Webhook | `POST /api/webhooks/stripe`, mounted in `app.ts` **before** `express.json()` with `express.raw({ type: "application/json" })`; verified by `stripe.webhooks.constructEvent` → bad signature `400`. Handles `payment_intent.succeeded` → `SUCCEEDED`, `payment_intent.canceled` → `FAILED`; other events `200` ignored. Unknown `providerRef` → `200` + log. DB/Stripe errors → `500` so Stripe retries. No session / CORS needed (server-to-server); route → controller → service as usual |
| Sync endpoint | `POST /api/bookings/:code/payments/sync` (owner only): retrieves the booking's latest `PENDING` payment intent from Stripe server-side and calls `settlePayment` if it `succeeded`/`canceled`; returns the `Booking`. Lets the page confirm immediately and keeps local dev working when `stripe listen` isn't running. The webhook still covers closed tabs *(my call)* |
| Lapsed hold, open intent | Lazy expiry stays DB-only (no Stripe calls inside `updateMany`). The form disappears at 00:00; if the customer still completes the intent, the late success is refunded by `settlePayment` |
| Cancel | Conditional cancel (`updateMany`, as today) first. Then: `SUCCEEDED` payment → `provider.refund` (Stripe `refunds.create({ payment_intent })`) → payment `REFUNDED` + `refundedAt`; `PENDING` payment → `provider.cancel` (cancel the PaymentIntent) → payment `FAILED`. If the Stripe call throws, the booking stays `CANCELLED`, the payment row unchanged, error logged with the booking code (reconciliation), customer still gets `200` |
| Refund timestamp | Migration adds `Payment.refundedAt DateTime?` (additive, nullable) |
| Edge rows | `PENDING` booking with `expiresAt = null` → not payable. Cancelling a `CONFIRMED` booking with no `SUCCEEDED` payment (legacy/test rows) → no refund call *(my calls)* |
| Booking shape | `bookingSchema` gains `payable: boolean` (effective `PENDING`, `expiresAt > now`) and `payment: { status, paidAt, refundedAt } \| null` (latest payment by `createdAt`). Additive — envelope unchanged |
| Responses | `POST …/payments` → `201 { data: { clientSecret } }` (also when reusing). `POST …/payments/sync` → `200 { data: Booking }`. Not payable → `409 CONFLICT` "This booking can't be paid". Not yours → `404` |
| CORS / auth | Customer endpoints live under `/api/bookings/*` → existing `WEB_ORIGINS` rule, `loadSession("WEB")` + `requireAuth`. Webhook path `/api/webhooks/*` needs no CORS change (no browser caller) |
| Local dev | Stripe CLI: `stripe listen --forward-to localhost:8000/api/webhooks/stripe` prints the `whsec_…` for `.env`. Documented in README; optional thanks to the sync endpoint |
| Error codes | No new code needed (declines are shown client-side by Stripe.js) |

## Approaches

- **A. Payment Element (picked).** Card form embedded on our page next to the 15-minute countdown; 3 deps; Stripe
  handles 3-D Secure; webhook + sync confirm.
- **B. Stripe Checkout (rejected).** One dep and a plain redirect, but a Checkout Session can't expire sooner than
  30 minutes, which clashes with the 15-minute hold (either raise `HOLD_MINUTES` or accept routine late refunds).
- **Mock-only (dropped).** The earlier plan; the user chose to integrate Stripe now. The mock survives as the test provider.

## API

### `PaymentProvider` (`apps/api/src/lib/payments/`)

```ts
interface PaymentProvider {
  name: "stripe" | "mock";                                     // stored in Payment.provider
  createIntent(i: { amountMinor: number; currency: string; idempotencyKey: string;
                    metadata: Record<string, string> }): Promise<{ providerRef: string; clientSecret: string }>;
  getIntent(providerRef: string): Promise<{ status: "succeeded" | "canceled" | "pending";
                                            amountMinor: number; currency: string; clientSecret: string }>;
  cancelIntent(providerRef: string): Promise<void>;
  refund(providerRef: string, opts: { idempotencyKey: string }): Promise<void>;   // "already refunded" = success
  parseWebhook(rawBody: Buffer, signature: string | undefined):
    { type: "succeeded" | "canceled" | "ignored"; providerRef?: string };   // throws on bad signature
}
```
`StripeProvider` wraps the SDK; `MockProvider` keeps intents in memory and exposes test helpers
(`succeed(ref)`, `cancel(ref)`, a fixed webhook signature). `getPaymentProvider()` picks by env; services take an
injectable provider (same `opts` pattern as `createBooking`).

### `payment.service.ts`

- `startPayment(user, code, now, opts?)`: expire lapsed holds → load (`404` not theirs) → not payable `409` →
  existing `PENDING` payment? return its `clientSecret` : insert `Payment { PENDING, amount, currency, provider }`
  (`P2002` from the partial index → reload and reuse) → `createIntent` → store `providerRef` → return
  `clientSecret`. `createIntent` throws → payment `FAILED`, rethrow (500).
- `syncPayment(user, code, now, opts?)`: owner check → latest `PENDING` payment → `getIntent` → `settlePayment`
  when terminal → return `Booking`.
- `handleWebhook(rawBody, signature, now, opts?)` → `settlePayment`.
- `settlePayment(...)` as in Decisions. `cancelMyBooking` gains the refund / cancel-intent step. `toBooking` gains
  `payable` / `payment`; `bookingSelect` adds the latest payment.

### Tests (TDD, `node:test`, `MockProvider`)

Start → 201 + clientSecret; second start reuses the same intent; two concurrent starts → one payment row, same
secret; start on expired / cancelled / confirmed → 409; other user → 404; unauthenticated → 401. Webhook: bad
signature → 400; succeeded → CONFIRMED + SUCCEEDED; repeated → no-op; succeeded after hold lapsed → REFUNDED,
booking not confirmed; amount mismatch → stays PENDING; canceled → FAILED; unknown ref → 200. Sync: succeeded →
CONFIRMED; sync + webhook both → one settlement. Cancel CONFIRMED → REFUNDED + `refundedAt`; cancel PENDING with
open intent → intent cancelled, payment FAILED. Minor-unit helper unit test. `constraints.sql`: second
PENDING/SUCCEEDED payment on one booking rejected; FAILED/REFUNDED don't block.

## Web (`apps/web/src/features/payments/` or inside `bookings/`)

- Booking detail, when `booking.payable`: "Pay {total}" card under the countdown. `useStartPayment(code)` gets the
  `clientSecret`; render `<Elements stripe={loadStripe(pk)} options={{ clientSecret, appearance }}>` +
  `<PaymentElement>`; appearance maps to theme tokens from `DESIGN.md` where Stripe allows. A "Test mode — card
  4242 4242 4242 4242, any future date, any CVC" note.
- Submit: `stripe.confirmPayment({ elements, redirect: "if_required", confirmParams: { return_url: <detail URL> } })`.
  Error (declined, invalid) → inline message, form stays. Success → `useSyncPayment(code)` → set
  `bookingKeys.detail(code)`, invalidate list; if still not `CONFIRMED`, refetch the booking every 2 s for up to
  ~30 s with a "Confirming payment…" state, then a "Still processing — refresh later" message.
- 3-D Secure redirect return (`?payment_intent=…&redirect_status=…` on the detail URL): run the same sync on load.
- Form hidden when the countdown hits 00:00 (existing refetch then shows EXPIRED). `409` on start → refetch booking.
- Confirmed: "Paid on {date}" replaces the form. Cancel dialog for a paid booking: "You'll get a full refund of
  {total}"; detail shows "Refunded on {date}" when `payment.status === "REFUNDED"`.
- Loading / error states for start, the Element mounting, and sync. Follow `DESIGN.md`.

## Left to the builder

File split inside `features/`, exact copy, component layout, Stripe `appearance` details, mock intent id format,
polling implementation (TanStack `refetchInterval`), how tests sign mock webhooks, whether any shadcn component
needs `ui:add`.

## Docs to update at the end

`PLAN.md` (Phase 5 status, decisions #5/#6, move admin payment view to Phase 6), `README.md` (endpoints, Stripe
CLI, test cards), `CLAUDE.md` (payments feature, webhook route, env vars), `.env.example` files (api + web).
