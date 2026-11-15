# Rate periods (Phase 6.3) — Design

Date: 2026-11-15
Status: Decided by the builder (short directive "start 6.3"), following the 6.2 patterns
Roadmap: `PLAN.md` Phase 6 → 6.3 · Branch: `feat/admin-rate-periods`

## Intent

Staff and admins set seasonal prices per room type: a rate period overrides the room type's `basePrice` for
every night in `[startDate, endDate)`. Pricing already reads rate periods (`priceNights`, `quoteStays`), so
customers see the new prices with no public change. Existing bookings keep their stored `totalAmount`.

## Goals

- List a room type's rate periods (by start date), create, edit, delete.
- Overlapping periods of the same room type → `409 CONFLICT` naming the period it overlaps. The service checks
  first for a readable message; the DB exclusion constraint `rate_periods_no_overlap` is the backstop
  (a concurrent overlap → 23P01, or a deadlock P2034 → both `409`).
- Every endpoint enforces hotel access; a room type outside the hotel / a period outside the room type → `404`.

## Non-goals

- A calendar view (list only — a room type has a handful of periods), bulk copy between room types,
  per-weekday prices, minimum stays.
- Re-pricing existing bookings.

## Decisions

| Topic | Decision |
| --- | --- |
| Who | ADMIN + assigned STAFF (rates are day-to-day hotel work, like 6.2) |
| Routes | `/api/admin/hotels/:hotelId/room-types/:roomTypeId/rate-periods` (router `rate-periods.ts`, `mergeParams`, mounted in `room-types.ts`, so behind `requireHotelAccess()`) |
| List | `GET …/rate-periods` → `AdminRatePeriod[]` ordered by `startDate` |
| Create | `POST …/rate-periods` body `ratePeriodInputSchema` → `201` `AdminRatePeriod` |
| Edit | `PUT …/rate-periods/:ratePeriodId` same body → `200` `AdminRatePeriod` |
| Delete | `DELETE …/rate-periods/:ratePeriodId` → `204` (no dependents; bookings store their own totals) |
| Shape | `AdminRatePeriod`: `id, name (nullable), startDate, endDate (YYYY-MM-DD, end exclusive), nights, price, createdAt, updatedAt` |
| Fields | name ≤ 80 (`""` → null); dates ISO; `endDate > startDate`; at most 366 nights; price same rules as `basePrice` (0–99,999,999.99, ≤ 2 decimals) |
| Past dates | Allowed (no harm — history only); the UI labels ended periods "Ended" |
| Room type | Works on inactive room types too. `deletable` on `AdminRoomType` already counts rate periods |

## web-admin

`/hotels/[hotelId]/room-types/[roomTypeId]` gets a **Rates** card under Rooms:

- Base price reminder + table (name, nights as `12 – 15 Apr 2027` + night count, price per night, Ended badge,
  Edit / Delete) with loading / error / empty states.
- "Add rate period" opens an inline form (name, date range picker, price); Edit swaps the same form in for
  that period. Overlap / validation errors show under the form.
- Delete asks in an `AlertDialog`.
- `features/rate-periods/`: `api.ts`, `hooks.ts` (`adminRatePeriodKeys.list(hotelId, roomTypeId)`; writes
  invalidate the list and the room type detail — `deletable` depends on it), components.
- Date range picker in web-admin (`Popover` + `Calendar`, `mode="range"`), any dates, max 366 nights.

## Tests (API)

Access (unassigned STAFF 403, web session 401, foreign room type / period 404), create (201, shape, nights),
validation (end ≤ start, too long, price decimals), overlap → 409 (adjacent periods allowed), edit (including
moving onto itself is not an overlap), delete 204, list order, the public quote uses the new price, room type
`deletable` false while it has a period.
