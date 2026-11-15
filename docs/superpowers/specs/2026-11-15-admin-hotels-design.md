# Admin shell + Hotels (Phase 6.1) — Design

Date: 2026-11-15
Status: Approach picked in chat (sectioned resources, whole-set saves, ↑/↓ reorder); builder check done — awaiting user review
Roadmap: `PLAN.md` Phase 6 → 6.1 · Branch: `feat/admin-hotels` · First user of `requireHotelAccess()` (Phase 2)

## Intent

Staff run their own hotels day to day from `apps/web-admin`; admins run every hotel. Today web-admin can only list
hotels through the **public** search endpoint (so staff see every hotel and nobody sees deactivated ones) and create
one. 6.1 gives web-admin a real shell (sidebar) and a hotel management area: a scoped list, a detail page where the
hotel's details, check-in/check-out times, images and hotel amenities are edited, and admin-only deactivation.
It also settles `PLAN.md` decision #7 (hotel check-in/check-out times) and shows those times to customers.

## Goals

- `GET /api/admin/hotels`: STAFF see only hotels they are assigned to; ADMIN see all, including inactive ones.
- STAFF can edit **everything** on a hotel they're assigned to (details, times, images, amenities). Only ADMIN can
  deactivate / reactivate and create *(decided in chat)*.
