# Booking Flow (Phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in customer holds a room type for 15 minutes (`PENDING` booking with a `BK…` code), sees their bookings with a live countdown, and can cancel — and no room is ever double-booked, even under a last-room race.

**Architecture:**
- The DB exclusion constraint `bookings_no_overlap` is the only double-booking guard. `createBooking` expires stale holds, then tries one single-statement insert per candidate room, treating `23P01` as "try the next room" — no wrapping transaction.
- Expiry is lazy (at request time). Every response goes through one mapper `toBooking(row, now)` that reports the effective status and a computed `cancellable`.
- Web: `features/bookings` (api + hooks + components), `/book` page (summary + guest form), `/account/bookings` list + `[code]` detail with countdown and cancel dialog.

**Tech Stack:** Express 5, Prisma 7 + PrismaPg, zod v4, node:test + supertest, Next.js 16, TanStack Query v5, react-hook-form, shadcn (`alert-dialog`).

**Spec:** `docs/superpowers/specs/2026-11-12-booking-flow-design.md` — binding for contracts, endpoint table, messages, and per-task test lists. Read it first; this plan adds file paths, signatures and the extra tests listed under Review Focus.

## Global Constraints

- `HOLD_MINUTES = 15`, `MAX_ACTIVE_HOLDS = 3` (in `@booking/shared`). `BOOKING_TZ`, `MAX_NIGHTS`, `refineStay` from Phase 3 — never re-implemented.
- Messages (verbatim): `"Room type not found"`, `"Booking not found"`, `"This booking can't be cancelled"`, `"This room was just booked for these dates"`, `` `You have ${MAX_ACTIVE_HOLDS} bookings waiting for payment` ``, `` `This room sleeps ${capacity} guests` ``. Web copy: `"Hold this room for 15 minutes"` / `"Holding…"`, `"Someone just booked the last room for these dates"`, `"Choose your dates first"`, `"No bookings yet"`, `"Find a hotel"`, `"Online payment is coming soon"`, `"Add dates to book"`, badge labels per spec Task 7.
- New error code: `ROOM_UNAVAILABLE` only. Cap / not cancellable → `CONFLICT`. Another user's booking → 404, never 403.
- No migration. No new npm packages except what `npm run ui:add -- alert-dialog` writes (expected: none; radix-ui is already a dependency).
- Booking code alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, format `/^BK[A-HJ-NP-Z2-9]{6}$/`, `crypto.randomInt`, ≤ 5 attempts per room on `P2002` for `code`.
- Room number is never in a response. Money: `Prisma.Decimal` until the mapper; `.toNumber()` there. `@db.Date` only via `lib/dates.ts`.
- Only services import `prisma`. No `any`, no casts in production code. Controllers read `res.locals.params` / `res.locals.query`, body from `req.body`, user from `req.auth`.
- Test fixtures: **reuse `apps/api/src/test/catalog-fixtures.ts`** with labels `bk-code`, `bk-svc`, `bk-http` (rows land under the `Cat Test ` prefix and are removed by `cleanupCatalogFixtures(label)`; sessions cascade with their user). This replaces the spec's `Bk Test` naming — same isolation, no second fixture module. Seed rows are read-only.
- Every task ends with `npm run lint && npm run typecheck && npm test` green, then commit and `git push` on `feat/booking`. Check `git show --stat HEAD` lists the task's files.
- Skills: Tasks 2–4 `prisma-client-api`; Tasks 5–7 `shadcn`, `tanstack-query-best-practices`, `next-dev-loop`; Task 8 `impeccable`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`.

## Review Focus

The spec's own review focus (expired hold blocks at DB level, last-room race, retry next room, cancel vs expiry, Bangkok "today", ownership, `?next` keeps query) is already pinned in its tasks. These five are implied but not tested by the spec:

1. **Blank optional phone** — the guest form submits `guestPhone: ""` when left empty; `createBookingSchema` rejects `""`. Expected: an empty phone is omitted and the hold succeeds. Pinned in Task 6 (form `setValueAs`) + Task 1 (schema test documents `""` is rejected so the form must strip it).
2. **Double submit / back button** — a double-click or a browser Back to `/book` after success must not create a second hold silently. Expected: button disabled while pending; success uses `router.replace`. Pinned in Task 6 browser check.
3. **`roomTypeId` from another hotel in the `/book` URL** — summary would show nothing sensible while the API would happily book. Expected: `/book` shows the "Choose your dates first" state when `roomTypeId` is not among `hotel.roomTypes`. Pinned in Task 6.
4. **Countdown at zero with client clock ahead of server** — refetch still returns `PENDING`. Expected: one refetch at 0, no refetch loop; the timer shows `00:00`. Pinned in Task 7 (`useCountdown` stops at 0; detail refetches once per `expiresAt`).
5. **Page past the end of "My bookings"** — `GET /api/bookings/me?page=99` → 200 with `items: []` and the real `total`/`totalPages` (same as Phase 3 search). Pinned in Task 4.

---

### Task 1: Shared booking contracts

**Files:**
- Modify: `packages/shared/src/index.ts` (Booking section; `errorCodeSchema`)
- Test: `apps/api/src/lib/shared-schemas.test.ts`

**Interfaces:**
- Produces (`@booking/shared`): `HOLD_MINUTES`, `MAX_ACTIVE_HOLDS`, `"ROOM_UNAVAILABLE"` in `errorCodeSchema`, `createBookingSchema` (+ `CreateBookingInput = z.input`, `CreateBookingData = z.output`), `bookingStatusSchema` (+ `BookingStatus`), `bookingSchema` (+ `Booking`), `bookingListSchema`, `bookingListQuerySchema` (+ `BookingListQuery = z.output`), `bookingCodeParamsSchema` (+ `BookingCodeParams`), `BOOKING_CODE_PATTERN = /^BK[A-HJ-NP-Z2-9]{6}$/`. Shapes exactly as the spec's Contracts block.

- [ ] **Step 1: Update + add failing tests.** Dates relative to `todayIn(BOOKING_TZ)` (+N days helper). Rewrite the two existing booking tests to expect `"Check-out must be after check-in"` (path `["checkOut"]`) and `"Enter 1 to 20 guests"`; keep "same calendar day strings" with future dates. Add: past check-in → `"Check-in can't be in the past"`; 31 nights → `"Stays are limited to 30 nights"`; `guestEmail: " A@B.COM "` → `"a@b.com"`; `guestName: "  "` fails; `guestPhone: ""` fails (documents Review Focus 1); `bookingSchema.parse(sample)` succeeds; `bookingCodeParamsSchema` accepts `BK7QX2MA`, rejects `BK0OOOOO`, `bk7qx2ma`, `me`; `bookingListQuerySchema.parse({})` → `{ page: 1, pageSize: 10 }`, `pageSize: "51"` fails; `errorCodeSchema.options` includes `"ROOM_UNAVAILABLE"`.
- [ ] **Step 2: Run** `npm test -w apps/api -- --test-name-pattern="booking"` → FAIL.
- [ ] **Step 3: Implement** — move the Booking section below Catalog (it uses `isoDate`, `guestsField`, `refineStay`, `emailField`, `paginated`, `imageSchema`). `bookingCodeParamsSchema` uses `BOOKING_CODE_PATTERN`.
- [ ] **Step 4: Run** the same → PASS; `npm run typecheck` (web/web-admin still compile).
- [ ] **Step 5: Commit + push** — `feat(shared): booking contracts, hold constants and ROOM_UNAVAILABLE`.

### Task 2: Exclusion-violation detection + booking codes

**Files:**
- Modify: `apps/api/src/lib/prisma-errors.ts`, `apps/api/src/lib/prisma-errors.test.ts`
- Create: `apps/api/src/lib/booking-code.ts`, `apps/api/src/lib/booking-code.test.ts`

**Interfaces:**
- Consumes: `createCatalogFixture`, `addBooking`, `cleanupCatalogFixtures` (label `bk-code`); `bookingCodeParamsSchema`.
- Produces:
  - `isExclusionViolation(err: unknown, constraint?: string): boolean` (default `"bookings_no_overlap"`)
  - `BOOKING_CODE_ALPHABET: string`, `generateBookingCode(random?: (max: number) => number): string` (default `crypto.randomInt`)

- [ ] **Step 1: Probe the real error.** Write the DB test "overlapping PENDING inserts raise an exclusion violation": fixture with 1 room, two `addBooking(..., "PENDING", now+10min)` on `[2030-03-10, 2030-03-12)` and `[2030-03-11, 2030-03-13)`; catch the second error and `console.dir(err, { depth: 6 })` once. Run `npm test -w apps/api -- --test-name-pattern="exclusion"` and note where `23P01` and the constraint name appear (expected: `PrismaClientKnownRequestError` with `meta.driverAdapterError.cause` — `originalCode: "23P01"` and the constraint, mirroring `isUniqueViolationOn`; possibly `PrismaClientUnknownRequestError`). Remove the `console.dir`.
- [ ] **Step 2: Write the remaining failing tests:** the overlap error → `isExclusionViolation(err) === true`; a duplicate-`code` insert → `false`; `new Error("x")` → `false`; `isExclusionViolation(overlapErr, "other_constraint") === false`. `generateBookingCode()` 1,000× all pass `bookingCodeParamsSchema`; `generateBookingCode(() => 0) === "BKAAAAAA"`.
- [ ] **Step 3: Implement** both from what Step 1 observed, reusing the `isRecord` guard; narrow through `unknown`, no casts.
- [ ] **Step 4: Run** `npm test -w apps/api -- --test-name-pattern="exclusion|booking code"` → PASS.
- [ ] **Step 5: Commit + push** — `feat(api): detect booking overlap violations and generate booking codes`.

### Task 3: `createBooking` service + concurrency

**Files:**
- Create: `apps/api/src/services/booking.service.ts`, `apps/api/src/services/booking.service.test.ts`
- Modify: `apps/api/src/test/catalog-fixtures.ts` (add `createFixtureUser`)

**Interfaces:**
- Consumes: Task 1 types/constants; Task 2 `isExclusionViolation`, `generateBookingCode`; `isUniqueViolationOn`; `blockingBookingWhere`; `quoteStay`; `toDbDate`/`fromDbDate`.
- Produces:
  - `createFixtureUser(label: string): Promise<PublicUser>` — email under the label's user prefix (so cleanup removes it).
  - `bookingSelect` (Prisma `select` with hotel name/slug/city/cover image via `images` ordered by `sortOrder` take 1, roomType id/name; never `room.number`) and `type BookingRow`.
  - `toBooking(row: BookingRow, now: Date): Booking` — effective status (`PENDING` with `expiresAt <= now` → `EXPIRED`), `nights = nightsBetween`, ISO datetimes, `cancellable` per spec Task 4.
  - `createBooking(user: PublicUser, input: CreateBookingData, now?: Date, opts?: { generateCode?: () => string }): Promise<Booking>`

- [ ] **Step 1: Write failing service tests** (label `bk-svc`; range in 2030 so `refineStay` isn't involved — the service trusts parsed input; `now` injected) — every case in the spec's Task 3 test list, with these exact assertions:
  - `expiresAt.getTime() === now + 15*60_000`; `totalAmount === (await quoteStay(...)).total`; `guestName === user.name`, `guestEmail === user.email`, `guestPhone === null`; `status === "PENDING"`; `code` matches `BOOKING_CODE_PATTERN`.
  - capacity: rejects with `AppError` `status 400`, `code "VALIDATION_FAILED"`, `details` deep-equal `{ formErrors: [], fieldErrors: { guests: ["This room sleeps 2 guests"] } }`.
  - cap: 3 holds then a 4th → 409 `CONFLICT` `"You have 3 bookings waiting for payment"`; 3 rows `PENDING` with `expiresAt = now − 1 min` → booking succeeds.
  - concurrency / retry loops: `for (let i = 0; i < 5; i++)` with `clearBookings` between iterations; use `Promise.allSettled`; assert exactly one fulfilled and one rejected `AppError` code `ROOM_UNAVAILABLE` (not a Prisma error); then `prisma.booking.count` of blocking rows for the range `=== 1`. Retry: two rooms, both fulfilled, `roomId`s differ (read back from DB — not in the response).
  - collision: `opts.generateCode` returns an existing booking's code once, then a fresh one → created, `code !== existing`.
- [ ] **Step 2: Run** `npm test -w apps/api -- --test-name-pattern="createBooking"` → FAIL.
- [ ] **Step 3: Implement** `createBooking` exactly in the spec's 7 steps (expire per room type → cap → `quoteStay` → candidate rooms ordered by `number` → per-room insert loop → `ROOM_UNAVAILABLE`). Inserts use `select: bookingSelect`. Total from `new Prisma.Decimal(quote.total)`.
- [ ] **Step 4: Run** → PASS, and the full `npm test` once (5/5 iterations in one run).
- [ ] **Step 5: Commit + push** — `feat(api): create booking holds with overlap-safe room assignment`.

### Task 4: Reads, cancel, routes, CORS, DB checks

**Files:**
- Modify: `apps/api/src/services/booking.service.ts`; `apps/api/src/app.ts`; `apps/api/src/lib/cors-policy.ts` + `cors-policy.test.ts`; `apps/api/prisma/checks/constraints.sql`; `apps/api/src/test/catalog-fixtures.ts` (add `signIn`)
- Create: `apps/api/src/controllers/booking.controller.ts`, `apps/api/src/routes/bookings.ts`, `apps/api/src/routes/bookings.test.ts`

**Interfaces:**
- Consumes: Task 3 service, mapper, `createFixtureUser`.
- Produces:
  - `listMyBookings(user: PublicUser, query: BookingListQuery, now?: Date): Promise<Paginated<Booking>>` (`orderBy: [{ createdAt: "desc" }, { id: "desc" }]`, `totalPages = Math.max(1, ceil(total/pageSize))`)
  - `getMyBooking(user: PublicUser, code: string, now?: Date): Promise<Booking>`
  - `cancelMyBooking(user: PublicUser, code: string, now?: Date): Promise<Booking>` — single conditional `updateMany` per spec; `todayIn(BOOKING_TZ, now)`.
  - `signIn(userId: string, audience: "WEB" | "ADMIN"): Promise<string>` (test-only; creates a `Session` with `hashToken(generateToken())`, `expiresAt` +1 day; returns the raw token)
  - `bookingsRouter`, mounted at `/api/bookings`; `allowedOriginsFor("/api/bookings…")` → web only.

- [ ] **Step 1: Failing unit tests:** `cors-policy.test.ts` — `/api/bookings` and `/api/bookings/BK7QX2MA/cancel` → web origins only; `/api/bookingsx` → both. Service-level `cancelMyBooking` with injected `now = new Date("2026-11-12T17:00:00Z")` and `checkIn = 2026-11-13` → 409 (Bangkok today is the 13th) — insert the row directly with `addBooking` (bypasses `refineStay`).
- [ ] **Step 2: Failing HTTP tests** (`bookings.test.ts`, label `bk-http`, cookies from `signIn`): the spec's Task 4 HTTP list, plus `GET /me?page=99` → 200, `items: []`, `total` real (Review Focus 5). Shapes asserted with `bookingSchema.parse` / `bookingListSchema.parse`; error bodies assert `error.code` and verbatim `error.message`.
- [ ] **Step 3: Run** `npm test -w apps/api -- --test-name-pattern="bookings|cors|cancel"` → FAIL.
- [ ] **Step 4: Implement** service functions, controller (`create` → `ok(res, …, 201)`; others `ok`), router `bookingsRouter.use(loadSession("WEB"), requireAuth)` with `POST /`, `GET /me`, `GET /:code`, `POST /:code/cancel` in that order, each with `validate`. Controllers use `req.auth` — narrow with a guard throwing 401 if absent (no `!`). Add the CORS rule. Add the three `constraints.sql` cases (EXPIRED and COMPLETED overlapping an active row allowed; second PENDING rejected).
- [ ] **Step 5: Run** `npm test` and `npm run db:check` → green.
- [ ] **Step 6: Manual check** — `npm run dev:api`; log in as the seeded customer with `curl -c`, `POST /api/bookings` for a seed room type → 201, `POST /api/bookings/<code>/cancel` → `CANCELLED`.
- [ ] **Step 7: Commit + push** — `feat(api): booking endpoints — list, detail, cancel`.

### Task 5: Web groundwork

**Files:**
- Create via `npm run ui:add -- alert-dialog`: `packages/ui/src/components/alert-dialog.tsx`
- Move: `apps/web/src/features/hotels/components/pagination.tsx` → `apps/web/src/components/pagination.tsx` (update imports in `hotel-results.tsx`, `hotel-search-view.tsx`); `aria-label` becomes a prop `label` (default `"Results pages"`)
- Modify: `apps/web/src/features/auth/components/require-auth.tsx`, `user-nav.tsx`; `CLAUDE.md` (Structure: `src/components/` — app-wide components shared by several features)

**Interfaces:**
- Produces: `@booking/ui/components/alert-dialog` (`AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction`); `@/components/pagination` `Pagination({ page, totalPages, hrefFor, label? })`.

- [ ] **Step 1:** `ui:add`; `git diff --stat package-lock.json` → no change (stop and ask if it adds packages).
- [ ] **Step 2:** Move `Pagination`; `RequireAuth` builds `next` from `usePathname()` + `useSearchParams().toString()` (`?` only when non-empty) — callers already sit in `<Suspense>`; check each page that renders `RequireAuth` and wrap where missing. `UserNav` gets a "My bookings" link → `/account/bookings`.
- [ ] **Step 3:** `npm run lint && npm run typecheck`; browser (`next-dev-loop`): signed out, `/account?x=1` → `/login?next=%2Faccount%3Fx%3D1` → after login back on `/account?x=1`.
- [ ] **Step 4: Commit + push** — `feat(web): alert-dialog, shared pagination, keep query in login next`.

### Task 6: Web booking page (`/book`)

**Files:**
- Create: `apps/web/src/features/bookings/{api.ts,hooks.ts}`, `apps/web/src/features/bookings/components/{booking-summary,guest-form,book-view}.tsx`, `apps/web/src/app/book/page.tsx`
- Modify: `apps/web/src/features/hotels/components/room-type-card.tsx`

**Interfaces:**
- Consumes: Task 1 schemas; `useHotel`, `useAvailability`, `hotelKeys`; `useMe`; `formatMoney`, `formatDateRange`; `applyServerFieldErrors`, `formErrorMessage`; `ApiError`.
- Produces:
  - `api.ts`: `createBooking(input: CreateBookingInput): Promise<Booking>`, `fetchMyBookings(page: number): Promise<Paginated<Booking>>`, `fetchBooking(code: string): Promise<Booking>`, `cancelBooking(code: string): Promise<Booking>`
  - `hooks.ts`: `bookingKeys = { all: ["bookings"], lists(), list(page), details(), detail(code) }`; `useCreateBooking(hotelSlug: string)`, `useMyBookings(page)`, `useBooking(code)`, `useCancelBooking(hotelSlug: string)`; invalidation per spec Task 6/7.
  - `parseBookParams(sp: URLSearchParams): { hotel: string; input: CreateBookingData } | { hotel: string | null; input: null }` (in `book-view.tsx` or `features/bookings/book-params.ts`).

- [ ] **Step 1:** Fetchers + hooks.
- [ ] **Step 2:** `RoomTypeCard` "Book" states per spec (Link with `toSearchParams`-style query; disabled + "Add dates to book"; sold out disabled). Remove the "Booking opens soon" hint.
- [ ] **Step 3:** `/book` = `RequireAuth` › `<Suspense>` › `BookView`. Invalid params **or a `roomTypeId` not in `hotel.roomTypes`** (Review Focus 3) → "Choose your dates first" + link to `/hotels/<slug>` (or `/hotels`). `BookingSummary` loading skeleton / error retry / sold out / data (cover, names, dates, nights, guests, total, per-night list).
- [ ] **Step 4:** `GuestForm` — react-hook-form + `zodResolver(createBookingSchema)`; hidden values from params; name/email defaulted from `useMe()`; phone registered with `setValueAs: (v: string) => (v.trim() === "" ? undefined : v)` (Review Focus 1). Button disabled while pending. Error mapping and `router.replace("/account/bookings/<code>")` per spec Task 6.
- [ ] **Step 5:** `npm run lint && npm run typecheck`; browser: Riverside Bangkok `2027-04-08 → 04-12` Deluxe King → `/book` shows `฿15,400`; signed out → login → same `/book?…`; submit with phone empty → lands on `/account/bookings/<code>`; Back does not return to a submittable form for the same hold (Review Focus 2); `/book?roomTypeId=<other hotel's>` → "Choose your dates first".
- [ ] **Step 6: Commit + push** — `feat(web): booking page with live quote and 15-minute hold`.

