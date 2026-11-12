# Public Catalog + Availability (Phase 3) — Design

Date: 2026-11-12
Status: Approved in chat, awaiting written-spec review
Roadmap: `PLAN.md` Phase 3

## Goal

Customers on `apps/web` search active hotels by city, dates and guests, page through results, open a
hotel page, and see real availability and prices for their chosen dates. The API computes all prices and
availability; the web app only displays them.

## Decisions

| Topic | Decision |
| --- | --- |
| Max stay | 30 nights (`MAX_NIGHTS`) |
| "Today" | Calendar date in `Asia/Bangkok` (`BOOKING_TZ`), computed by one shared helper used by FE and API |
| Date format | `YYYY-MM-DD` strings on the wire; nights are half-open `[checkIn, checkOut)` |
| Blocking booking | `CONFIRMED`, or `PENDING` with `expiresAt` null or `> now()`. `CANCELLED`, `EXPIRED`, `COMPLETED` and expired `PENDING` never block |
| Overlap | `booking.checkIn < :checkOut AND booking.checkOut > :checkIn` (same as `daterange [)` `&&`) |
| Query approach | Prisma relation filters (`some`/`none`) so `count` + `skip/take` pagination stay in the DB; pricing in TS. No raw SQL |
| Money | Computed with `Prisma.Decimal`; serialized as JSON numbers in major units (e.g. `3200`, `4500.5`) |
| Pagination | `page` (default 1), `pageSize` (default 12, max 50). Response `{ items, page, pageSize, total, totalPages }` inside `{ data }` |
| Date picker | shadcn `calendar` + `popover` added to `packages/ui` (new deps `react-day-picker`, `date-fns` — approved) |
| web-admin | Its hotel list keeps calling `GET /api/hotels` and reads `data.items` until Phase 6 adds an admin list |
| Execution | Inline, task by task; each task ends with lint/typecheck/test, commit and push |
| Out of scope | City autocomplete, sort options, maps, reviews list (Phase 7), booking flow (Phase 4 — detail page shows a disabled "Book" button) |

No schema migration is needed. Existing indexes (`hotels.city`, `bookings(room_id, check_in)`,
`rate_periods(room_type_id, start_date)`) cover the queries.

## Shared (`packages/shared`)

Constants and helpers:
- `BOOKING_TZ = "Asia/Bangkok"`, `MAX_NIGHTS = 30`.
- `todayIn(tz: string, now = new Date()): string` → `YYYY-MM-DD` via `Intl.DateTimeFormat("en-CA", { timeZone })`.
- `nightsBetween(checkIn: string, checkOut: string): number` (UTC date arithmetic).

Schemas:
- `isoDate = z.iso.date()`.
- `stayRangeSchema` — `{ checkIn, checkOut, guests }`, `guests = z.coerce.number().int().min(1).max(20).default(1)`.
  Refinements (each with a `path` so form errors land on the field):
  - `checkIn >= todayIn(BOOKING_TZ)` → path `checkIn`, "Check-in can't be in the past"
  - `checkOut > checkIn` → path `checkOut`
  - `nightsBetween ≤ MAX_NIGHTS` → path `checkOut`, "Stays are limited to 30 nights"
- `hotelSearchQuerySchema` — `{ city?, checkIn?, checkOut?, guests?, page, pageSize }`:
  - `city`: trimmed, 1–80 chars, optional (empty string treated as absent).
  - `checkIn` and `checkOut` both present or both absent (path `checkOut`); when present, the same date
    rules as `stayRangeSchema`.
  - `page = z.coerce.number().int().min(1).default(1)`, `pageSize = z.coerce.number().int().min(1).max(50).default(12)`.
