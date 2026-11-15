# Admin Dashboard (6.6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** web-admin home shows today's arrivals/departures/in-house and occupancy + revenue for a date range, scoped to the hotels the user can access.

**Architecture:** One read endpoint `GET /api/admin/dashboard` computes everything in `admin-dashboard.service.ts` (a few Prisma reads, then per-night aggregation in TS). web-admin renders it on `/` with stat tiles and two shadcn bar charts.

**Tech Stack:** Express 5 + Prisma 7, zod v4 (`@booking/shared`), Next.js 16 + TanStack Query, shadcn `chart` (recharts).

**Spec:** `docs/superpowers/specs/2026-11-15-admin-dashboard-design.md`

## Global Constraints

- Counted bookings: `status IN (CONFIRMED, COMPLETED)` only.
- Range: `from`/`to` inclusive night dates; default `to = todayIn(BOOKING_TZ)`, `from = to − 29`; one given → other is 29 nights away; `to < from` → 400; > `DASHBOARD_MAX_NIGHTS = 92` nights → 400.
- Sellable rooms = `Room.isActive && RoomType.isActive && Hotel.isActive` in scope; 0 → `rate: null`.
- Revenue per stayed night; split in minor units, leftover satang on the earliest nights (one each).
- `hotelId` not accessible → `403 FORBIDDEN`; STAFF without `hotelId` = assigned hotels only.
- Lists max 20 items, ordered by guest name; `total` = full count.
- UI copy Thai; theme tokens `chart-1` (occupancy), `chart-2` (revenue); no inline styles.

## Review Focus

- Booking that starts before `from` and ends after `to` — only in-range nights count for occupancy and revenue (Task 2 test "range clipping").
- STAFF with zero assigned hotels — zeros + `rate: null`, not 403/500 (Task 2 test).
- Hand-edited URL with `from` after `to` or a 200-night range — UI falls back to defaults instead of an error loop (Task 3 `parseDashboardParams` drops invalid keys, including the cross-field `to` issue).
- Booking whose room was later deactivated still counts as sold; the raw rate is reported even if it exceeds 1 (Task 2 asserts a booking on the inactive room counts in `roomNightsSold`).
- Admin with no `hotelId` includes seeded hotels — tests must pass `hotelId` (or use STAFF scope) for exact numbers.

---

### Task 1: Shared schemas + night split

**Files:**
- Modify: `packages/shared/src/index.ts` (new "Admin dashboard" section after admin bookings)
- Create: `apps/api/src/lib/night-split.ts`, `apps/api/src/lib/night-split.test.ts`
- Modify: `apps/api/src/lib/shared-schemas.test.ts`

**Interfaces — Produces:**
- `DASHBOARD_MAX_NIGHTS = 92`, `DASHBOARD_DEFAULT_NIGHTS = 30`
- `adminDashboardQuerySchema` → `{ hotelId?: string; from?: string; to?: string }` (blank → undefined; `to < from` issue on path `to`; span > 92 issue on path `to`)
- `adminDashboardStaySchema` `{ code, guestName, guests, nights, hotel:{id,name}, roomType:{id,name}, room:{id,number}, done: boolean }`
- `adminDashboardSchema` exactly as the spec "Shape" row; `occupancy.rate` and `daily[].rate` are `number | null` in 0..1
- Types `AdminDashboardQuery`, `AdminDashboard`, `AdminDashboardStay`
- `splitAcrossNights(totalMinor: number, nights: number): number[]` in `night-split.ts`

- [ ] Step 1: tests — `splitAcrossNights(100000, 3)` → `[33334, 33333, 33333]`; `(300000, 3)` → three 100000; `(1, 2)` → `[1, 0]`; sum always equals input. Schema tests: `{from:"2026-11-10", to:"2026-11-01"}` fails on `to`; 93-night span fails; 92 passes; `{hotelId:""}` → `{}`.
- [ ] Step 2: run `npm test` → new tests fail.
- [ ] Step 3: implement both.
- [ ] Step 4: `npm test` → pass. Commit `feat(shared): admin dashboard schemas`.

### Task 2: API endpoint

**Files:**
- Create: `apps/api/src/services/admin-dashboard.service.ts`, `apps/api/src/controllers/admin-dashboard.controller.ts`, `apps/api/src/routes/admin/dashboard.ts`, `apps/api/src/routes/admin/dashboard.test.ts`
- Modify: `apps/api/src/routes/admin/index.ts` (`adminRouter.use("/dashboard", adminDashboardRouter)`)