### Task 7: My bookings + booking detail

**Files:**
- Create: `apps/web/src/features/bookings/components/{booking-list,booking-card,booking-detail,hold-countdown,cancel-booking-dialog,booking-status-badge}.tsx`, `apps/web/src/features/bookings/use-countdown.ts`, `apps/web/src/app/account/bookings/page.tsx`, `apps/web/src/app/account/bookings/[code]/page.tsx`

**Interfaces:**
- Consumes: Task 6 hooks; Task 5 `Pagination`, `AlertDialog*`.
- Produces: `useCountdown(expiresAt: string | null): { remainingMs: number; done: boolean }` — 1 s interval from `Date.parse(expiresAt) - Date.now()`, clamped at 0, interval cleared when done.

- [ ] **Step 1:** `BookingStatusBadge`, `BookingCard`, `BookingList` (`?page=` via `useSearchParams`, four states, empty copy per spec).
- [ ] **Step 2:** `HoldCountdown` (spec Task 7 copy, `role="timer"`, single `aria-live` at 1:00). `BookingDetail` calls `refetch()` once when `done` flips true — guarded by a ref keyed on `expiresAt` so a still-`PENDING` reply doesn't loop (Review Focus 4).
- [ ] **Step 3:** `CancelBookingDialog` → `useCancelBooking`; 409 → inline `role="alert"` with the API message; button disabled while pending. 404 on detail → "Booking not found" + link to `/account/bookings`. "Book again" link per spec.
- [ ] **Step 4:** `npm run lint && npm run typecheck`; browser walkthrough per spec Task 7 "Done when", plus: set a hold's `expires_at` 5 s ahead in `db:studio`, watch it reach `00:00`, one network refetch, status `EXPIRED`.
- [ ] **Step 5: Commit + push** — `feat(web): my bookings list and booking detail with countdown and cancel`.

### Task 8: Phase close

**Files:** UI files touched by audit fixes; `PLAN.md`, `README.md`, `CLAUDE.md`.

- [ ] **Step 1:** `impeccable` audit + polish on `/book`, `/account/bookings`, `/account/bookings/[code]` (1280 + 360 px, keyboard, error/empty states); apply fixes.
- [ ] **Step 2:** Two-browser race (one free room) → one booking page, one `ROOM_UNAVAILABLE` alert.
- [ ] **Step 3:** `npm run lint && npm run typecheck && npm test && npm run db:check && npm run build` — all green, output captured.
- [ ] **Step 4:** Docs per spec Task 8 (PLAN.md phase 4 boxes + decisions #4/#5, README endpoints/routes, CLAUDE.md bookings feature + `src/components/`).
- [ ] **Step 5: Commit + push** — `docs: phase 4 booking status, README and CLAUDE.md`; then `superpowers:requesting-code-review` on the whole branch.
