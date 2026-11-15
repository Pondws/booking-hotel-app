# Admin shell + Hotels (Phase 6.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** web-admin gets a sidebar shell and hotel management (scoped list, detail with Details / Images / Amenities
sections, admin-only create + deactivate), and hotels gain check-in/check-out times shown to customers.

**Architecture:** New admin hotel endpoints under `adminRouter` (`/api/admin/hotels/:hotelId/*` guarded by
`requireHotelAccess()`, status/create by `requireRole('ADMIN')`) in a new `admin-hotel.service.ts`; each section is
saved as a whole set (`PATCH` details, `PUT` images, `PUT` amenities). web-admin pages use TanStack Query hooks with
`setQueryData` on the detail after each write.

**Tech Stack:** Express 5, Prisma 7, zod v4, Next.js 16 App Router, TanStack Query v5, react-hook-form, shadcn
(`radix-ui`), `node:test` + supertest.

**Spec:** `docs/superpowers/specs/2026-11-15-admin-hotels-design.md`

## Global Constraints

- No new npm dependencies. If `npm run ui:add` tries to add one, stop and ask.
- Every admin route stays under `/api/admin/*` (CORS + guards). Controllers never import prisma.
- Times: 24-hour `HH:mm`, regex `/^([01]\d|2[0-3]):[0-5]\d$/`, defaults `"14:00"` / `"12:00"`.
- Slug and currency never change on edit.
- Zod/validation errors use code `VALIDATION_FAILED` (existing error handler).
- Images: max 20, `url` http/https max 2048, `alt` max 200, no duplicate URLs. Amenities: unique ids, max 50, HOTEL scope only.
- List: `status` default `all`, `pageSize` default 20 max 50, order `name asc`.
- After every commit: `git push` (branch `feat/admin-hotels`, upstream already set).
- Tests: rows under a fixture label, cleaned in `after()`; never modify seeded rows.
- `npm run lint && npm run typecheck` must pass at the end of every task.

## Review Focus

1. Staff assigned to hotel A sending `PUT /api/admin/hotels/<B>/images` → must be `403`, B untouched (Task 3 test).
2. Amenity save containing one valid HOTEL id and one ROOM id → `400`, the previous amenity set must remain (Task 3 test).
3. Rename a hotel → slug unchanged and the public `/api/hotels/<old-slug>` still `200` (Task 3 test).
4. `PATCH` with `description: ""` → stored as `null`, not `""` (Task 3 test).
5. Admin creates a hotel then lands on `/hotels/<id>` — create response must be the admin shape with `id` (Task 3 test asserts `adminHotelSchema.parse`).

---

### Task 1: Hotel times — migration, shared schemas, public shapes

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (`Hotel`), new migration `hotel_check_times`
- Modify: `packages/shared/src/index.ts` (Hotel + Catalog + Booking sections)
- Modify: `apps/api/src/services/hotel.service.ts` (`getHotelBySlug` select), `apps/api/src/services/booking.service.ts` (hotel select + mapping)
- Test: `apps/api/src/lib/shared-schemas.test.ts`, `apps/api/src/routes/hotels.test.ts`, `apps/api/src/routes/bookings.test.ts`