- `paginated(item)` → `z.object({ items: z.array(item), page, pageSize, total, totalPages })`.
- `imageSchema` `{ url, alt: nullable }`, `amenitySchema` `{ code, name }`.
- `hotelSummarySchema` — `{ id, name, slug, city, currency, ratingAvg, reviewCount, coverImage: imageSchema.nullable(), fromPrice: z.number().nullable() }`.
- `roomTypeSchema` — `{ id, name, description: nullable, capacity, basePrice: number, images, amenities }`.
- `hotelDetailSchema` — `{ id, name, slug, city, address, description: nullable, currency, ratingAvg, reviewCount, images, amenities, roomTypes }`.
- `stayQuoteSchema` — `{ nights, nightly: [{ date, price }], total, currency }`.
- `availabilitySchema` — `{ checkIn, checkOut, guests, nights, roomTypes: [{ roomTypeId, available, availableRooms, quote: stayQuoteSchema }] }`.

The existing `hotelSchema`/`hotelListSchema` stay for the admin create response; the admin list switches to
`paginated(hotelSummarySchema)`.

## API (`apps/api`)

### `lib/stay-pricing.ts` (pure, no Prisma client)
```ts
priceNights(
  basePrice: Decimal,
  periods: { startDate: Date; endDate: Date; price: Decimal }[],
  checkIn: string,
  checkOut: string,
): { nights: number; nightly: { date: string; price: Decimal }[]; total: Decimal }
```
For each night `d` in `[checkIn, checkOut)`, use the period with `startDate ≤ d < endDate`, otherwise
`basePrice`. Periods never overlap (DB constraint), so at most one matches.

### `services/pricing.service.ts`
- `quoteStays(roomTypes: { id, basePrice }[], currency, checkIn, checkOut)` → `Map<roomTypeId, StayQuote>`.
  One `ratePeriod.findMany` for all ids with `startDate < checkOut AND endDate > checkIn`.
- `quoteStay(roomTypeId, checkIn, checkOut)` → `StayQuote`; 404 `NOT_FOUND` if the room type is missing or
  inactive. Currency comes from the hotel. (Phase 4 reuses this.)

### `services/availability.service.ts`
- `blockingBookingWhere(checkIn, checkOut, now)` — the shared Prisma `BookingWhereInput` for an overlapping,
  blocking booking (used by both search and counts).
- `availableRoomCounts(roomTypeIds, checkIn, checkOut)` → `Map<roomTypeId, number>`: `room.groupBy` /
  `findMany` of active rooms with `bookings: { none: blockingBookingWhere(...) }`. Missing ids map to 0.

### `services/hotel.service.ts`
- `searchHotels(query)`:
  - `where`: `isActive`, optional `city: { contains, mode: "insensitive" }`, and when `guests` or dates are
    given, `roomTypes: { some: { isActive, capacity ≥ guests, rooms: { some: { isActive, bookings: { none: blocking } } } } }`
    (the `rooms` part only with dates).
  - `count` + `findMany` (`orderBy: [{ ratingAvg: "desc" }, { name: "asc" }]`, `skip/take`), including the first
    image by `sortOrder` and the matching active room types (`id`, `basePrice`, `capacity`).
  - `fromPrice`: with dates — lowest `total / nights` among room types with available rooms (via
    `availableRoomCounts` + `quoteStays`, one query each for the whole page); without dates — lowest
    `basePrice` among matching room types; `null` if none.
  - `listActiveHotels` is removed (replaced by `searchHotels`).
- `getHotelBySlug(slug)` → active hotel with images (sorted), amenities, active room types (sorted by
  `basePrice`) with images and amenities. Missing/inactive → `AppError(404, "NOT_FOUND", "Hotel not found")`.
- `getAvailability(slug, range)` → loads the active hotel (404 as above), its active room types with
  `capacity ≥ guests`, then `availableRoomCounts` + `quoteStays`. `available = availableRooms > 0`.

### Routes / controllers
| Method | Path | Validation | Response |
| --- | --- | --- | --- |
| GET | `/api/hotels` | `query: hotelSearchQuerySchema` | `paginated(hotelSummary)` |
| GET | `/api/hotels/:slug` | `params: { slug }` | `hotelDetail` |
| GET | `/api/hotels/:slug/availability` | `params` + `query: stayRangeSchema` | `availability` |

Controllers read `res.locals.query` / `res.locals.params` (set by `validate`) and call services only. Invalid
query → 400 `VALIDATION_FAILED` with field details (existing error handler).

