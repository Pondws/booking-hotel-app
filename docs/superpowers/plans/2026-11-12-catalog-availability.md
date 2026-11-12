# Public Catalog + Availability (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers search active hotels by city/dates/guests with pagination, open a hotel page, and see real availability and nightly-priced quotes for their dates.

**Architecture:**
- Shared zod schemas own every date rule (Bangkok "today", ≤ 30 nights) so FE forms and API validation agree.
- API: a pure `priceNights` function, a pricing service and an availability service (Prisma relation filters, bulk queries, no raw SQL), composed by `hotel.service` for search, detail and availability endpoints.
- Web: URL search params are the single source of state; TanStack Query hooks per feature; shadcn calendar/popover for the date range.

**Tech Stack:** Express 5, Prisma 7 (`Prisma.Decimal`), zod v4, node:test + supertest, Next.js 16, TanStack Query v5, react-hook-form, shadcn (`calendar` → react-day-picker + date-fns), lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-12-catalog-availability-design.md` — binding for schemas, response shapes, blocking rule and test list. Read it first.

## Global Constraints

- `BOOKING_TZ = "Asia/Bangkok"`, `MAX_NIGHTS = 30`. Dates on the wire are `YYYY-MM-DD`; nights are `[checkIn, checkOut)`.
- Blocking booking = `status = CONFIRMED` **or** (`status = PENDING` and (`expiresAt = null` or `expiresAt > now`)), overlapping when `checkIn < :checkOut AND checkOut > :checkIn`.
- `@db.Date` values are passed to Prisma as `new Date("<YYYY-MM-DD>T00:00:00.000Z")` and read back with `toISOString().slice(0, 10)` — only via the `lib/dates.ts` helpers.
- Money: `Prisma.Decimal` arithmetic only; convert to JSON number with `.toNumber()` at the service boundary.
- Messages (verbatim): `"Check-in can't be in the past"`, `"Check-out must be after check-in"`, `"Stays are limited to 30 nights"`, `"Choose both check-in and check-out"`, `"Hotel not found"`, `"Room type not found"`.
- No new error codes. No schema migration.
- New dependencies: only those pulled in by `npm run ui:add -- calendar popover skeleton` (react-day-picker, date-fns). Nothing else.
- Only services import `prisma`. Controllers read `res.locals.query` / `res.locals.params`. No `any`, no casts in production code.
- Tests run against the dev DB. Rows created by tests use the name prefix `Cat Test ` (hotels) / email `cat-test+<ts>@test.local` (users) and are deleted in `after()` in reverse FK order (bookings → rate periods → rooms → room types → images/amenities → hotels → users). Seed rows are read-only.
- Skills: Tasks 3–4 `prisma-client-api`; Task 5 `impeccable`, `shadcn`; Tasks 6–7 `tanstack-query-best-practices`, `shadcn`, `next-dev-loop`; Task 8 `impeccable`, `superpowers:verification-before-completion`.
- Every task ends with `npm run lint && npm run typecheck && npm test` green, then commit **and `git push`** (branch `feat/catalog`). Check `git show --stat HEAD` lists the task's files.

## Review Focus

1. Bangkok midnight: at `2026-11-12T17:00:00Z` "today" is `2026-11-13` — a check-in of `2026-11-12` must be rejected even though it is still the 12th in UTC. Pinned in Task 1.
2. Back-to-back stays: a booking `[Jan 10, Jan 12)` must not block a search `[Jan 12, Jan 14)`. Pinned in Task 3.
3. Rate period end is exclusive: a period `[Apr 10, Apr 17)` prices the night of Apr 16 but not Apr 17. Pinned in Task 2.
4. A page past the end (`page=99`) returns `200` with `items: []` and the real `total`/`totalPages`, not 400/404. Pinned in Task 4.
5. City input with stray whitespace and case (`"  bAnGkOk "`) still matches Bangkok; `city=` (empty) means no filter. Pinned in Task 1 (schema) and Task 4 (HTTP).

---

### Task 1: Shared catalog schemas and date helpers

**Files:**
- Modify: `packages/shared/src/index.ts`
- Test: `apps/api/src/lib/shared-schemas.test.ts` (add cases)

**Interfaces:**
- Produces (`@booking/shared`):
  - `BOOKING_TZ`, `MAX_NIGHTS`
  - `todayIn(tz: string, now?: Date): string`, `nightsBetween(checkIn: string, checkOut: string): number`
  - `stayRangeSchema`, `type StayRange = z.output<…>`, `type StayRangeInput = z.input<…>`
  - `hotelSearchQuerySchema`, `type HotelSearchQuery = z.output<…>`
  - `paginated(item)`, `type Paginated<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number }`
  - `imageSchema`, `amenitySchema`, `hotelSummarySchema` (+ `HotelSummary`), `roomTypeSchema` (+ `RoomType`), `hotelDetailSchema` (+ `HotelDetail`), `stayQuoteSchema` (+ `StayQuote`), `availabilitySchema` (+ `Availability`), `hotelSearchResultSchema = paginated(hotelSummarySchema)`
  - Field lists exactly as in the spec's Shared section.

- [ ] **Step 1: Write failing tests** in `shared-schemas.test.ts` (compute dates relative to `todayIn(BOOKING_TZ)` so the suite doesn't rot; a local `addDays(iso, n)` helper is fine in the test):
  - `todayIn("Asia/Bangkok", new Date("2026-11-12T16:59:59Z")) === "2026-11-12"` and `…T17:00:00Z` → `"2026-11-13"`.
  - `nightsBetween("2027-01-10", "2027-01-13") === 3`.
  - `stayRangeSchema`: today → +1 parses with `guests` defaulting to `1`; yesterday → issue path `["checkIn"]`, message `"Check-in can't be in the past"`; +30 nights ok; +31 → path `["checkOut"]`, `"Stays are limited to 30 nights"`; `checkOut === checkIn` → path `["checkOut"]`.
  - `hotelSearchQuerySchema`: `{}` → `{ page: 1, pageSize: 12 }` and no city/dates; `{ city: "  bAnGkOk " }` → `city === "bAnGkOk"`; `{ city: "" }` → `city === undefined`; only `checkIn` → path `["checkOut"]`, `"Choose both check-in and check-out"`; `pageSize: "51"` fails; `page: "2"` → `2`.
  - `availabilitySchema` / `hotelSearchResultSchema` parse a minimal valid sample.
- [ ] **Step 2: Run** `npm test -w apps/api -- --test-name-pattern="stay|search|todayIn|nights"` → FAIL (exports missing).
- [ ] **Step 3: Implement** in `packages/shared/src/index.ts` under a `// ---------- Catalog ----------` section. Use one internal `refineStay(ctx, checkIn, checkOut)` helper (via `superRefine`) shared by both schemas. Empty-string city → `z.preprocess` to `undefined`.
- [ ] **Step 4: Run** the same command → PASS; then `npm run typecheck`.
- [ ] **Step 5: Commit + push** — `feat(shared): catalog search, stay range and availability schemas`.