**Interfaces — Produces (all from `@booking/shared`):**
- `hotelTimeSchema: z.ZodString` (regex above, message `"Use HH:mm (24-hour)"`)
- `adminHotelSummarySchema` = `{ id, name, slug, city, isActive: boolean, coverImage: imageSchema.nullable(), updatedAt: z.iso.datetime() }`; `AdminHotelSummary`
- `adminHotelListSchema = paginated(adminHotelSummarySchema)`
- `adminHotelListQuerySchema` = `{ q?: string (trim, max 120, "" → undefined), status: "active"|"inactive"|"all" default "all", page: coerce int ≥1 default 1, pageSize: coerce int 1–50 default 20 }`; `AdminHotelListQuery` (output)
- `adminHotelImageSchema = { id, url, alt: string|null, sortOrder: int }`
- `adminHotelSchema` = `{ id, name, slug, city, address, description: string|null, currency, checkInTime, checkOutTime, isActive, images: adminHotelImageSchema[], amenities: { id, code, name }[], createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() }`; `AdminHotel`
- `createHotelSchema` gains `checkInTime: hotelTimeSchema.optional()`, `checkOutTime: hotelTimeSchema.optional()`
- `updateHotelSchema` = same fields as create (name/city/address limits copied) + times, all optional; `description: z.string().trim().max(2000).nullable().optional()` transformed `"" → null`; `.refine(at least one key)` message `"Nothing to update"`; `UpdateHotelInput` / `UpdateHotelData`
- `hotelImagesInputSchema = { images: z.array({ url: z.url({ protocol: /^https?$/ }).max(2048), alt: z.string().trim().max(200).optional() }).max(20) }` + refine no duplicate `url` (message `"Each image URL must be unique"`, path `["images"]`); `HotelImagesInput`
- `hotelAmenitiesInputSchema = { amenityIds: z.array(z.string().min(1)).max(50) }` + refine unique (path `["amenityIds"]`); `HotelAmenitiesInput`
- `hotelStatusInputSchema = { isActive: z.boolean() }`
- `amenityOptionSchema = { id, code, name, scope: "HOTEL"|"ROOM" }`, `amenityOptionListSchema = z.array(...)`, `amenityListQuerySchema = { scope?: "HOTEL"|"ROOM" }`
- `hotelIdParamsSchema = { hotelId: z.string().min(1) }`
- `hotelDetailSchema` and `bookingSchema.hotel` gain `checkInTime: z.string(), checkOutTime: z.string()`

- [ ] **Step 1: Write failing tests**
  - `shared-schemas.test.ts`: `hotelTimeSchema` accepts `"00:00"`, `"14:00"`, `"23:59"`; rejects `"24:00"`, `"9:00"`, `"14:60"`, `"2pm"`. `updateHotelSchema.parse({})` throws; `.parse({ description: "" })` → `{ description: null }`. `hotelImagesInputSchema` rejects 21 images, a `ftp://` url, duplicate urls. `hotelAmenitiesInputSchema` rejects duplicate ids.
  - `hotels.test.ts` (detail test): `res.body.data.checkInTime === "14:00"` and `checkOutTime === "12:00"` for a fixture hotel.
  - `bookings.test.ts` (an existing booking GET): `res.body.data.hotel.checkInTime === "14:00"`.
- [ ] **Step 2: Run** `npm test -w apps/api` → new assertions FAIL (schema exports missing / fields undefined).
- [ ] **Step 3: Schema + migration.** Add to `Hotel`: `checkInTime String @default("14:00") @map("check_in_time") @db.VarChar(5)` and `checkOutTime String @default("12:00") @map("check_out_time") @db.VarChar(5)`. Run `npm run db:migrate -- --name hotel_check_times` (additive; inspect SQL is only `ADD COLUMN … DEFAULT`).
- [ ] **Step 4: Shared schemas** as in Interfaces. **Services:** add both fields to the `getHotelBySlug` select and to the booking hotel select + mapping in `booking.service.ts`.
- [ ] **Step 5: Run** `npm test -w apps/api` → PASS; `npm run db:check` → passes; `npm run lint && npm run typecheck` → clean.
- [ ] **Step 6: Commit + push** `feat: hotel check-in/check-out times + admin hotel schemas`

### Task 2: Admin hotel list, detail and amenity options (read endpoints)

**Files:**
- Create: `apps/api/src/services/admin-hotel.service.ts`, `apps/api/src/controllers/admin-hotel.controller.ts`, `apps/api/src/routes/admin/amenities.ts`, `apps/api/src/services/amenity.service.ts`, `apps/api/src/routes/admin/hotels.test.ts`
- Modify: `apps/api/src/routes/admin/hotels.ts`, `apps/api/src/routes/admin/index.ts`, `apps/api/src/test/catalog-fixtures.ts`

