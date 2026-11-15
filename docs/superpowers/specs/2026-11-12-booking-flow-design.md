# Booking Flow (Phase 4) — Design

Date: 2026-11-12
Status: Approved in chat (4 sections), awaiting written-spec review
Roadmap: `PLAN.md` Phase 4 · Branch: `feat/booking` · Builds on Phase 3 (`2026-11-12-catalog-availability-design.md`)

## Goal

A signed-in customer on `apps/web` picks dates on a hotel page, opens a booking page with the API's live
quote, fills in guest details and gets a **15-minute room hold** (a `PENDING` booking with a code). They can
see their bookings, watch the hold count down, and cancel. A room is **never** double-booked, including
when two customers race for the last room. Payment (→ `CONFIRMED`) is Phase 5; in Phase 4 an unpaid hold
simply expires.

## Decisions

| Topic | Decision |
| --- | --- |
| Phase 4 end state | **Hold only.** Bookings are created `PENDING` and expire if unpaid. No temporary "confirm" step. |
| Hold time | `HOLD_MINUTES = 15` constant in `@booking/shared` (PLAN.md decision #4 — confirmed) |
| When the hold starts | On guest-form submit (`POST /api/bookings`), not on the "Book" click |
| Active-hold cap | `MAX_ACTIVE_HOLDS = 3` unexpired `PENDING` bookings per user → else 409 `CONFLICT`. Soft limit (two simultaneous requests may reach 4) |
| Cancel rule | Status `PENDING` (unexpired) or `CONFIRMED`, **and** `todayIn(BOOKING_TZ) < checkIn`. Refund rules: Phase 5 (decision #5 partly settled) |
| Error codes | Add `ROOM_UNAVAILABLE` (409, no room left for the dates). Cancel not allowed / cap → existing 409 `CONFLICT` |
| Expiry | Lazy, at request time: stale `PENDING` (`expiresAt < now`) → `EXPIRED` before creating (per room type) and before reads (per user). No background job (Phase 5) |
| Double-booking guard | The existing DB constraint `bookings_no_overlap` (`EXCLUDE … WHERE status IN ('PENDING','CONFIRMED')`) is the source of truth. It also counts **expired** `PENDING` rows — hence the expire step |
| Room choice | Customer books a room *type*; the API assigns the first free active `Room` by `number`. Room number is never exposed |
| Booking code | `BK` + 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `0 O 1 I`), `crypto.randomInt`; regenerate on `P2002`, max 5 tries |
| Status in responses | Always the effective status (stale `PENDING` is reported — and stored — as `EXPIRED`) plus a computed `cancellable` |
| CORS | `/api/bookings/*` → `WEB_ORIGINS` only (new prefix rule in `lib/cors-policy.ts`) |
| Auth | `bookingsRouter` guarded once by `loadSession("WEB")` + `requireAuth`; `admin_sid` alone → 401 |
| Not-yours | `GET`/cancel of another user's booking → **404** `"Booking not found"` (never 403) |
| Migration | **None.** `Booking` already has `code @unique`, `expiresAt`, `cancelledAt`, `totalAmount Decimal`, indexes |
| New UI component | `npm run ui:add -- alert-dialog` (radix-ui already present; no new npm package) |
| Out of scope | Payment, editing a booking, email, admin booking views (Phase 6), rate limiting beyond the cap, background expiry |

## Contracts (`packages/shared`)

```ts
export const HOLD_MINUTES = 15;
export const MAX_ACTIVE_HOLDS = 3;

// errorCodeSchema gains "ROOM_UNAVAILABLE"

export const createBookingSchema = z
  .object({
    roomTypeId: z.string().min(1),
    checkIn: isoDate,
    checkOut: isoDate,
    guests: guestsField,                                   // "Enter 1 to 20 guests"
    guestName: z.string().trim().min(1).max(120).optional(),
    guestEmail: emailField.optional(),                     // existing: trim → lowercase → pipe(z.email())
    guestPhone: z.string().trim().min(1).max(30).optional(),
  })
  .superRefine((v, ctx) => refineStay(ctx, v.checkIn, v.checkOut));   // Phase 3 rules, verbatim messages

export const bookingStatusSchema = z.enum(["PENDING", "CONFIRMED", "CANCELLED", "EXPIRED", "COMPLETED"]);

export const bookingSchema = z.object({
  code: z.string(),
  status: bookingStatusSchema,
  checkIn: isoDate,
  checkOut: isoDate,
  nights: z.number().int().min(1),
  guests: z.number().int().min(1),
  guestName: z.string(),
  guestEmail: z.string(),
  guestPhone: z.string().nullable(),
  totalAmount: z.number(),
  currency: z.string(),
  expiresAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  cancellable: z.boolean(),
  hotel: z.object({ name: z.string(), slug: z.string(), city: z.string(), coverImage: imageSchema.nullable() }),
  roomType: z.object({ id: z.string(), name: z.string() }),
});
export type Booking = z.infer<typeof bookingSchema>;

export const bookingListSchema = paginated(bookingSchema);
export const bookingListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export const bookingCodeParamsSchema = z.object({ code: z.string().regex(/^BK[A-HJ-NP-Z2-9]{6}$/) });
```

A malformed `:code` fails validation → 400 `VALIDATION_FAILED`; a well-formed unknown one → 404.

## Endpoints

| Method | Path | Request | Success | Errors |
| --- | --- | --- | --- | --- |
| POST | `/api/bookings` | body `createBookingSchema` | 201 `booking` | 400, 401, 404 `"Room type not found"`, 409 `CONFLICT` (cap), 409 `ROOM_UNAVAILABLE` |
| GET | `/api/bookings/me` | query `bookingListQuerySchema` | 200 `paginated(booking)`, `createdAt desc, id desc` | 400, 401 |
| GET | `/api/bookings/:code` | params `bookingCodeParamsSchema` | 200 `booking` | 400, 401, 404 `"Booking not found"` |
| POST | `/api/bookings/:code/cancel` | params | 200 `booking` | 400, 401, 404, 409 `CONFLICT` `"This booking can't be cancelled"` |

Messages (verbatim): `"Room type not found"`, `"Booking not found"`, `"This booking can't be cancelled"`,
`"This room was just booked for these dates"`, `` `You have ${MAX_ACTIVE_HOLDS} bookings waiting for payment` ``,
`"This room sleeps N guests"` (field error on `guests`, N = capacity).

`/api/bookings/me` is registered before `/:code` (`me` also fails the code regex, so order is belt-and-braces).

---

## Tasks

Each task ends with `npm run lint && npm run typecheck && npm test` green, then commit and push on
`feat/booking`. Test fixtures: hotels named `Bk Test <ts> …`, users `bk-test+<ts>@test.local`; delete in
`after()` in reverse FK order (bookings → rate periods → rooms → room types → images/amenities → hotels →
sessions → users). Seed rows are read-only.

### Task 1 — Shared contracts

**Scope:** `packages/shared/src/index.ts`; `apps/api/src/lib/shared-schemas.test.ts`.

- Add `HOLD_MINUTES`, `MAX_ACTIVE_HOLDS`, `ROOM_UNAVAILABLE`, `bookingStatusSchema`, `bookingSchema`,
  `bookingListSchema`, `bookingListQuerySchema`, `bookingCodeParamsSchema` (above).
- Rebuild `createBookingSchema` on `refineStay` + `guestsField`. Existing tests "booking rejects zero nights
  and reversed dates on checkOut" / "booking rejects non-date strings and guests < 1" are updated to the new
  messages; "booking dates stay as the same calendar day strings" keeps passing (use future dates).

**Tests:** past check-in → `"Check-in can't be in the past"`; 31 nights → `"Stays are limited to 30 nights"`;
`guestEmail: " A@B.COM "` → `"a@b.com"`; empty `guestName` rejected; `bookingSchema` parses a sample;
`bookingCodeParamsSchema` accepts `BK7QX2MA`, rejects `BK0OOOOO`, `bk7qx2ma`, `me`; `errorCodeSchema` has
`ROOM_UNAVAILABLE`.

**Done when:** schema tests pass; web/web-admin typecheck (nothing consumes the new types yet).

### Task 2 — Exclusion-violation detection and booking codes

**Scope:** `apps/api/src/lib/prisma-errors.ts` (+ test), new `apps/api/src/lib/booking-code.ts` (+ test).

- `isExclusionViolation(err: unknown, constraint = "bookings_no_overlap"): boolean` — true only for Postgres
  `23P01` on that constraint as surfaced by Prisma 7 + `PrismaPg`. **First step: write a DB test that inserts
  two overlapping `PENDING` bookings on one room and inspects the thrown error**, then implement the narrowing
  from what is observed (no casts; `unknown` + type guards).
- `generateBookingCode(random = crypto.randomInt): string` → `BK` + 6 chars from the alphabet.

**Tests:** overlapping insert → `true`; unique violation on `code` → `false`; plain `Error` → `false`;
`generateBookingCode` matches `bookingCodeParamsSchema` 1,000 times; an injected `random` gives a fixed code.

**Done when:** the real-DB test proves detection; no `any`.

### Task 3 — `createBooking` service + concurrency

**Scope:** new `apps/api/src/services/booking.service.ts` (+ test).

`createBooking(user: PublicUser, input: CreateBookingData, now = new Date()): Promise<Booking>`:

1. Load room type (`isActive`, hotel `isActive`) with hotel (name, slug, city, currency, cover image) — else
   404 `"Room type not found"`. `guests > capacity` → `AppError(400, "VALIDATION_FAILED", …)` with
   `details = { formErrors: [], fieldErrors: { guests: ["This room sleeps N guests"] } }` — the same
   `z.flattenError` shape the error handler emits for zod, so `applyServerFieldErrors` handles both.
2. `updateMany` bookings `{ status: PENDING, expiresAt: { lt: now }, room: { roomTypeId } }` → `EXPIRED`.
3. Count user's `PENDING` with `expiresAt > now`; `>= MAX_ACTIVE_HOLDS` → 409 `CONFLICT`
   `"You have 3 bookings waiting for payment"`.
4. `quoteStay(roomTypeId, checkIn, checkOut)` (Phase 3) → `totalAmount` (Decimal), `currency`.
5. Candidates: active rooms of the type with `bookings: { none: blockingBookingWhere(range, now) }`, ordered
   by `number`. For each: `prisma.booking.create` (`PENDING`, `expiresAt = now + HOLD_MINUTES`, code from
   `generateBookingCode`, guest fields defaulting to `user.name` / `user.email`).
   - `isExclusionViolation` → next room.
   - `isUniqueViolationOn(err, "code")` → regenerate, same room, ≤ 5 attempts total per room.
   - Anything else → rethrow.
6. No candidate succeeded → 409 `ROOM_UNAVAILABLE` `"This room was just booked for these dates"`.
7. Return `toBooking(row, now)` — the single mapper (Decimal `.toNumber()`, dates via `lib/dates.ts`,
   `nights`, `cancellable`, effective status).

No wrapping `$transaction`: Postgres aborts a transaction on the first error, so "catch `23P01`, try the next
room" requires separate single-statement inserts; each is atomic and the DB constraint decides.

**Tests (service level, real DB):**
- Creates `PENDING`, `expiresAt === now + 15 min`, `totalAmount === quoteStay().total`, guest defaults.
- Explicit guest fields are kept.
- Stale `PENDING` on the only room is flipped to `EXPIRED` and the new booking gets that room.
- Back-to-back: existing `[d10, d12)` on the only room does not block `[d12, d14)`.
- `guests > capacity` → 400 with the field error; inactive room type / inactive hotel → 404.
- 4th active hold → 409 `CONFLICT`; a user with 3 *expired* holds can still book.
- **Concurrency (×5 iterations):** one free room, two `Promise.all` calls → exactly one success and one
  `ROOM_UNAVAILABLE`; DB has exactly one blocking booking for the range.
- **Retry path (×5):** two free rooms, two parallel calls → two successes on different `roomId`s.
- Code collision: inject a generator returning an existing code first → booking still created with a new code.

**Done when:** all pass 5/5 iterations in one `npm test` run.

### Task 4 — Reads, cancel, routes, CORS, DB checks

**Scope:** `booking.service.ts` (+ `listMyBookings`, `getMyBooking`, `cancelMyBooking`),
new `controllers/booking.controller.ts`, new `routes/bookings.ts`, `app.ts` (mount), `lib/cors-policy.ts`
(+ test), `prisma/checks/constraints.sql`; test `routes/bookings.test.ts`.

- Reads first run `updateMany` stale `PENDING` → `EXPIRED` for **this user**, then query
  `{ userId, … }`; `getMyBooking` with someone else's code → 404.
- `cancelMyBooking(user, code, now)`: one `updateMany` where `{ code, userId, checkIn: { gt: todayAsDbDate },
  OR: [{ status: CONFIRMED }, { status: PENDING, expiresAt: { gt: now } }] }` → `CANCELLED`,
  `cancelledAt = now`. `count === 0` → 404 if the code isn't the user's, else 409 `CONFLICT`. Return the
  re-read booking.
- `cancellable` (mapper) = same predicate in TS: status `CONFIRMED`, or `PENDING` with `expiresAt > now`,
  and `todayIn(BOOKING_TZ) < checkIn`.
- Router: `bookingsRouter.use(loadSession("WEB"), requireAuth)`; `POST /`, `GET /me`, `GET /:code`,
  `POST /:code/cancel`, each with `validate`. Controllers read `res.locals` and respond `ok()` / 201.
- CORS: `/api/bookings` prefix → `WEB_ORIGINS`.
- `constraints.sql`: an `EXPIRED` and a `COMPLETED` booking overlapping an active one on the same room are
  allowed; a second overlapping `PENDING` is still rejected.

**Tests (HTTP):** 401 without cookie and with only `admin_sid`; POST 201 shape parses `bookingSchema`;
past date / 31 nights → 400 `VALIDATION_FAILED`; last room taken → 409 `ROOM_UNAVAILABLE`;
`GET /me` returns only own bookings, newest first, paginated (`pageSize=1&page=2`); stale hold returned as
`EXPIRED` with `cancellable: false`; `GET /:code` own → 200, other user's → 404, `BKxxxx` malformed → 400;
cancel own `PENDING` → 200 `CANCELLED`, `cancelledAt` set, and `GET /api/hotels/:slug/availability` shows the
room free again; cancel again → 409; cancel an expired hold → 409; cancel with `checkIn = today` → 409;
cancel other user's → 404; CORS preflight `OPTIONS /api/bookings` from a web origin allowed, from an admin
origin not. Then `npm run db:check` green.

**Done when:** suite + `db:check` green; `curl` with a real `sid` creates and cancels a booking.

### Task 5 — Web groundwork

**Scope:** `npm run ui:add -- alert-dialog` → `packages/ui/src/components/alert-dialog.tsx`;
move `apps/web/src/features/hotels/components/pagination.tsx` → `apps/web/src/components/pagination.tsx`
(update imports); `features/auth/components/require-auth.tsx` keeps `pathname + search` in `?next`;
`user-nav.tsx` adds "My bookings" → `/account/bookings`; `CLAUDE.md` Structure line for `src/components/`.

**Done when:** `git diff --stat package-lock.json` shows no new packages; signed-out visit to
`/account?x=1` redirects to `/login?next=%2Faccount%3Fx%3D1` and returns there after login; lint/typecheck.

### Task 6 — Web booking page (`/book`)

**Scope:** new `features/bookings/{api.ts, hooks.ts}`, `features/bookings/components/{booking-summary,
guest-form, book-view}.tsx`, `app/book/page.tsx`; `features/hotels/components/room-type-card.tsx` (Book link).

- `bookingKeys = { all, lists(), list(page), detail(code) }`; `useCreateBooking` on success:
  `setQueryData(detail(code))`, invalidate `bookingKeys.lists()`, `[...hotelKeys.detail(slug), "availability"]`,
  `hotelKeys.lists()`.
- `RoomTypeCard`: with a range and `available` → "Book" is a `Link` to
  `/book?hotel=<slug>&roomTypeId=…&checkIn=…&checkOut=…&guests=…`; no range → disabled + "Add dates to book";
  sold out → disabled.
- `/book` (inside `RequireAuth`, client parts in `<Suspense>`): parse params with `createBookingSchema`
  (+ `hotel` slug); invalid → "Choose your dates first" + link to `/hotels/<slug>` (or `/hotels`).
  `BookingSummary` uses `useHotel(slug)` + `useAvailability(slug, range)` for the chosen room type: cover,
  names, dates, nights, guests, total + per-night breakdown; skeleton / error-retry / sold-out states.
  `GuestForm`: react-hook-form + `zodResolver(createBookingSchema)`, name/email prefilled from `useMe()`,
  phone optional; one primary button "Hold this room for 15 minutes" (pending: "Holding…").
- Errors: `ROOM_UNAVAILABLE` → `role="alert"` "Someone just booked the last room for these dates" + link back
  (availability refetched); `CONFLICT` → alert with the API message + link to `/account/bookings`;
  400 → `applyServerFieldErrors`; other → generic alert, form stays filled.
- Success → `router.replace("/account/bookings/<code>")`.

**Done when:** lint/typecheck; browser: Riverside Bangkok 2027-04-08 → 04-12, Deluxe King → `/book` shows
฿15,400; signed-out → login → back to `/book` with the same query; submit lands on the booking page.

### Task 7 — Web "My bookings" and booking detail

**Scope:** `features/bookings/components/{booking-list, booking-card, booking-detail, hold-countdown,
cancel-booking-dialog, booking-status-badge}.tsx`, `features/bookings/use-countdown.ts`,
`app/account/bookings/page.tsx`, `app/account/bookings/[code]/page.tsx`.

- List: cards (code `font-mono`, hotel, dates, status badge, total), `Pagination` (`?page=`), four states;
  empty → "No bookings yet" + "Find a hotel".
- Detail: status badge, stay summary, total. `PENDING` → `HoldCountdown` ("Your room is held until HH:MM",
  `mm:ss` remaining, `role="timer"`, one `aria-live="polite"` message at 1:00) + "Online payment is coming
  soon"; at 0 → refetch detail (shows `EXPIRED`). `EXPIRED`/`CANCELLED` → explanation + "Book again" →
  `/hotels/<slug>?checkIn&checkOut&guests` (dates dropped by the URL parser if now in the past).
  `cancellable` → "Cancel booking" opens `AlertDialog` → `useCancelBooking` (setQueryData + invalidate lists
  and the hotel's availability); 409 → inline alert with the API message. 404 → "Booking not found" + link.
- Status badge: `PENDING` → `secondary` "Awaiting payment"; `CONFIRMED` → `default` "Confirmed";
  `CANCELLED` / `EXPIRED` → `outline`; `COMPLETED` → `outline` "Completed".

**Done when:** lint/typecheck; browser walkthrough (list → detail → countdown ticking → cancel → status
`CANCELLED`, room available again on the hotel page); unknown code → not-found; empty list for a fresh user.

### Task 8 — Phase close

- `impeccable` audit + polish of `/book`, `/account/bookings`, `/account/bookings/[code]` (1280 + 360,
  keyboard, error/empty states); fix findings.
- Two-browser race: both on `/book` for a room type with one free room → one lands on the booking page, the
  other sees the `ROOM_UNAVAILABLE` alert.
- `npm run lint && npm run typecheck && npm test && npm run db:check && npm run build` — all green.
- Docs: `PLAN.md` (Phase 4 boxes, status table, decision #4 = 15 min confirmed, decision #5 = cancel before
  check-in day; refunds Phase 5), `README.md` (endpoints, web routes), `CLAUDE.md` (bookings feature, routes).
- Whole-branch review (`superpowers:requesting-code-review`).

---

## Error handling

- API: zod → 400 `VALIDATION_FAILED`; unknown/inactive room type → 404; not yours / unknown code → 404;
  cap or not cancellable → 409 `CONFLICT`; last room gone → 409 `ROOM_UNAVAILABLE`; any other Prisma error →
  500 via the global handler (never leaks details).
- Web: every data view has loading / error-retry / empty / data; every mutation disables its button while
  pending and reports failures inline (`role="alert"`), never with `window.alert`.

## Review focus

1. **Expired hold still blocks at DB level** — without the expire step a stale `PENDING` row makes every
   insert on that room fail `23P01`. Pinned in Task 3.
2. **Last-room race** — exactly one of two parallel creates wins; the loser gets `ROOM_UNAVAILABLE`, not 500.
   Pinned in Task 3 (×5) and Task 8 (browser).
3. **Retry next room** — a `23P01` on room A must fall through to room B, not fail the request. Task 3.
4. **Cancel vs expiry** — cancelling a hold whose `expiresAt` just passed is 409, and the row ends `EXPIRED`
   or `CANCELLED`, never both / never re-activated. Single conditional `updateMany`. Task 4.
5. **Bangkok "today" for cancel** — at `2026-11-12T17:00:00Z` a booking with `checkIn = 2026-11-13` is no
   longer cancellable. Task 4 (inject `now`).
6. **Ownership** — another user's code returns 404 on read and cancel. Task 4.
7. **`?next` keeps the query** — a signed-out Book click returns to the same `/book?...`. Task 5.