### Task 2: Pure nightly pricing

**Files:**
- Create: `apps/api/src/lib/dates.ts`, `apps/api/src/lib/stay-pricing.ts`
- Test: `apps/api/src/lib/stay-pricing.test.ts`

**Interfaces:**
- Produces:
  - `dates.ts`: `toDbDate(iso: string): Date`, `fromDbDate(d: Date): string`, `eachNight(checkIn: string, checkOut: string): string[]`
  - `stay-pricing.ts`: `type PricePeriod = { startDate: Date; endDate: Date; price: Prisma.Decimal }`; `priceNights(basePrice: Prisma.Decimal, periods: PricePeriod[], checkIn: string, checkOut: string): { nights: number; nightly: { date: string; price: Prisma.Decimal }[]; total: Prisma.Decimal }`

- [ ] **Step 1: Write failing tests** (base `3200`, period `[2027-04-10, 2027-04-17)` at `4500`):
  - no periods, `2027-01-10 → 01-13` → nights 3, total `9600`, nightly dates `["2027-01-10","2027-01-11","2027-01-12"]`.
  - fully inside `04-11 → 04-13` → total `9000`.
  - crossing start `04-08 → 04-12` → nightly prices `[3200, 3200, 4500, 4500]`, total `15400`.
  - crossing end `04-15 → 04-18` → `[4500, 4500, 3200]` (night of 04-17 is base).
  - two periods in one stay (add `[04-17, 04-20)` at `5000`), `04-16 → 04-18` → `[4500, 5000]`.
  - one night with decimal base `1999.50` → total `.toNumber() === 1999.5`.