**Interfaces:**
- Consumes: Task 1 schemas.
- Produces:
  - `listAdminHotels(user: PublicUser, query: AdminHotelListQuery): Promise<Paginated<AdminHotelSummary>>` — STAFF adds `staff: { some: { userId: user.id } }`; `q` → `OR: [{ name: { contains, mode: "insensitive" } }, { city: … }]`; `status` → `isActive` filter; `coverImage` = first image by `imageOrder`.
  - `getAdminHotel(hotelId: string): Promise<AdminHotel>` — `404 NOT_FOUND "Hotel not found"`; images ordered `sortOrder, id`; amenities ordered by name. A private `toAdminHotel(row)` mapper is reused by Task 3.
  - `listAmenities(scope?: "HOTEL" | "ROOM"): Promise<AmenityOption[]>` ordered by `name`.
  - Fixture helpers: `createFixtureUser(label, role: "CUSTOMER" | "STAFF" | "ADMIN" = "CUSTOMER")`, `assignStaff(userId: string, hotelId: string): Promise<void>`.
  - Routes: `GET /api/admin/hotels` (validate query), `GET /api/admin/hotels/:hotelId` (validate params, `requireHotelAccess()`), `GET /api/admin/amenities` (validate query) mounted as `adminRouter.use("/amenities", adminAmenitiesRouter)`.

- [ ] **Step 1: Write failing tests** in `routes/admin/hotels.test.ts` (label `admin-hotels`; fixtures: hotels H1 active + H2 inactive with a city unique to this file, H3 active; staff user assigned to H1 and H2; admin user; sessions via `signIn(id, "ADMIN")`, cookie `admin_sid=<token>`):
  - `list as staff` → items ids ⊆ {H1, H2}, both present, `adminHotelListSchema.parse` ok.
  - `list as admin with q=<city>` → H1, H2 (H3 has another city) incl. inactive; `status=active` → only H1; `status=inactive` → only H2; `pageSize=1` → 1 item, `total` 2.
  - `detail as staff, assigned` → 200, `checkInTime "14:00"`, `isActive` matches; `adminHotelSchema.parse` ok.
  - `detail as staff, unassigned (H3)` → 403 `"No access to this hotel"`; `detail as staff, unknown id` → 403.
  - `detail as admin, unknown id` → 404.
  - `detail with a WEB session cookie` (`sid`) → 401.
  - `GET /api/admin/amenities?scope=HOTEL` → every item `scope === "HOTEL"`, contains code `wifi`, not `aircon`; no scope → contains both.
- [ ] **Step 2: Run** `npm test -w apps/api` → FAIL (404 routes).
- [ ] **Step 3: Implement** fixture helpers, services, controllers (`res.locals.query` / `res.locals.params`, `req.auth!.user` is guaranteed by the router guard — narrow with an `AppError(401)` if absent, no `!`), routes.
- [ ] **Step 4: Run** `npm test -w apps/api` → PASS; lint + typecheck clean.
- [ ] **Step 5: Commit + push** `feat(api): admin hotel list, detail and amenity options`

### Task 3: Admin hotel writes — details, images, amenities, status, create shape

**Files:**
- Modify: `apps/api/src/services/admin-hotel.service.ts`, `apps/api/src/controllers/admin-hotel.controller.ts`, `apps/api/src/routes/admin/hotels.ts`, `apps/api/src/services/hotel.service.ts` (`createHotel` return), `apps/api/src/app.test.ts` (create response assertion)
- Test: `apps/api/src/routes/admin/hotels.test.ts`

