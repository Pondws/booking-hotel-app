# Bookings (Phase 6.4) — Design

Date: 2026-11-15
Status: Decided by the builder (short directive "start 6.4"), following the 6.1–6.3 patterns
Roadmap: `PLAN.md` Phase 6 → 6.4 · Branch: `feat/admin-bookings`

## Intent

Front-desk work. Staff (for their hotels) and admins (for every hotel) find bookings, see who is coming and whether
the booking is paid, check guests in and out, cancel with a reason (full refund), and move a guest to another room
of the same room type. The customer site keeps working unchanged.

## Goals

- List bookings, filtered by hotel, status and date range, searchable by code / guest name / email. Paginated.
- Detail page with guest, stay, room, amount and payment status (`payment.status`, `paidAt`, `refundedAt`),
  check-in/out times and the cancel reason.
- Check in, then check out (→ `COMPLETED`).
- Cancel with a required reason. A paid booking is refunded in full.
- Move to another active room of the same room type that is free for the stay.
- The API enforces every rule: hotel access, which action is allowed in which state.

## Non-goals

- Changing dates, guests or price; creating bookings for walk-ins; partial refunds; no-show fees.
- Arrivals/departures-today views and stats (6.6 Dashboard).
- Notifying the customer (Phase 8, email).

## Approaches (checked-in state)

| Approach | Trade-off |
| --- | --- |
| **A. Timestamps only (picked)**: `CONFIRMED` + `checkedInAt` = in house; check-out sets `COMPLETED` + `checkedOutAt` | Additive migration (nullable columns). `bookings_no_overlap`, availability, `settlePayment` and the customer site need no change. "Checked in" is derived. |
| B. New `CHECKED_IN` enum value | The status reads directly, but the exclusion constraint (`PENDING/CONFIRMED` only) would have to be rebuilt to keep blocking the room, plus `blockingBookingWhere`, `settlePayment` "paidFor", the shared enum and the customer UI labels. Wider change, more risk. |

Picked A: same behaviour for less blast radius. B can come later if a real status is needed.

## Schema (one migration, additive)

`Booking` gets `checkedInAt DateTime?`, `checkedOutAt DateTime?`, `cancelReason String?` (≤ 500 chars, checked by zod).
No constraint changes. Early check-out sets `COMPLETED`, which frees the remaining nights (the constraint only
counts `PENDING/CONFIRMED`). That's what we want.

## Rules (all in `admin-booking.service.ts`, `today` = `todayIn(BOOKING_TZ, now)`)

| Action | Allowed when | Effect |
| --- | --- | --- |
| Check in | `CONFIRMED`, not checked in, `checkIn ≤ today < checkOut` | `checkedInAt = now` |
| Check out | `CONFIRMED` and checked in | `COMPLETED`, `checkedOutAt = now` (early check-out allowed) |
| Cancel | `CONFIRMED` not checked in (any date, so no-shows can be cancelled too), or an unexpired `PENDING` hold | `CANCELLED`, `cancelledAt`, `cancelReason`. Then release the payment: refund a `SUCCEEDED` one in full, or cancel the open intent of a `PENDING` one |
| Move room | `CONFIRMED` (checked in or not) or an unexpired `PENDING` hold | `roomId` = target room. The target must be in the same room type, active, not the current room and free for `[checkIn, checkOut)` |

- Each write is one conditional `updateMany` (state checked in the `where`), the same as `cancelMyBooking`, so
  races can't break a rule. `count === 0` → re-read: 404 if not visible, else `409 CONFLICT`.
- Move room: the free check is done first, so the user gets a clear 409 `ROOM_UNAVAILABLE`. The exclusion
  constraint backs it up (23P01 / deadlock → the same 409).
- Payment release: move `releasePayment` from `booking.service` into `payment.service` as
  `releaseBookingPayment(bookingId, now, provider)`, used by the customer cancel and the admin cancel. Provider
  failure is logged and swallowed as it is today. The admin detail then shows a `SUCCEEDED` payment on a
  `CANCELLED` booking as "refund failed, needs checking".
- Lapsed holds: list/detail first flip lapsed `PENDING` holds to `EXPIRED` (same as the customer side).

## Access

- Routes under `/api/admin/bookings` (behind the `adminRouter` guard). Bookings are found by `code`, not under
  `hotels/:hotelId`, because the list spans hotels.
