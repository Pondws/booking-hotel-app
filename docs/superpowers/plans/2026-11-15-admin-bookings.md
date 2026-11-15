# Admin Bookings (6.4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff/admins list, inspect, check in/out, cancel (with reason + full refund) and move bookings in web-admin.

**Architecture:** Additive migration (`checkedInAt`, `checkedOutAt`, `cancelReason`). "Checked in" = `CONFIRMED` +
`checkedInAt`. New `admin-booking.service.ts` holds every rule as conditional `updateMany` writes; the router
`/api/admin/bookings` sits behind the existing `adminRouter` guard; hotel scope is checked in the service.
web-admin gets `features/bookings/` + `/bookings` and `/bookings/[code]`.

**Tech Stack:** Express 5, Prisma 7, zod v4, node:test + supertest, Next.js 16, TanStack Query, shadcn (`@booking/ui`).

**Spec:** `docs/superpowers/specs/2026-11-15-admin-bookings-design.md`

## Global Constraints

- No new dependencies, no new shadcn components, no change to the response shape or auth.
- Migration is additive only; `bookings_no_overlap` and other constraints stay untouched.
- `today` is always `todayIn(BOOKING_TZ, now)`; dates convert only via `lib/dates.ts`.
- Controllers never import prisma; every request validated by `validate`.
- web-admin UI copy is Thai; new API messages get Thai entries in `lib/messages-th.ts`.
- Query keys via `adminBookingKeys`; actions update the detail cache and invalidate lists + rooms.

## Review Focus

- A lapsed `PENDING` hold must show and filter as `EXPIRED`, never be cancellable/movable → list test with a lapsed hold under `status=PENDING` (Task 3), cancel/move 409 on it (Task 4).
- Staff guessing a booking code of another hotel must get 404 on every endpoint, actions included (Tasks 3, 4).
- Early check-out must free the remaining nights → a new overlapping booking on that room is accepted after check-out (Task 4).
- Moving onto a room booked for an overlapping range → 409 `ROOM_UNAVAILABLE`, booking unchanged (Task 4).
- Customer cancel still refunds after `releasePayment` moves (Task 2, existing payments tests).

---

### Task 1: Schema + shared schemas

**Files:** Modify `apps/api/prisma/schema.prisma` (Booking), new migration `admin_booking_ops`; Modify `packages/shared/src/index.ts`.

**Produces (shared):**
- `ADMIN_BOOKING_STATUS_FILTERS = ["all","PENDING","CONFIRMED","CHECKED_IN","COMPLETED","CANCELLED","EXPIRED"]`
- `adminBookingListQuerySchema` `{ hotelId?, status (default "all"), from?, to? (iso date, from ≤ to), q? (trim ≤ 120, "" → undefined), page (1), pageSize (20, ≤ 50) }` → `AdminBookingListQuery`
- `adminBookingSummarySchema`, `adminBookingListSchema = paginated(...)`, `adminBookingSchema` (fields per spec) → `AdminBookingSummary`, `AdminBooking`
- `adminBookingRoomOptionSchema` `{ id, number, isActive, current, available }`, `adminBookingRoomOptionListSchema`
- `cancelBookingInputSchema` `{ reason: trim, min 1 "Enter a reason", max 500 }`, `moveBookingRoomInputSchema` `{ roomId: string min 1 }`

- [ ] Add the three nullable columns (`checked_in_at`, `checked_out_at`, `cancel_reason`), run `npm run db:migrate -- --name admin_booking_ops`, check the SQL is only `ADD COLUMN`.
- [ ] Add shared schemas; add parse tests to `apps/api/src/lib/shared-schemas.test.ts` (from > to rejected; empty q → undefined; reason "  " rejected, 501 chars rejected).
- [ ] `npm run typecheck`, `npm test`, `npm run db:check` pass. Commit + push.

### Task 2: Move `releasePayment` into `payment.service`

**Files:** Modify `apps/api/src/services/booking.service.ts`, `apps/api/src/services/payment.service.ts`.

