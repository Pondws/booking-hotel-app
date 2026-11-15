# Reviews 7.1 — Submit a review (API) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A customer can review their own `COMPLETED` booking once; the hotel's `ratingAvg`/`reviewCount` update in the same transaction; the booking detail says whether it can be reviewed and shows the review.

**Architecture:** One additive migration (`isHidden`, `hiddenAt`, listing index). A new `review.service.ts` owns review writes and the rating recompute (reused by 7.4). The route hangs off the existing `bookingsRouter` (`loadSession('WEB') + requireAuth`). `bookingSelect`/`toBooking` gain the review.

**Tech Stack:** Express 5, Prisma 7 (Postgres), zod v4, node:test + supertest.

**Spec:** `docs/superpowers/specs/2026-11-16-reviews-design.md`

## Global Constraints

- Layering `route → controller → service → prisma`; controllers never import prisma.
- `userId` / `hotelId` / `bookingId` come from the booking, never the body.
- Recompute counts only `isHidden: false` reviews; `ratingAvg` = 0 when there are none.
- Errors: not owner → 404 `NOT_FOUND` "Booking not found"; not `COMPLETED` or already reviewed → 409 `CONFLICT`.
- `REVIEW_COMMENT_MAX = 1000`; rating int 1–5.
- Tests use a unique label prefix and clean up in `after()`; never touch seeded rows.

## Review Focus

1. Two concurrent POSTs for the same booking → one 201, one 409 (not 500) — unique `bookingId` backstop.
2. Comment of only whitespace → stored as `null`, not `""`.
3. Body with `hotelId`/`userId` of another hotel/user → ignored; review lands on the booking's hotel.
4. A hidden review already on the hotel → not counted in the recomputed average.
5. Cleanup: fixtures delete reviews before bookings (FK `Restrict`) — otherwise every later test run fails.

---

### Task 1: Schema, shared schemas, booking detail fields

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `Review`)
- Create: migration via `npm run db:migrate -- --name review_hidden`
- Modify: `packages/shared/src/index.ts` (booking section)
- Modify: `apps/api/src/services/booking.service.ts` (`bookingSelect`, `toBooking`)
- Modify: `apps/api/src/test/catalog-fixtures.ts` (`addBooking`, `clearBookings`, `cleanupCatalogFixtures`)
- Test: `apps/api/src/routes/bookings.test.ts` (reads describe)

**Interfaces:**
- Produces (shared): `REVIEW_COMMENT_MAX = 1000`; `createReviewSchema` → `CreateReviewData = { rating: number; comment?: string }`
  (comment: trim, `""` → undefined, max 1000); `reviewSchema = { rating: int 1–5, comment: string | null, createdAt: iso datetime }` → `Review`;
  `bookingSchema` gains `reviewable: boolean`, `review: reviewSchema.nullable()`.
- Produces (fixtures): `addBooking(fx, roomId, checkIn, checkOut, status, expiresAt = null, userId = fx.userId)`.

- [ ] **Step 1: Schema** — on `Review` add `isHidden Boolean @default(false) @map("is_hidden")`, `hiddenAt DateTime? @map("hidden_at")`,
  `@@index([hotelId, isHidden, createdAt])`. Run `npm run db:migrate -- --name review_hidden`; expect a migration with two
  `ADD COLUMN` + one `CREATE INDEX` only.
- [ ] **Step 2: Fixtures** — `addBooking` takes optional `userId`; `clearBookings` and `cleanupCatalogFixtures` delete
  `review` rows for the same booking filters before deleting bookings (FK `Restrict`).
- [ ] **Step 3: Failing test** in `bookings.test.ts` "reads":

```ts
test("a COMPLETED booking is reviewable with no review; others are not", async () => {
  const done = await addBooking(fx, fx.roomTypes[1]!.roomIds[0]!, "2030-03-01", "2030-03-03", "COMPLETED", null, alice.id);
  const res = await get(`/api/bookings/${done.code}`, aliceCookie);
  assert.equal(res.status, 200);
  const b = bookingSchema.parse(res.body.data);
  assert.equal(b.reviewable, true);
  assert.equal(b.review, null);
  // and an existing CONFIRMED booking from this describe: reviewable false
});
```

- [ ] **Step 4:** `npm test` → the new test fails (`reviewable` missing from parse).
- [ ] **Step 5: Implement** — shared schemas above; `bookingSelect.review = { select: { rating, comment, createdAt } }`;
  `toBooking` sets `review` (ISO `createdAt`) and `reviewable = status === "COMPLETED" && row.review === null`.