- STAFF: the list is limited to their hotels. Passing a `hotelId` they don't manage → `403`. A booking from
  another hotel → `404` (a staff member can't tell it exists). ADMIN: every hotel.

## API

| Route | Body / query | Result |
| --- | --- | --- |
| `GET /api/admin/bookings` | `hotelId?`, `status` (`all` default, `PENDING`, `CONFIRMED` = awaiting arrival, `CHECKED_IN`, `COMPLETED`, `CANCELLED`, `EXPIRED`), `from?`/`to?` (YYYY-MM-DD, stays touching `[from, to]`), `q?`, `page`, `pageSize` (20, ≤ 50) | `Paginated<AdminBookingSummary>`, ordered by `checkIn` desc, then `code` |
| `GET /api/admin/bookings/:code` | | `AdminBooking` |
| `GET /api/admin/bookings/:code/rooms` | | `AdminBookingRoomOption[]`: every room of the room type with `available` (active, not current, free for the stay) |
| `POST /api/admin/bookings/:code/check-in` | | `AdminBooking` |
| `POST /api/admin/bookings/:code/check-out` | | `AdminBooking` |
| `POST /api/admin/bookings/:code/cancel` | `{ reason }` (trimmed, 1–500) | `AdminBooking` |
| `PUT /api/admin/bookings/:code/room` | `{ roomId }` | `AdminBooking` |

Shapes (in `@booking/shared`):

- `AdminBookingSummary`: `code`, `status` (effective, lapsed → `EXPIRED`), `checkedIn` (bool), `checkIn`,
  `checkOut`, `nights`, `guests`, `guestName`, `guestEmail`, `totalAmount`, `currency`, `paymentStatus` (latest
  attempt or null), `hotel {id, name}`, `roomType {id, name}`, `room {id, number}`, `createdAt`.
- `AdminBooking`: the summary + `guestPhone`, `customer {name, email}`, `expiresAt`, `cancelledAt`,
  `cancelReason`, `checkedInAt`, `checkedOutAt`, `payment {status, amount, provider, paidAt, refundedAt} | null`,
  `hotel {id, name, checkInTime, checkOutTime}`, and action flags `canCheckIn`, `canCheckOut`, `canCancel`,
  `canMoveRoom` (computed from the same rules, so the UI never re-implements them).

## web-admin

- Nav: append `{ href: "/bookings", label: "การจอง", icon: CalendarCheck }`.
- `/bookings`: filters in the URL (`features/bookings/list-params.ts`, same pattern as hotels): hotel select
  (from the admin hotel list), status select, date range (the existing `Popover` + `Calendar` range pattern), search
  box. `DataTable` with code, guest, hotel/room, dates + nights, status badge, payment badge, amount. Row → detail.
  Loading / error / empty states.
- `/bookings/[code]`: header (code, status badge), cards: Stay (hotel, room type, room number, dates, guests),
  Guest (name, email, phone, account), Payment (amount, status, paid / refunded times, a refund-failed warning),
  and History (created, checked in/out, cancelled + reason). Action bar shows only allowed actions:
  - Check in / Check out: confirm in an `AlertDialog`.
  - Cancel: `AlertDialog` with a required reason `Textarea` (react-hook-form + shared schema). Says a paid
    booking will be refunded in full.
  - Move room: `Select` of the room options (unavailable ones disabled) + confirm.
- `features/bookings/`: `api.ts`, `hooks.ts` (`adminBookingKeys.list(query)`, `.detail(code)`, `.rooms(code)`;
  every action sets the detail cache and invalidates lists and rooms), components. Thai copy; new API messages go
  into `messages-th.ts`.
- No new shadcn components or dependencies.

## Tests (API, `routes/admin/bookings.test.ts`)

Access: web session 401, CUSTOMER 403, STAFF sees only their hotels, foreign `hotelId` 403, foreign booking 404.
List: filters (hotel, every status including `CHECKED_IN` vs `CONFIRMED`, a lapsed hold shows as `EXPIRED`, date
overlap, q), pagination. Check-in: OK on the check-in day, 409 before it, 409 twice. Check-out → `COMPLETED`, frees
the room (a new booking for the remaining nights succeeds), 409 if not checked in. Cancel: reason required (400),
paid → `REFUNDED` (mock provider), 409 when checked in / already cancelled. Move: OK to a free room, 409 to an
occupied one, 400/404 for a room of another room type, inactive room 409. Customer cancel still refunds (it now goes
through the moved function).

Dates in tests use `now` injection into the service where needed. Route tests seed bookings directly with
prisma (unique code prefix), clean up in `after()`.