## Web (`apps/web`)

Order: `DESIGN.md` (impeccable) → `packages/ui` components (`calendar`, `popover`, plus `skeleton` /
`select` if needed via `npm run ui:add`) → features → pages.

- `features/hotels/api.ts` — `searchHotels(params)`, `fetchHotel(slug)`, `fetchAvailability(slug, range)`.
- `features/hotels/hooks.ts` — key factory:
  - `hotelKeys.all = ["hotels"]`
  - `hotelKeys.list(params)`, `hotelKeys.detail(slug)`, `hotelKeys.availability(slug, range)`
  - `useHotelSearch(params)` with `placeholderData: keepPreviousData`
  - `useHotel(slug)`, `useAvailability(slug, range | null)` (`enabled` only with a valid range)
  - `usePrefetchHotel()` → `queryClient.prefetchQuery(detail)` on card hover/focus
- `features/hotels/search-params.ts` — parse/serialize URL search params ↔ `HotelSearchQuery` (invalid values
  dropped, not thrown).
- Components:
  - `search-bar.tsx` — city input, date range picker (`calendar` in `popover`, past days and > 30 nights
    disabled), guests input; submits to `/hotels?...`. react-hook-form + zod resolver using the shared schema.
  - `hotel-card.tsx`, `hotel-results.tsx` (grid + pagination + loading skeleton / error / empty states).
  - `hotel-gallery.tsx`, `amenity-list.tsx` (code → lucide icon map, fallback icon).
  - `room-type-card.tsx` — base price without dates; with dates the quote total + per-night breakdown, or a
    "Sold out" badge; disabled "Book" button (Phase 4).
  - `hotel-detail.tsx` — header, gallery, amenities, inline stay picker (updates the URL), room type list.
- Pages (Server Components that render client components inside `<Suspense>` because they read search params):
  - `/` — hero + search bar + first page of results.
  - `/hotels` — search bar (prefilled) + results.
  - `/hotels/[slug]` — hotel detail; not-found state for 404.
- web-admin: `features/hotels/api.ts` list fetcher parses `paginated(hotelSummarySchema)` and returns `items`.

## Error handling

- API: zod failures → 400 `VALIDATION_FAILED`; unknown/inactive slug → 404 `NOT_FOUND`. No new error codes.
- Web: 404 on detail → "Hotel not found" state with a link back to search; other errors → error state with retry.
  A search URL with invalid params falls back to defaults instead of erroring.

## Testing

- Unit (`node:test`):
  - `stay-pricing.test.ts` — all base price; fully inside a period; stay crossing a period start; crossing a
    period end (end date exclusive); two periods in one stay; one-night stay.
  - `shared-schemas.test.ts` — past check-in rejected, today accepted (Bangkok), 30 nights ok / 31 rejected,
    `checkOut ≤ checkIn` rejected, half a date range rejected, page defaults.
  - `todayIn` around Bangkok midnight (UTC 16:59 vs 17:00).
- Integration (supertest, real dev DB): each test file creates its own hotel(s) with a unique name prefix,
  room types, rooms, rate periods, a test user and bookings, and deletes them in `after()`. Never touch seed rows.
  - `availability.service` — CONFIRMED blocks; non-expired PENDING blocks; expired PENDING, CANCELLED, EXPIRED,
    COMPLETED don't; adjacent stays (checkOut = other checkIn) don't; inactive rooms aren't counted.
  - `GET /api/hotels` — filters by city (case-insensitive), excludes inactive hotels, excludes hotels whose
    only room type is fully booked for the dates, `guests` filter, pagination meta, `fromPrice` with and
    without dates, 400 on bad dates.
  - `GET /api/hotels/:slug` — shape, inactive room types hidden, 404 for unknown/inactive.
  - `GET /api/hotels/:slug/availability` — quote across a rate period, sold-out room type, capacity filter, 400.
- UI: verified in the browser with `next-dev-loop` (search → results → paging → detail → change dates).
- Before closing the phase: lint, typecheck, `npm test`, `npm run db:check`, impeccable audit + polish.
