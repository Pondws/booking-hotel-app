# Reviews (Phase 7) — Design

Date: 2026-11-16
Status: Approved (user approved the proposal and asked for small sub-tasks; every other choice is the builder's call, stated below)
Roadmap: `PLAN.md` Phase 7 → 7.1–7.4

## Intent

Guests who finished a stay rate the hotel (1–5 stars + optional comment). Other customers see the reviews and the
average on the hotel page; the search already sorts by `Hotel.ratingAvg`, so the number becomes real. Staff can hide
an inappropriate review, which drops it from the page and the average.

## Goals

- One review per `COMPLETED` booking, written by its owner only.
- `Hotel.ratingAvg` / `reviewCount` always equal the visible (not hidden) reviews — recomputed in the same
  `$transaction` as every write that changes them.
- Public, paginated review list on the hotel page.
- Back-office list with hide / unhide, scoped like bookings (STAFF → own hotels), audit-logged.

## Non-goals

- Customer edits or deletes a review (builder's call — keeps the average stable; revisit if asked).
- Hotel replies, photos, helpful votes, sort options, rating sub-scores.
- Seeded reviews.

## Anti-goals

- Trusting the body for `userId` / `hotelId` / `bookingId` — they come from the booking only.
- Exposing the reviewer's email or full name publicly.

## Approaches

| Option | Trade-off | Picked |
| --- | --- | --- |
| Denormalized `ratingAvg`/`reviewCount` recomputed (aggregate) in the write transaction | search sort stays a column read; one aggregate per write | ✅ (columns already exist, search uses them) |
| Compute the average on read | always correct, but the search sort would need a join + group by per query | – |
| Incremental `avg = (avg*n + r)/(n+1)` | cheap, but drifts and is awkward for hide/unhide | – |

Recompute uses `aggregate({ _avg, _count })` over `Review where { hotelId, isHidden: false }`, after locking the hotel
row (`SELECT … FOR UPDATE`) so two concurrent writes for one hotel can't interleave.

## Decisions

### Schema (one additive migration)
- `Review.isHidden Boolean @default(false)`, `hiddenAt DateTime?`.
- `@@index([hotelId, isHidden, createdAt])` (replaces the plain `hotelId` index use for listing).
- Raw-SQL CHECK `reviews_rating_range` (`rating BETWEEN 1 AND 5`) + a case in `prisma/checks/constraints.sql`.
- `AuditEntityType` gains `REVIEW`.
- `ratingAvg` stays `Float`; the API rounds to 1 decimal for display only on the FE.

### Shared (`@booking/shared`)
- `REVIEW_COMMENT_MAX = 1000`; `createReviewSchema = { rating: int 1–5, comment?: trimmed string ≤ max, "" → undefined }`.
- `reviewSchema` (own review on a booking): `{ rating, comment, createdAt }`.
- `publicReviewSchema`: `{ id, rating, comment, authorName, stayedAt (checkOut as YYYY-MM-DD; FE shows month + year), createdAt }`;
  `authorName` = first word of `User.name`.
- Booking detail gains `reviewable: boolean` and `review: reviewSchema | null`.
- `adminReviewSchema`: public fields + `isHidden`, `hiddenAt`, `hotel { id, name }`, `bookingCode`, guest full name.

### API
- **7.1** `POST /api/bookings/:code/review` (web session, `requireAuth`): not the owner → 404 (same as booking detail);
  status ≠ `COMPLETED` → 409 `CONFLICT`; already reviewed → 409 `CONFLICT` (pre-check + unique `bookingId` backstop
  via `isUniqueViolationOn`). Creates + recomputes in one transaction, returns 201 with the booking detail.
  `reviewable = status === COMPLETED && review === null`.
- **7.3** `GET /api/hotels/:slug/reviews?page=&pageSize=` — visible reviews, newest first, same pagination shape as the
  hotel list; unknown/inactive slug → 404.
- **7.4** `GET /api/admin/reviews?hotelId=&visibility=all|visible|hidden&page=` and
  `PATCH /api/admin/reviews/:id { isHidden }` — STAFF limited to their hotels (list filtered, PATCH on another hotel's
  review → 404); conditional update, recompute in the same transaction, audit row `REVIEW` with the `isHidden` change.
  No-op PATCH (same value) returns the review without an audit row.

### web
- **7.2** `/account/bookings/[code]`: `ReviewCard` — when `reviewable`, a form (star picker built from lucide `Star` +
  a radio group for keyboard/a11y, comment textarea, react-hook-form + `createReviewSchema`); when `review`, a read-only
  view. Mutation invalidates the booking detail + list.
- **7.3** Hotel detail: `ReviewsSection` — average + count header, list, "ดูเพิ่มเติม"/"Show more" via
  `useInfiniteQuery`; empty state "No reviews yet".

### web-admin
- **7.4** Nav item "รีวิว" (`MessageSquare`), `/reviews` table: hotel filter + visibility filter in the URL
  (`list-params.ts`), hide/unhide button with confirm dialog; History tab not needed (audit rows show on the hotel's
  history via `hotelId`).

## Sub-tasks (each one PR)

1. **7.1** Migration + shared schemas + `POST /review` + booking `reviewable`/`review` + tests.
2. **7.2** web review form on the booking page.
3. **7.3** Public review list API + hotel page section.
4. **7.4** Admin moderation (API + web-admin page) + audit.

## Left to the builder

Component file names, exact Thai/English copy, page size (default 10), test fixture layout.
