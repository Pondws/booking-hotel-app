# Dashboard (Phase 6.6) — Design

Date: 2026-11-15
Status: Approved (user picked shadcn `chart` + recharts for the charts; the rest are the builder's calls, stated below)
Roadmap: `PLAN.md` Phase 6 → 6.6 · Branch: `feat/admin-dashboard`

## Intent

The web-admin home (`/`, today a redirect to `/hotels`) becomes the page staff open every morning: who arrives and
who leaves today, how full the hotel was / will be, and how much it earned over a date range. STAFF see only their
hotels (same `HotelStaff` scope as 6.4), ADMIN sees all.

## Goals

- Today: arrivals (checked in / still to come), departures (checked out / still in house), in-house count, each with
  a short list linking to `/bookings/[code]`.
- Range (default the 30 nights ending today, max 92): occupancy rate and revenue as stat tiles + a daily bar chart each.
- Hotel filter: one hotel or "all my hotels"; range + hotel live in the URL.
- No schema change.

## Non-goals

- ADR / RevPAR, comparisons with a previous period, forecasts, CSV export.
- Revenue by payment date (cash view) — see Approaches.
- Currency conversion (every hotel is THB today; see Currency).

## Approaches

| Option | Trade-off | Picked |
| --- | --- | --- |
| shadcn `chart` (adds `recharts` to `packages/ui`) | real tooltips/axes, matches the theme tokens `chart-1…5`; one new dependency | ✅ user's choice |
| Hand-drawn SVG/Tailwind bars | no dependency, but no tooltips and more custom code | – |

Revenue basis (builder's call): **per stayed night** — a booking's `totalAmount` is split evenly over its nights
(minor units; leftover satang go to the earliest nights, one each, so the parts sum exactly) and each night's share counts on that
date. This lines up with occupancy (same nights, same bookings). Payment-date revenue would put a stay's money on the
day it was booked, which doesn't match the occupancy chart.

## Decisions

| Topic | Decision |
| --- | --- |
| Endpoint | `GET /api/admin/dashboard?hotelId=&from=&to=` → `AdminDashboard`. Router `routes/admin/dashboard.ts`, controller `admin-dashboard.controller.ts`, service `admin-dashboard.service.ts` |
| Access | adminRouter guard (ADMIN + STAFF). `hotelId` the user can't access → `403` (same as bookings list). Without `hotelId`: ADMIN = all hotels, STAFF = assigned hotels (none → zeros, not an error) |
| Query | `from`, `to` optional `YYYY-MM-DD`, inclusive night dates. Both omitted → `to = today (BOOKING_TZ)`, `from = to − 29`. Only one given → the other is 29 nights away. `to < from` → `400`; more than `DASHBOARD_MAX_NIGHTS = 92` nights → `400` |
| Counted bookings | `CONFIRMED` or `COMPLETED` (paid). PENDING / CANCELLED / EXPIRED never count — cancelling refunds in full |
| Occupancy | per night: rooms sold ÷ sellable rooms. Sellable rooms = `Room.isActive && RoomType.isActive && Hotel.isActive` in scope, counted now (no history of deactivations). Range rate = Σ sold ÷ (sellable × nights). Sellable = 0 → `rate: null` (UI shows "–") |
| Revenue | per stayed night as above, only nights inside the range. Decimal → minor units → number in major units in the response |
| Currency | `currency` = the scope's hotel currency when they all agree (THB today). Mixed currencies in scope → revenue is grouped: `revenue: { currency, total, daily }[]` sorted by total desc; the UI charts the first and lists the rest as text |
| Today | `today` = `todayIn(BOOKING_TZ)`. Arrivals = counted bookings with `checkIn = today` (`checkedIn` flag). Departures = counted bookings with `checkOut = today` (`checkedOut` = COMPLETED). In house = `CONFIRMED` + `checkedInAt` set. Lists are ordered by guest name, max 20 items each (`total` gives the full count) |
| Shape | `AdminDashboard { today, from, to, nights, hotelCount, roomCount, arrivals: { total, done, items }, departures: { total, done, items }, inHouse, occupancy: { roomNightsSold, roomNightsAvailable, rate, daily: { date, sold, rate }[] }, revenue: { currency, total, daily: { date, amount }[] }[] }`. List item: `{ code, guestName, guests, nights, hotel: { id, name }, roomType: { id, name }, room: { id, number }, done }` |
| Shared | `adminDashboardQuerySchema`, `adminDashboardSchema`, `DASHBOARD_MAX_NIGHTS` in `packages/shared` |

## web-admin

- `npm run ui:add -- chart` → `packages/ui/src/components/chart.tsx` (+ `recharts` dependency in `packages/ui`).
- `app/(protected)/page.tsx` renders the dashboard (no more redirect); `NAV_ITEMS` gets "ภาพรวม" (`/`) first, with
  exact-match active state so it isn't highlighted on every page.
- `features/dashboard/`: `api.ts`, `hooks.ts` (`adminDashboardKeys.detail(query)`, `placeholderData` keeps the old
  numbers while the range changes), `dashboard-params.ts` (URL ↔ query, same drop-invalid pattern as bookings),
  `components/`:
  - filter bar: hotel `Select` (from `useAdminHotels`, as in the bookings list) + from/to via the bookings
    `DateFilterField` pattern + "30 วันล่าสุด" reset.
  - stat tiles: เข้าพักวันนี้ (n / done), ออกวันนี้, กำลังเข้าพัก, อัตราการเข้าพัก (range), รายได้ (range).
  - today card: two short lists (arrivals / departures) with status badge, link to the booking; empty → "ไม่มี…วันนี้".
  - charts: occupancy % per night (bar, `chart-1`) and revenue per night (bar, `chart-2`), Thai dates on the axis,
    tooltip shows the value formatted (`%` / `฿`).
  - loading = skeleton tiles + chart placeholders; error = retry card; no rooms in scope = empty state.
- Booking mutations (check-in/out, cancel, move) also invalidate `adminDashboardKeys.all`.

## Tests (API, `routes/admin/dashboard.test.ts`)

Fixture: own hotel + room type + 2 rooms + bookings with a unique prefix, cleaned in `after()`.
- web session → 401; STAFF without access to `hotelId` → 403; STAFF sees only assigned hotels (no `hotelId`).
- `to < from` → 400; 93 nights → 400; defaults → 30 nights ending today.
- occupancy: CONFIRMED + COMPLETED count, PENDING / CANCELLED don't; night outside range ignored; rate math.
- revenue: 3-night booking of 1000.00 splits 333.34 / 333.33 / 333.33 and only in-range nights count.
- today: arrival / departure / in-house counts and `done` flags.
Unit test for the night-split helper (sums exactly, leftover on the earliest nights).

## Left to the builder

Tile/chart layout details within DESIGN.md, Thai copy wording, chart axis tick density.