**Interfaces:**
- Produces (all return `Promise<AdminHotel>`, `404` when the hotel doesn't exist):
  - `updateAdminHotel(hotelId: string, data: UpdateHotelData)` — never touches `slug`/`currency`.
  - `replaceHotelImages(hotelId: string, input: HotelImagesInput)` — `$transaction`: deleteMany + createMany (`sortOrder = index`, `alt ?? null`).
  - `replaceHotelAmenities(hotelId: string, input: HotelAmenitiesInput)` — load `amenity.findMany({ where: { id: { in } } })`; if count differs or any `scope !== "HOTEL"` → `new AppError(400, "VALIDATION_FAILED", "Only hotel amenities can be added", { fieldErrors: { amenityIds: ["Only hotel amenities can be added"] } })` (`details` is the 4th `AppError` arg; shape matches zod `flattenError`: `{ formErrors: [], fieldErrors }`); then `$transaction` deleteMany + createMany.
  - `setHotelStatus(hotelId: string, isActive: boolean)`.
  - `hotelService.createHotel` now returns `AdminHotel` (re-read via `getAdminHotel` after create).
  - Routes: `PATCH /:hotelId`, `PUT /:hotelId/images`, `PUT /:hotelId/amenities` (each `requireHotelAccess()` + validate params/body); `PATCH /:hotelId/status` (`requireRole("ADMIN")` + `requireHotelAccess()` + validate). Guard order: role/access before validate.

- [ ] **Step 1: Write failing tests** (same file, a `describe("writes")` with its own fixture hotel W assigned to the staff user, and H3 unassigned):
  - `PATCH as staff` `{ name: "<prefix> Renamed", checkInTime: "15:00" }` → 200, name + time updated, `slug` unchanged; public `GET /api/hotels/<slug>` → 200.
  - `PATCH { description: "" }` → `description === null`. `PATCH {}` → 400. `PATCH { checkOutTime: "25:00" }` → 400 with `error.details.fieldErrors.checkOutTime`.
  - `PATCH H3 as staff` → 403.
  - `PUT images` with `[b, a]` → 200, `images.map(url)` = `[b, a]`, sortOrder `[0, 1]`; then `[a]` → only `a`; then `[]` → `[]`. Duplicate → 400. 21 items → 400. `PUT images on H3 as staff` → 403 and H3 image count unchanged.
  - `PUT amenities [wifi, pool]` → 200, codes `["pool","wifi"]` (sorted by name: "Swimming pool", "Wi-Fi" — assert by set). `[wifi, aircon]` → 400, `error.details.fieldErrors.amenityIds` present, and `GET` detail still has `{wifi, pool}`. Unknown id → 400.
  - `PATCH status as staff` → 403. As admin `{ isActive: false }` → 200 `isActive false`; public `GET /api/hotels/<slug>` → 404; `{ isActive: true }` → public 200 again.
  - `app.test.ts` create as ADMIN → 201 and `adminHotelSchema.parse(res.body.data)` succeeds with `checkInTime "14:00"`. Make sure the created hotel's name uses a cleanup-able prefix.
- [ ] **Step 2: Run** `npm test -w apps/api` → FAIL.
- [ ] **Step 3: Implement** services, controllers, routes as in Interfaces.
- [ ] **Step 4: Run** `npm test -w apps/api` → PASS; lint + typecheck clean.
- [ ] **Step 5: Commit + push** `feat(api): admin hotel edit, images, amenities and status`

### Task 4: web-admin shell + shadcn components

**Files:**
- Add via `npm run ui:add -- table checkbox textarea select` → `packages/ui/src/components/{table,checkbox,textarea,select}.tsx`
- Create: `apps/web-admin/src/components/admin-shell.tsx` (sidebar + mobile top bar), `apps/web-admin/src/components/nav-items.ts`
- Modify: `apps/web-admin/src/app/(protected)/layout.tsx`, `apps/web-admin/src/app/(protected)/page.tsx` (→ `redirect("/hotels")`, Server Component), `apps/web-admin/src/features/auth/components/admin-header.tsx` (becomes the user block inside the shell, or is folded into it)

**Interfaces:**
- Produces: `<AdminShell>{children}</AdminShell>` (client, `usePathname()` for active item); `NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[]` = `[{ href: "/hotels", label: "Hotels", icon: Building2 }]` — later phases append.

- [ ] **Step 1:** `npm run ui:add -- table checkbox textarea select`; confirm `git diff packages/ui/package.json` adds no dependency (else stop and ask).
- [ ] **Step 2:** Build the shell per `DESIGN.md`: `md+` fixed sidebar (brand, nav, footer with `ApiStatus`, user name, role badge, Log out — keep the existing logout logic/`markExplicitLogout`); below `md` a top bar with a menu button toggling the nav. Active link `aria-current="page"`.
- [ ] **Step 3:** Layout = `RequireAuth` → `AdminShell` → children. `/` redirects to `/hotels`.
- [ ] **Step 4: Verify:** lint + typecheck clean; `npm run dev` and in the browser (`next-dev-loop`): log in as `staff@booking.local` → redirected to `/hotels` (404 until Task 5 is fine), sidebar visible on desktop, menu works at 375px, Log out works.
- [ ] **Step 5: Commit + push** `feat(web-admin): sidebar shell`

### Task 5: web-admin hotel list + create page

**Files:**
- Modify: `apps/web-admin/src/features/hotels/api.ts`, `hooks.ts`, `components/hotel-list.tsx` (rewrite as table), `components/create-hotel-form.tsx` (+ times, navigate on success)
- Create: `apps/web-admin/src/features/hotels/list-params.ts`, `apps/web-admin/src/app/(protected)/hotels/page.tsx`, `apps/web-admin/src/app/(protected)/hotels/new/page.tsx`, `apps/web-admin/src/features/amenities/{api.ts,hooks.ts}`, `apps/web-admin/src/components/pagination.tsx` (if web's isn't reusable — apps can't import each other; copy the pattern)

**Interfaces:**
- Consumes: Task 1 schemas, Task 2/3 endpoints.
- Produces:
  - `fetchAdminHotels(query: AdminHotelListQuery)`, `fetchAdminHotel(id)`, `createHotel(input: CreateHotelInput): Promise<AdminHotel>`, `updateHotel(id, input: UpdateHotelInput)`, `replaceHotelImages(id, input)`, `replaceHotelAmenities(id, input)`, `setHotelStatus(id, isActive)` — all via `request(schema, …)`.
  - `adminHotelKeys = { all: ["admin-hotels"], lists: () => [...all, "list"], list: (q) => [...lists(), q], detail: (id) => [...all, "detail", id] }`.
  - Hooks: `useAdminHotels(query)` (`placeholderData: keepPreviousData`), `useAdminHotel(id)`, `useCreateHotel`, `useUpdateHotel(id)`, `useReplaceHotelImages(id)`, `useReplaceHotelAmenities(id)`, `useSetHotelStatus(id)` — writes `setQueryData(detail(id), data)` + `invalidateQueries({ queryKey: lists() })`.
  - `amenityKeys.list(scope)`, `useAmenities(scope)`, `fetchAmenities(scope)`.
  - `parseListParams(sp: URLSearchParams): AdminHotelListQuery` / `serializeListParams(q): string` (via `adminHotelListQuerySchema.safeParse`, defaults omitted from the URL).

- [ ] **Step 1:** api + hooks + list-params.
- [ ] **Step 2:** `/hotels`: header ("Hotels", "New hotel" button only when `me.role === "ADMIN"`), search input (debounced or on submit) + status `Select` writing to the URL, `Table` (Name → link `/hotels/[id]`, City, Status badge Active/Inactive, Updated), pagination. States: skeleton rows; error with Retry; empty → ADMIN "No hotels yet", STAFF "No hotels assigned to you", with filters "No hotels match these filters".
- [ ] **Step 3:** `/hotels/new`: non-ADMIN → "You don't have access to this page"; form adds Check-in / Check-out (`<Input type="time">`, default 14:00 / 12:00); on success `router.push("/hotels/" + data.id)`.
- [ ] **Step 4: Verify** lint + typecheck; browser: staff sees only Riverside Bangkok and no "New hotel"; admin sees all, filters + paging update the URL and survive reload; admin creates a hotel → lands on its page.
- [ ] **Step 5: Commit + push** `feat(web-admin): hotel list and create page`

### Task 6: web-admin hotel detail page

**Files:**
- Create: `apps/web-admin/src/app/(protected)/hotels/[hotelId]/page.tsx`, `apps/web-admin/src/features/hotels/components/{hotel-header.tsx,hotel-details-form.tsx,hotel-images-form.tsx,hotel-amenities-form.tsx,hotel-status-dialog.tsx}`

**Interfaces:** Consumes Task 5 hooks. Each section receives `hotel: AdminHotel`.

- [ ] **Step 1: Header:** name, city, Active/Inactive badge; ADMIN sees Deactivate / Reactivate → `AlertDialog` ("Deactivate <name>? It disappears from search and can't be booked. Existing bookings are kept.") → `useSetHotelStatus`.
- [ ] **Step 2: Details:** react-hook-form + `zodResolver(updateHotelSchema)`, defaults from `hotel`, `Textarea` description, time inputs; Save disabled until `isDirty`; on success `reset(newValues)` + "Saved"; server field errors via `applyServerFieldErrors` (fields: name, city, address, description, checkInTime, checkOutTime).
- [ ] **Step 3: Images:** `useFieldArray` over `{ url, alt }`; per row URL + Alt inputs, ↑ (disabled on first), ↓ (disabled on last) via `move()`, ✕ via `remove()`, each with `aria-label` ("Move image 2 up" …); "Add image" (disabled at 20); thumbnail preview `<img>` with `alt`; empty → "No images yet". Save → `useReplaceHotelImages`.
- [ ] **Step 4: Amenities:** `useAmenities("HOTEL")` checkbox grid, defaults from `hotel.amenities`; own loading/error/empty ("No hotel amenities in the catalog"). Server error (`amenityIds`) shown as form alert.
- [ ] **Step 5: Page states:** loading skeleton; `403` → "You don't have access to this hotel"; `404` → "Hotel not found" + back link; other errors → Retry.
- [ ] **Step 6: Verify** lint + typecheck; browser as staff: edit details + times, reorder images with ↑/↓ and reload (order kept), toggle amenities, no Deactivate button; open an unassigned hotel id by URL → access message. As admin: deactivate → web `/hotels/<slug>` is 404; reactivate.
- [ ] **Step 7: Commit + push** `feat(web-admin): hotel detail with details, images and amenities`

### Task 7: web — show check-in/check-out times

**Files:**
- Modify: `apps/web/src/features/hotels/components/hotel-detail.tsx` (near `hotel.address`, line ~77), `apps/web/src/features/bookings/components/booking-detail.tsx` (beside check-in / check-out dates, line ~153)

- [ ] **Step 1:** Hotel page: "Check-in from {checkInTime} · Check-out until {checkOutTime}" (muted text). Booking detail: append "from {checkInTime}" / "until {checkOutTime}" to the dates.
- [ ] **Step 2: Verify** lint + typecheck; browser: a hotel page and a booking detail show 14:00 / 12:00; change a time in admin → web shows the new time after reload.
- [ ] **Step 3: Commit + push** `feat(web): show hotel check-in/check-out times`

### Task 8: Docs + final verification

**Files:** `PLAN.md`, `README.md`, `CLAUDE.md`

- [ ] **Step 1:** `PLAN.md`: 6.1 ✅ (table + checklist), decision #7 → "✅ `checkInTime`/`checkOutTime` บน Hotel (HH:mm, 14:00/12:00), แสดงอย่างเดียว ไม่บังคับใน booking", amenity-scope gap → "ตรวจแล้วสำหรับ hotel (6.1); room types → 6.2". `README.md`: admin endpoints + web-admin routes. `CLAUDE.md`: web-admin `components/admin-shell.tsx` + `nav-items.ts`, `features/amenities/`, `routes/admin/amenities.ts`, `admin-hotel.service.ts`.
- [ ] **Step 2:** `npm run lint && npm run typecheck && npm test && npm run db:check` → all pass (paste the summary lines).
- [ ] **Step 3: Commit + push** `docs: phase 6.1 admin hotels status, README and CLAUDE.md`