- [ ] **Step 6:** `npm test` → all pass; `npm run typecheck` passes (web/web-admin consumers of `Booking` still compile).
- [ ] **Step 7: Commit** `feat(api): review hidden flag + booking reviewable/review fields`, push.

### Task 2: `POST /api/bookings/:code/review`

**Files:**
- Create: `apps/api/src/services/review.service.ts`
- Modify: `apps/api/src/controllers/booking.controller.ts` (add `review`)
- Modify: `apps/api/src/routes/bookings.ts`
- Create: `apps/api/src/routes/reviews.test.ts` (own label `rv-http`)

**Interfaces:**
- Consumes: Task 1 schemas, `findMyBooking`-style read via exported `getMyBooking(user, code, now)`.
- Produces: `createMyReview(user: PublicUser, code: string, input: CreateReviewData, now?: Date): Promise<Booking>`;
  `recomputeHotelRating(tx: Prisma.TransactionClient, hotelId: string): Promise<void>` (exported, used by 7.4).

- [ ] **Step 1: Failing tests** (`reviews.test.ts`, alice owns bookings via `addBooking(..., alice.id)`):
  - `201 for an own COMPLETED booking: review on the booking, hotel avg/count updated` — POST `{ rating: 4, comment: "  Nice  " }` →
    201, `bookingSchema.parse`, `review.rating === 4`, `review.comment === "Nice"`, `reviewable === false`; hotel row
    `ratingAvg === 4`, `reviewCount === 1`. Second booking rated 5 → `ratingAvg === 4.5`, `reviewCount === 2`.
  - `whitespace-only comment is stored as null`.
  - `body hotelId/userId are ignored` — send `{ rating: 3, hotelId: otherFx.hotelId, userId: bob.id }` → review row has
    the booking's hotel and alice.
  - `hidden reviews are not counted` — insert a hidden review (`isHidden: true`, rating 1) on another completed booking
    directly with prisma, then POST rating 5 on a new one → avg excludes the 1.
  - `409 CONFLICT for CONFIRMED and CANCELLED bookings; 409 on a second review`.
  - `concurrent double submit → one 201 and one 409` (`Promise.all` of two POSTs).
  - `404 for bob on alice's booking; 400 VALIDATION_FAILED for rating 0, 6, 2.5 and a 1001-char comment; 401 without cookie`.
- [ ] **Step 2:** `npm test` → new tests fail with 404 (route missing).
- [ ] **Step 3: Implement `createMyReview`** — find booking `{ code, userId }` selecting `id, status, room.roomType.hotelId`
  and whether `review` exists → 404 / 409 "Only completed stays can be reviewed" / 409 "This booking already has a review".
  Then `prisma.$transaction(async (tx) => { lock; create; recomputeHotelRating(tx, hotelId) })`; map a P2002 on
  `bookingId` (`isUniqueViolationOn(err, "booking_id")` — check which field name the helper matches on) to the same 409.
  Return `getMyBooking(user, code, now)`.
- [ ] **Step 4: Implement `recomputeHotelRating`** — lock: ``await tx.$queryRaw`SELECT id FROM hotels WHERE id = ${hotelId} FOR UPDATE` ``;
  `tx.review.aggregate({ where: { hotelId, isHidden: false }, _avg: { rating: true }, _count: true })`;
  `tx.hotel.update({ data: { ratingAvg: _avg.rating ?? 0, reviewCount: _count } })`.
- [ ] **Step 5: Controller + route** — `review(req, res)` → `ok(res, await reviewService.createMyReview(currentUser(req), code, req.body), 201)`;
  route `POST /:code/review` with `validate({ params: bookingCodeParamsSchema, body: createReviewSchema })`.
- [ ] **Step 6:** `npm test` → all pass.
- [ ] **Step 7: Commit** `feat(api): POST /api/bookings/:code/review with rating recompute`, push.

### Task 3: Verify and close 7.1

- [ ] `npm run lint && npm run typecheck` → clean.
- [ ] `npm test` → all pass; `npm run db:check` → passes (rating CHECK still covered).
- [ ] Tick the 7.1 boxes in `PLAN.md`; add `review.service.ts` (`createMyReview`, `recomputeHotelRating` — the only code
  that writes `ratingAvg`/`reviewCount`) to the services list in `CLAUDE.md`.
- [ ] Commit `docs: 7.1 done`, push; give the user the PR compare URL.