- [ ] **Step 2: Run** `npm test -w apps/api -- --test-name-pattern="priceNights"` → FAIL.
- [ ] **Step 3: Implement** both files. `eachNight` iterates UTC days; `priceNights` compares ISO strings (`fromDbDate(start) <= d && d < fromDbDate(end)`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit + push** — `feat(api): nightly stay pricing with rate periods`.

### Task 3: Availability and pricing services

**Files:**
- Create: `apps/api/src/services/availability.service.ts`, `apps/api/src/services/pricing.service.ts`
- Create: `apps/api/src/test/catalog-fixtures.ts` (test-only builder: `createCatalogFixture(label)` returns ids for 1 hotel / room types / rooms / a user, plus `cleanupCatalogFixtures()` that deletes everything with the `Cat Test ` prefix)
- Test: `apps/api/src/services/availability.service.test.ts`, `apps/api/src/services/pricing.service.test.ts`

**Interfaces:**
- Consumes: Task 2 `toDbDate`, `priceNights`; Task 1 `StayQuote`.
- Produces:
  - `blockingBookingWhere(checkIn: string, checkOut: string, now?: Date): Prisma.BookingWhereInput`
  - `availableRoomCounts(roomTypeIds: string[], checkIn: string, checkOut: string, now?: Date): Promise<Map<string, number>>` (every requested id present; 0 when none)
  - `quoteStays(roomTypes: { id: string; basePrice: Prisma.Decimal }[], currency: string, checkIn: string, checkOut: string): Promise<Map<string, StayQuote>>`
  - `quoteStay(roomTypeId: string, checkIn: string, checkOut: string): Promise<StayQuote>` — 404 `NOT_FOUND` `"Room type not found"` for missing/inactive room type or inactive hotel.

- [ ] **Step 1: Write failing availability tests** — fixture room type with 2 active rooms + 1 inactive room; range `2030-01-10 → 2030-01-12`:
  - no bookings → count `2` (inactive room not counted).
  - one CONFIRMED overlapping → `1`; both rooms blocked (CONFIRMED + PENDING with `expiresAt` = now + 10 min) → `0`.
  - PENDING with `expiresAt` = now − 1 min, CANCELLED, EXPIRED, COMPLETED on both rooms → `2`.
  - booking `[2030-01-08, 2030-01-10)` and `[2030-01-12, 2030-01-14)` (adjacent) → `2`.
  - unknown id in the input → map has it with `0`.
- [ ] **Step 2: Write failing pricing tests** — `quoteStay` over a fixture rate period returns `{ nights, nightly: [{ date, price: number }], total: number, currency: "THB" }`; `quoteStays` for 2 room types issues results for both; `quoteStay("nope", …)` rejects with an `AppError` status 404.
- [ ] **Step 3: Run** `npm test -w apps/api -- --test-name-pattern="availab|quote"` → FAIL.
- [ ] **Step 4: Implement** — `availableRoomCounts` uses `prisma.room.groupBy({ by: ["roomTypeId"], where: { roomTypeId: { in }, isActive: true, bookings: { none: blockingBookingWhere(...) } }, _count: { _all: true } })`. `quoteStays` does one `ratePeriod.findMany({ where: { roomTypeId: { in }, startDate: { lt: toDbDate(checkOut) }, endDate: { gt: toDbDate(checkIn) } } })` and groups in memory.
- [ ] **Step 5: Run** → PASS. Run `npm run db:check` (no constraint changes expected, should still pass).
- [ ] **Step 6: Commit + push** — `feat(api): availability and pricing services`.

### Task 4: Catalog endpoints (search, detail, availability) + admin list fetcher

**Files:**
- Modify: `apps/api/src/services/hotel.service.ts` (remove `listActiveHotels`; add the three functions)
- Modify: `apps/api/src/controllers/hotel.controller.ts`, `apps/api/src/routes/hotels.ts`
- Modify: `apps/api/src/services/hotel.service.test.ts` (replace the `listActiveHotels` test with a `searchHotels` inactive-hotel test)
- Modify: `apps/web-admin/src/features/hotels/api.ts` (list parses `hotelSearchResultSchema`, returns `.items`; `pageSize: 50`) and its list component if it uses fields not in `HotelSummary`
- Test: `apps/api/src/routes/hotels.test.ts`

**Interfaces:**
- Consumes: Task 1 schemas/types, Task 3 services.
- Produces:
  - `searchHotels(query: HotelSearchQuery): Promise<Paginated<HotelSummary>>`
  - `getHotelBySlug(slug: string): Promise<HotelDetail>`
  - `getAvailability(slug: string, range: StayRange): Promise<Availability>`
  - Routes `GET /api/hotels`, `GET /api/hotels/:slug`, `GET /api/hotels/:slug/availability` with `validate({ query, params: z.object({ slug: z.string().min(1).max(200) }) })`.

- [ ] **Step 1: Write failing HTTP tests** (`hotels.test.ts`, fixture hotels in city `Cat Test City <ts>`; one hotel "A" with room type cap 2 base 1000 (1 room) + cap 4 base 3000 (1 room) + rate period on cap 2; hotel "B" cap 2 base 500 with its only room CONFIRMED-booked for the test range; hotel "C" inactive):
  - `?city=<city>` → A and B, not C; `total === 2`; items have `coverImage`, `fromPrice` (`A.fromPrice === 1000` without dates).
  - `?city=<CITY uppercased with spaces>` → same 2 hotels.
  - with the test range → only A; `A.fromPrice === lowest total/nights`.
  - `&guests=3` → only A (and A's fromPrice now from the cap-4 room type).
  - `&pageSize=1&page=2` → 1 item, `totalPages === 2`; `&page=99` → `200`, `items: []`, `total === 2`.
  - `?checkIn=<yesterday>&checkOut=<today>` → 400 `VALIDATION_FAILED`.
  - `GET /:slug` for A → images sorted by `sortOrder`, amenities `{ code, name }`, inactive room type hidden, `basePrice` is a number; C's slug and `nope` → 404 `"Hotel not found"`.
  - `GET /:slug/availability` for A with the range crossing the rate period → cap-2 quote total matches manual sum; `guests=3` drops the cap-2 room type; for B → `available: false, availableRooms: 0`; missing `checkOut` → 400.
- [ ] **Step 2: Run** `npm test -w apps/api -- --test-name-pattern="hotels"` → FAIL.
- [ ] **Step 3: Implement** service functions per the spec (`orderBy: [{ ratingAvg: "desc" }, { name: "asc" }]`, room types sorted by `basePrice`), controllers and routes. `totalPages = Math.max(1, Math.ceil(total / pageSize))`.
- [ ] **Step 4: Run** `npm test` (whole suite) → PASS; `npm run typecheck` covers web-admin.
- [ ] **Step 5: Manual check** — `npm run dev:api`, `curl "http://localhost:8000/api/hotels?city=bangkok"` returns the seeded hotel with `fromPrice: 3200`.
- [ ] **Step 6: Commit + push** — `feat(api): hotel search, detail and availability endpoints`.

### Task 5: DESIGN.md and UI primitives

**Files:**
- Create: `DESIGN.md` (repo root) — produced with the `impeccable` skill: product context (customer booking + back-office), tone, color/typography/spacing tokens mapped to the existing `packages/ui/src/styles/globals.css` variables, component usage rules, states (loading/empty/error) conventions.
- Create via `npm run ui:add -- calendar popover skeleton`: `packages/ui/src/components/{calendar,popover,skeleton}.tsx` (+ lockfile/deps)
- Modify: `packages/ui/src/styles/globals.css` only if `DESIGN.md` changes tokens; `CLAUDE.md` Structure line mentioning `DESIGN.md`.

**Interfaces:**
- Produces: `@booking/ui/components/calendar` (`Calendar`), `@booking/ui/components/popover` (`Popover`, `PopoverTrigger`, `PopoverContent`), `@booking/ui/components/skeleton` (`Skeleton`).

- [x] **Step 1:** Run the `impeccable` skill to write `DESIGN.md` from the existing theme.
- [x] **Step 2:** `npm run ui:add -- calendar popover skeleton`; confirm only react-day-picker / date-fns (and their transitive deps) were added: `git diff --stat package-lock.json packages/ui/package.json`.
- [x] **Step 3:** `npm run lint && npm run typecheck && npm run build -w apps/web` → green.
- [x] **Step 4: Commit + push** — `feat(ui): DESIGN.md, calendar, popover and skeleton`.

### Task 6: Web search bar, home and results page

**Files:**
- Modify: `apps/web/src/features/hotels/api.ts`, `apps/web/src/features/hotels/hooks.ts`
- Create: `apps/web/src/features/hotels/search-params.ts`
- Create: `apps/web/src/features/hotels/components/{search-bar,date-range-field,hotel-card,hotel-results,pagination}.tsx`
- Delete: `apps/web/src/features/hotels/components/hotel-list.tsx`
- Modify: `apps/web/src/app/page.tsx`; Create: `apps/web/src/app/hotels/page.tsx`

**Interfaces:**
- Consumes: Task 1 schemas, Task 4 endpoints, Task 5 components.
- Produces:
  - `searchHotels(q: HotelSearchQuery): Promise<Paginated<HotelSummary>>`, `fetchHotel(slug)`, `fetchAvailability(slug, range: StayRange)`
  - `hotelKeys.{all, lists(), list(q), details(), detail(slug), availability(slug, range)}`
  - `useHotelSearch(q)` (`placeholderData: keepPreviousData`), `useHotel(slug)`, `useAvailability(slug, range: StayRange | null)`, `usePrefetchHotel(): (slug: string) => void`
  - `parseSearchParams(sp: URLSearchParams): HotelSearchQuery` (uses `hotelSearchQuerySchema.safeParse`; on failure drops the offending keys and re-parses, never throws) and `toSearchParams(q: Partial<HotelSearchQuery>): URLSearchParams` (omits defaults/undefined)
  - `<DateRangeField value onChange />` reused by Task 7.

- [x] **Step 1:** Implement fetchers + hooks + `search-params.ts`.
- [x] **Step 2:** Build `SearchBar` (react-hook-form + zodResolver on `hotelSearchQuerySchema.pick` of city/dates/guests; calendar disables days before `todayIn(BOOKING_TZ)` and beyond `checkIn + 30`); submit → `router.push("/hotels?" + toSearchParams(...))`.
- [x] **Step 3:** Build `HotelCard` (cover image, name, city, rating/review count, "from ฿X / night" via `Intl.NumberFormat("th-TH", { style: "currency", currency })`; links to `/hotels/<slug>?<dates & guests>`, prefetch on hover/focus), `HotelResults` (skeleton grid, error with retry, empty state "No hotels match …" with a clear-filters link), `Pagination`.
- [x] **Step 4:** Pages: `/` = hero + `SearchBar` + `HotelResults` for `{}`; `/hotels` = prefilled `SearchBar` + `HotelResults` from URL. Client parts inside `<Suspense>`.
- [x] **Step 5:** `npm run lint && npm run typecheck`; then verify with `next-dev-loop` (`npm run dev`): search "bangkok" → 1 result; dates with all rooms free → price shown; page through with `pageSize` small; invalid URL `?checkIn=garbage` renders defaults.
- [x] **Step 6: Commit + push** — `feat(web): hotel search bar and results`.

### Task 7: Web hotel detail page

**Files:**
- Create: `apps/web/src/features/hotels/components/{hotel-detail,hotel-gallery,amenity-list,room-type-card,stay-picker}.tsx`
- Create: `apps/web/src/app/hotels/[slug]/page.tsx`

**Interfaces:**
- Consumes: Task 6 hooks, `DateRangeField`, `parseSearchParams`/`toSearchParams`.
- Produces: `amenityIcon(code: string): LucideIcon` in `amenity-list.tsx` (map `wifi, pool, parking, breakfast, aircon, bathtub`; fallback `Check`).

- [ ] **Step 1:** `HotelDetail` uses `useHotel(slug)`; 404 (`ApiError` status 404) → "Hotel not found" with link to `/hotels`; other errors → retry state; loading → skeleton.
- [ ] **Step 2:** `HotelGallery` (main image + thumbnails, keyboard-accessible buttons, `next/image`; add `https://picsum.photos/**` to `images.remotePatterns` in `apps/web/next.config.ts`).
- [ ] **Step 3:** `StayPicker` (date range + guests) writes to the URL with `router.replace`; `useAvailability(slug, range)` only when the URL has a valid range.
- [ ] **Step 4:** `RoomTypeCard`: without range → "from ฿base / night"; with range → total + nights + collapsible per-night breakdown, or "Sold out" badge; room types filtered out by guests show nothing; disabled "Book" button with "Booking opens soon" hint.
- [ ] **Step 5:** `npm run lint && npm run typecheck`; verify with `next-dev-loop`: Riverside Bangkok with `2027-04-08 → 2027-04-12` shows Deluxe King total `15400` (2×3200 + 2×4500); guests 3 hides Deluxe King; unknown slug shows not-found.
- [ ] **Step 6: Commit + push** — `feat(web): hotel detail with gallery, amenities and live prices`.

### Task 8: Phase close — audit, verification, docs

**Files:**
- Modify: UI files touched by fixes from the audit; `PLAN.md` (Phase 3 boxes ✅, status table, decision #4 notes 30 nights confirmed); `README.md` and `CLAUDE.md` (new routes/endpoints, `DESIGN.md`)

- [ ] **Step 1:** Run `impeccable` audit + polish on `/`, `/hotels`, `/hotels/[slug]` (responsive, a11y, empty/error states); apply fixes.
- [ ] **Step 2:** `npm run lint && npm run typecheck && npm test && npm run db:check && npm run build` — all green, output captured.
- [ ] **Step 3:** Update docs.
- [ ] **Step 4: Commit + push** — `docs: phase 3 catalog status, README and CLAUDE.md`; then request a whole-branch review (`superpowers:requesting-code-review`).