- A STAFF user acting on a hotel they're not assigned to gets `403` from the API, whatever the UI shows.
- Images are an ordered list of URLs (+ optional alt) reordered with ↑/↓ buttons and saved as a whole.
- Hotel amenities can only be HOTEL-scope amenities — enforced in the service (the DB doesn't check scope).
- `Hotel` gains `checkInTime` / `checkOutTime` (default 14:00 / 12:00), editable in admin and shown on the web
  hotel page and booking detail.
- Deactivating hides the hotel from public search/detail (already the case for `isActive = false`) and blocks new
  bookings; existing bookings are untouched.

## Non-goals

- Room types, rooms, rate periods, bookings, staff assignment, amenity catalog CRUD, dashboard (6.2–6.6).
- Uploading image files (Phase 8 — object storage needs a new service). URLs only.
- Drag-and-drop reordering (would need a new dependency).
- Enforcing check-in/out times in booking logic — stays date-based. Times are informational.
- Optimistic concurrency between two editors: last save wins *(accepted in chat)*.
- Changing a hotel's `slug` or `currency`.
- Cancelling or notifying existing bookings when a hotel is deactivated.

## Anti-goals (failure even if it "works")

- A STAFF user reading or changing a hotel they're not assigned to through any endpoint.
- A STAFF user deactivating/reactivating or creating a hotel.
- A ROOM-scope amenity attached to a hotel.
- Renaming a hotel breaking customers' existing links (slug changes).
- A half-applied images/amenities save (some rows replaced, others not).

## Approaches

1. **Sectioned resources, each saved as a whole set — picked.** `PATCH` for details, `PUT` replaces the full
   ordered image list, `PUT` replaces the amenity set, `PATCH …/status` for admin. Few endpoints, simple tests,
   reorder = resend the list, and 6.2 room types reuse the same shape. Trade-off: concurrent editors overwrite each
   other (accepted).
2. CRUD per image + a reorder endpoint. No overwrite problem, but about twice the endpoints/tests for URL rows with
   no real benefit. Rejected.
3. One big `PATCH` with nested images and amenities. Mixed field errors, every save resends everything. Rejected.

Reorder UI: ↑/↓ buttons, no new dependency *(decided in chat)*.

## Decisions

| Topic | Decision |
| --- | --- |
| Who edits what | ADMIN + assigned STAFF: details, times, images, amenities. ADMIN only: create, deactivate/reactivate *(chat)* |
| Guards | All under `adminRouter` (already `loadSession('ADMIN')` + `requireRole('ADMIN','STAFF')`). `/:hotelId/*` routes add `requireHotelAccess()`; status + create add `requireRole('ADMIN')` |
| Missing hotel | `requireHotelAccess` runs first: STAFF → `403` for an unknown id (doesn't reveal existence); ADMIN → service throws `404 NOT_FOUND` *(my call)* |
| Times | `checkInTime String @default("14:00") @db.VarChar(5)` and `checkOutTime … @default("12:00")`, 24-hour `HH:mm`. Shared zod `hotelTimeSchema = /^([01]\d|2[0-3]):[0-5]\d$/`. Additive migration; existing rows get the defaults. No DB CHECK on the format — Phase 8 adds CHECKs together *(my call)* |
| Slug | Never changes on edit *(chat)* |
| List | `GET /api/admin/hotels?q=&status=active\|inactive\|all&page=&pageSize=` → `paginated(adminHotelSummarySchema)`; `status` default `all`, `pageSize` default 20 (max 50), `q` = case-insensitive contains on name or city, order `name asc`. STAFF filter `staff: { some: { userId } }`. Summary: `id, name, slug, city, isActive, coverImage, updatedAt` *(my calls)* |
| Detail | `GET /api/admin/hotels/:hotelId` → `adminHotelSchema`: `id, name, slug, city, address, description, currency, checkInTime, checkOutTime, isActive, images[{ id, url, alt, sortOrder }] (by sortOrder), amenities[{ id, code, name }], createdAt, updatedAt`. Every write below returns this same shape so the page can set the query cache |
| Edit details | `PATCH /api/admin/hotels/:hotelId` body `updateHotelSchema` = `name, city, address, description, checkInTime, checkOutTime`, all optional, at least one required; same length limits as `createHotelSchema`. `description: ""` or `null` clears it *(my call)* |
| Images | `PUT /api/admin/hotels/:hotelId/images` body `{ images: [{ url, alt? }] }`, max 20, `url` = `z.url()` http/https, max 2048, `alt` max 200; duplicate URLs → `400`. Service: `$transaction` deleteMany + createMany with `sortOrder = index`. Empty list = no images *(my calls)* |
| Amenities | `PUT /api/admin/hotels/:hotelId/amenities` body `{ amenityIds: string[] }` (unique, max 50). Service loads them; any unknown id or `scope !== HOTEL` → `400 VALIDATION_FAILED` "Only hotel amenities can be added", with the message in `fieldErrors.amenityIds` so `applyServerFieldErrors` can show it. Then `$transaction` deleteMany + createMany |
| Amenity options | `GET /api/admin/amenities?scope=HOTEL\|ROOM` (ADMIN + STAFF, read-only, order `name`) → `[{ id, code, name, scope }]`. 6.5 adds CRUD on the same router *(my call — the checkbox list needs it)* |
| Status | `PATCH /api/admin/hotels/:hotelId/status` body `{ isActive: boolean }`, ADMIN only → `adminHotelSchema` |
| Create | Existing `POST /api/admin/hotels` (ADMIN). `createHotelSchema` gains optional `checkInTime`/`checkOutTime` (DB defaults apply). Response becomes `adminHotelSchema` so web-admin can go straight to the new hotel's page |
| Deactivated hotel | Public search/detail/availability/quote and booking create already filter `isActive` — no change. Existing bookings, payments, cancel and pay of an already-held booking unchanged *(my call)* |
| Public shape | `hotelDetailSchema` and `bookingSchema.hotel` gain `checkInTime`, `checkOutTime` (additive) |
| Errors | Zod failures → existing `400 VALIDATION_FAILED` with `fieldErrors` (shown under fields via `applyServerFieldErrors`) |
| Inactive + STAFF | STAFF can still open and edit an inactive hotel they're assigned to; only the status endpoint is ADMIN-only *(my call)* |
| Booking times | Booking detail reads the times live from the hotel (no snapshot): if a hotel changes them, existing bookings show the new ones. Fine because times are informational *(my call)* |
| Confirm dialog | Deactivate/Reactivate uses the existing `alert-dialog` |

## web-admin

Routes (all inside `app/(protected)/`):

| Route | Content |
| --- | --- |
| `/` | redirects to `/hotels` until 6.6 adds the dashboard |
| `/hotels` | table: name, city, status badge, updated. Search box + status select (URL params `q`, `status`, `page`), pagination. "New hotel" button (ADMIN only) |
| `/hotels/new` | ADMIN only (non-admin → "You don't have access" state; API is the real guard). The existing create form + times; on success navigate to `/hotels/[hotelId]` |
| `/hotels/[hotelId]` | header (name, city, status badge, Deactivate/Reactivate for ADMIN behind a confirm dialog) and three sections, each its own form + Save: **Details** (name, city, address, description, check-in, check-out), **Images** (rows of URL + alt with ↑ ↓ ✕, "Add image", Save), **Amenities** (checkboxes of HOTEL amenities, Save) |

```
┌ Sidebar ─┐ Hotels / Sunrise Bangkok             [Active]  [Deactivate]
│ Hotels   │ ┌ Details ────────────────────────────────────────┐
│          │ │ Name  City  Address  Description                 │
│          │ │ Check-in 14:00   Check-out 12:00          [Save] │
│          │ ├ Images ─────────────────────────────────────────┤
│          │ │ 1 https://…/lobby.jpg  alt        [↑][↓][✕]      │
│          │ │ [+ Add image]                             [Save] │
│ ──────── │ ├ Amenities ──────────────────────────────────────┤
│ API ●    │ │ ☑ Wi-Fi ☑ Pool ☐ Parking ☐ Breakfast      [Save] │
└──────────┘ └─────────────────────────────────────────────────┘
```

- Shell: sidebar on `md+` (nav items: Hotels; later phases append), collapses to a top bar with a menu on mobile.
  `AdminHeader`'s user name / role / Log out and `ApiStatus` move into it. Active item from `usePathname()`.
- Features: `features/hotels/` (`api.ts`, `hooks.ts` with `adminHotelKeys.list(params)` / `.detail(id)`,
  components), `features/amenities/` (`amenityKeys.list(scope)`). Writes `setQueryData` on the detail and
  invalidate `adminHotelKeys.lists()`. Status also invalidates lists.
- Each section: react-hook-form + zod resolver with the shared schemas, Save disabled until dirty, inline "Saved"
  text after success (no toast library), server errors under fields or as a form alert. Images use
  `useFieldArray` with `move()` for ↑/↓. Leaving with unsaved changes isn't guarded *(my call)*.
- Loading (skeletons), error (retry), empty ("No hotels yet" / "No hotels assigned to you" for staff, "No images",
  "No hotel amenities in the catalog") states per `DESIGN.md`.
- New shadcn components into `packages/ui` via `npm run ui:add`: `table`, `checkbox`, `textarea`, `select` — all on the existing `radix-ui` dependency, so no new packages. If `ui:add` wants a new
  dependency, stop and ask.

## web (customer)

- Hotel detail page: "Check-in from 14:00 · Check-out until 12:00" near the address.
- Booking detail (`/account/bookings/[code]`): the same times beside the stay dates.

## Tests (API, `node:test` + supertest, TDD)

- List: STAFF sees only assigned hotels (incl. inactive assigned ones); ADMIN sees all; `q` / `status` / paging.
- Detail + every write: STAFF unassigned → `403`; CUSTOMER / web session → `401`/`403` (existing guard); ADMIN
  unknown id → `404`.
- Status and create: STAFF → `403`; ADMIN deactivate → public `GET /api/hotels/:slug` → `404`, search excludes it;
  reactivate restores it.
- PATCH: updates fields, slug unchanged after rename, bad time → `400` with `fieldErrors`, empty body → `400`.
- Images: replace + order preserved, empty list clears, duplicate URL → `400`, > 20 → `400`, bad URL → `400`.
- Amenities: replace set, ROOM-scope id → `400` and nothing changed, unknown id → `400`.
- Amenity options: `scope` filter.
- Public `hotelDetailSchema` / booking include the times.
- Test data uses a unique name prefix, created STAFF users + hotels cleaned up in `after()`; seeded rows untouched.

## Docs to update at the end

`PLAN.md` (6.1 ✅, decision #7 settled, amenity-scope gap → handled for hotels), `README.md` (admin endpoints,
web-admin routes), `CLAUDE.md` (web-admin structure: sidebar shell, `features/amenities/`, admin hotel routes).

## Left to the builder

File/component split inside `features/hotels/components/`, exact copy and table columns, how the sidebar
collapses on mobile (follow `DESIGN.md`), service function names.