**Produces:** `releaseBookingPayment(bookingId: string, now: Date, provider: PaymentProvider): Promise<void>` in
`payment.service.ts` (same behaviour as today's `releasePayment`, looked up by `bookingId`; logs with the booking id).
`cancelMyBooking` calls it. Avoid an import cycle: `payment.service` already imports `booking.service`, so
`booking.service` must not import `payment.service` at module top level in a way that breaks — move the shared
pieces so the cycle is one-way (`booking.service` → `payment.service` only for this function is fine in ESM as
long as neither uses the other at load time).

- [ ] Move, run `npm test` — existing payments/booking tests (refund on cancel) pass unchanged. Commit + push.

### Task 3: Read endpoints (list, detail, rooms)

**Files:** Create `apps/api/src/services/admin-booking.service.ts`, `apps/api/src/controllers/admin-booking.controller.ts`,
`apps/api/src/routes/admin/bookings.ts`, `apps/api/src/routes/admin/bookings.test.ts`; Modify `routes/admin/index.ts`.

**Produces:**
- `listAdminBookings(user, query, now?) → Paginated<AdminBookingSummary>`
- `getAdminBooking(user, code, now?) → AdminBooking`
- `listBookingRoomOptions(user, code, now?) → AdminBookingRoomOption[]` (rooms of the room type ordered by number)
- internal `findVisibleBooking(user, code)` → row or 404 (STAFF: `room.roomType.hotel.staff.some.userId`)
- `toAdminBooking(row, now)` computes effective status + `canCheckIn/canCheckOut/canCancel/canMoveRoom` from the spec's rules table.
- Status filter mapping: `CONFIRMED` → `{status: CONFIRMED, checkedInAt: null}`; `CHECKED_IN` → `{status: CONFIRMED, checkedInAt: {not: null}}`; `PENDING` → unexpired; `EXPIRED` → `EXPIRED` or lapsed `PENDING` (also flip lapsed holds first). Date filter: `checkIn ≤ to`, `checkOut > from`.
- `hotelId` given and not accessible (`canAccessHotel`) → 403.

Tests (`describe("admin bookings API")`, label `admin-bookings`, bookings created with `generateBookingCode()` codes):
web session 401; CUSTOMER admin session 403; staff list only has own hotel's bookings; `hotelId=<other>` → 403;
GET other hotel's code → 404; lapsed hold appears under `EXPIRED` not `PENDING`; `CHECKED_IN` vs `CONFIRMED`;
date overlap (`from/to` touching vs not); `q` by guest name and code; detail shape parses with `adminBookingSchema`;
rooms: current room `current: true, available: false`, occupied room `available: false`, inactive `available: false`.

- [ ] Write tests → fail → implement → pass. Lint/typecheck. Commit + push.

### Task 4: Actions (check-in, check-out, cancel, move)

**Files:** Modify the Task 3 service/controller/router/test.

**Produces:** `checkInBooking(user, code, now?)`, `checkOutBooking(user, code, now?)`,
`cancelAdminBooking(user, code, reason, now?, opts?: { provider? })`, `moveBookingRoom(user, code, roomId, now?)` — each
returns `AdminBooking`. Each write is one `updateMany` with the rule in `where` + the visibility filter; `count 0` →
`findVisibleBooking` (404) else 409 `CONFLICT` "This booking can't be …". Move: target not in the booking's room
type → 404 "Room not found"; inactive / current / occupied (`blockingBookingWhere` excluding this booking) → 409
`ROOM_UNAVAILABLE`; `isExclusionViolation` / `isWriteConflict` → same 409. Cancel → `releaseBookingPayment`.

Tests: check-in on today's check-in → 200 `checkedInAt` set, twice → 409, future check-in → 409; check-out before
check-in → 409, after → `COMPLETED` and a new booking for the remaining nights on the same room inserts fine;
cancel without reason → 400, paid booking (payment row SUCCEEDED with mock ref) → payment `REFUNDED`, checked-in → 409,
lapsed hold → 409; move to free room → room changed, to occupied → 409 `ROOM_UNAVAILABLE`, to other room type's room →
404, to inactive → 409; all four actions on another hotel's booking → 404.

- [ ] Write tests → fail → implement → pass. Lint/typecheck. Commit + push.

### Task 5: web-admin list

**Files:** Create `apps/web-admin/src/features/bookings/{api.ts,hooks.ts,list-params.ts,labels.ts}`,
`features/bookings/components/{booking-list.tsx,booking-filters.tsx,booking-status-badge.tsx}`,
`app/(protected)/bookings/page.tsx`; Modify `components/nav-items.ts`, `lib/messages-th.ts`.

**Produces:** `adminBookingKeys = { all, lists(), list(query), detail(code), rooms(code) }`; hooks `useAdminBookings(query)`,
`useAdminBooking(code)`, `useBookingRoomOptions(code, enabled)`, `useCheckIn(code)`, `useCheckOut(code)`,
`useCancelBooking(code)`, `useMoveRoom(code)`. `BookingStatusBadge({ status, checkedIn })`, `PaymentStatusBadge`.
`list-params.ts` mirrors `features/hotels/list-params.ts` for the new query keys.

- [ ] Build the page (filters in URL, DataTable, loading/error/empty, pagination). Lint/typecheck. Verify in browser. Commit + push.

### Task 6: web-admin detail + actions

**Files:** Create `app/(protected)/bookings/[code]/page.tsx`, `features/bookings/components/{booking-detail.tsx,booking-actions.tsx,cancel-booking-dialog.tsx,move-room-dialog.tsx}`.

- [ ] Cards per spec; actions shown only by `can*` flags; refund-failed warning when `status CANCELLED` and `payment.status SUCCEEDED`. Lint/typecheck. Verify each action in the browser. Commit + push.

### Task 7: Wrap-up

- [ ] Update `PLAN.md` 6.4 checkboxes + table, `CLAUDE.md` structure notes (admin-booking.service, features/bookings). Full `npm run lint && npm run typecheck && npm test`. Commit + push, give the PR compare URL.