**Interfaces:**
- Consumes: Task 1 schemas, `splitAcrossNights`, `canAccessHotel`, `todayIn`, `eachNight`, `toDbDate/fromDbDate`, `toMinorUnits`.
- Produces: `getAdminDashboard(user: PublicUser, query: AdminDashboardQuery, now = new Date()): Promise<AdminDashboard>`

Service outline: resolve range → hotel scope `Prisma.HotelWhereInput` (`{id: hotelId}` | ADMIN `{}` | STAFF `{staff:{some:{userId}}}`) → in parallel: `hotel.count`, sellable `room.count`, range bookings (overlap `checkIn <= to`, `checkOut > from`, select checkIn/checkOut/totalAmount/currency), arrivals (`checkIn = today`), departures (`checkOut = today`), `inHouse` count. Aggregate per night in a `Map<date, …>`; revenue grouped by currency, sorted by total desc; amounts back to major units (`minor / 100`). `currency` order irrelevant when single.

- [ ] Step 1: tests in `dashboard.test.ts` using `catalog-fixtures` (label `admin-dashboard`, one fixture `mine` with Standard 2 active + 1 inactive room, assigned STAFF; second fixture `other`): web cookie → 401; STAFF `?hotelId=<other>` → 403; `to<from` → 400; 93 nights → 400; defaults → `nights 30`, `to == today`; STAFF no hotelId → `hotelCount 1`, `roomCount 2`; occupancy with CONFIRMED [d-2,d+1), COMPLETED [d-1,d), PENDING + CANCELLED ignored, `from=d-2,to=d-1` → sold 3, available 4, rate 0.75; range clipping (booking [d-5,d+5), range d..d) → 1 night counted, revenue = that night's share; revenue split 1000.00 over 3 nights → daily 333.34 / 333.33 / 333.33; today: arrival checked in + arrival pending → `arrivals {total 2, done 1}`; departure COMPLETED today → `departures.done 1`; `inHouse` counts CONFIRMED+checkedInAt; STAFF with zero hotels → `roomCount 0`, `occupancy.rate null`, `revenue []`. Clean bookings in `afterEach`-style helper (`clearBookings`).
- [ ] Step 2: `npm test` → fail (404).
- [ ] Step 3: implement service/controller/route.
- [ ] Step 4: `npm test`, lint, typecheck → pass. Commit `feat(api): admin dashboard endpoint`.

### Task 3: web-admin dashboard

**Files:**
- Run: `npm run ui:add -- chart` (adds `packages/ui/src/components/chart.tsx` + `recharts`)
- Create: `apps/web-admin/src/features/dashboard/{api.ts,hooks.ts,dashboard-params.ts}`, `components/{dashboard.tsx,dashboard-filters.tsx,stat-tiles.tsx,today-card.tsx,occupancy-chart.tsx,revenue-chart.tsx}`
- Modify: `apps/web-admin/src/app/(protected)/page.tsx`, `components/nav-items.ts` (+ `exact?: boolean`, "ภาพรวม" `/` with `LayoutDashboard`), `components/admin-shell.tsx` (honour `exact`), `features/bookings/hooks.ts` (mutations invalidate `adminDashboardKeys.all`)

**Interfaces:**
- `fetchAdminDashboard(q: AdminDashboardQuery): Promise<AdminDashboard>` via `request(adminDashboardSchema, …)`
- `adminDashboardKeys = { all: ["admin-dashboard"], detail: (q) => [...all, q] }`, `useAdminDashboard(q)` with `placeholderData: keepPreviousData`
- `parseDashboardParams(sp: URLSearchParams): AdminDashboardQuery`, `serializeDashboardParams(q): string` (bookings list-params pattern)

- [ ] Step 1: add chart component; implement fetcher, hooks, params, components per spec "web-admin" section; Thai date ticks via the bookings date formatter in web-admin `lib` (reuse, don't re-implement); `฿` formatting with `Intl.NumberFormat("th-TH")`.
- [ ] Step 2: `npm run lint && npm run typecheck` → pass.
- [ ] Step 3: browser check (next-dev-loop): ADMIN all hotels / one hotel, STAFF scoped, change range, invalid URL falls back, empty state, check-in from booking page updates dashboard. Commit `feat(web-admin): dashboard`.

### Task 4: Docs

- [ ] Update `CLAUDE.md` structure (admin-dashboard.service, features/dashboard, `/` dashboard) and `PLAN.md` 6.6 → ✅ with browser-verified line. Commit + push.
