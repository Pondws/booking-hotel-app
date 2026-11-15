# Staff + Amenity catalog (Phase 6.5) — Design

Date: 2026-11-15
Status: Decided by the builder (short directive "start 6.5"), following the 6.1–6.4 patterns
Roadmap: `PLAN.md` Phase 6 → 6.5 · Branch: `feat/admin-staff`

## Intent

Admins create STAFF accounts and decide which hotels each one runs (`HotelStaff` rows — `canAccessHotel` already
reads them, so access changes take effect on the next request). Admins also maintain the amenity catalog that the
hotel / room type forms pick from. Both are ADMIN-only; STAFF keep read access to the amenity options.

## Goals

- Staff: list (search name/email, paginated), create (name, email, password, phone), edit name/phone,
  assign to a hotel, remove from a hotel.
- Amenities: list with usage counts, create, edit (code, name), delete.
- No schema change — `User`, `HotelStaff` and `Amenity` already have everything.

## Non-goals

- Promoting an existing CUSTOMER to STAFF, creating ADMINs, deleting / disabling staff accounts, password resets,
  revoking a staff member's sessions (removing every hotel already removes all access).
- Changing an amenity's scope (existing hotel / room type links would end up in the wrong scope).

## Decisions

| Topic | Decision |
| --- | --- |
| Who | Every new route `requireRole('ADMIN')` (on top of the adminRouter guard). `GET /api/admin/amenities` stays ADMIN + STAFF |
| Staff routes | Router `routes/admin/staff.ts` at `/api/admin/staff`; service `admin-staff.service.ts` |
| List | `GET /staff?q=&page=&pageSize=` → `Paginated<AdminStaffSummary>`, only `role = STAFF`, ordered by name |
| Detail | `GET /staff/:userId` → `AdminStaff`; a non-STAFF id → `404` (admins/customers are never exposed here) |
| Create | `POST /staff` `{ name, email, password, phone? }` → `201 AdminStaff`, `role = STAFF`. Duplicate email → `409 CONFLICT` with `fieldErrors.email` |
| Edit | `PATCH /staff/:userId` `{ name, phone }` (`phone: ""` → null) → `AdminStaff` |
| Assign | `POST /staff/:userId/hotels` `{ hotelId }` → `201 AdminStaff`; unknown hotel → `404`; already assigned → `409`. Inactive hotels can be assigned |
| Remove | `DELETE /staff/:userId/hotels/:hotelId` → `204`; not assigned → `404` |
| Shapes | `AdminStaffSummary`: `id, name, email, phone, hotels: { id, name }[], createdAt`. `AdminStaff` adds `hotels[].city / isActive` |
| Amenity routes | Same router `amenities.ts`: `POST /` → 201, `PATCH /:amenityId` → 200, `DELETE /:amenityId` → 204 |
| Amenity list | `GET /amenities` now returns `AdminAmenity` = option + `hotelCount`, `roomTypeCount` (forms keep parsing `amenityOptionSchema`, extra keys are stripped) |
| Amenity fields | `code` lowercase `a-z0-9` words joined by `-`/`_`, ≤ 40, unique → `409` with `fieldErrors.code`; `name` 1–80; `scope` only on create |
| Amenity delete | Allowed while in use — the join rows cascade. The UI shows the usage count in the confirm dialog |
| Customer site | Unknown amenity codes already fall back to a generic icon (`amenityIcon`) |

## web-admin

- `NAV_ITEMS` gets `roles?: Role[]`; "พนักงาน" (`/staff`) and "สิ่งอำนวยความสะดวก" (`/amenities`) are ADMIN-only.
  The shell filters by the signed-in user's role; a STAFF opening the URL sees a "ไม่มีสิทธิ์" state (the API 403s anyway).
- `/staff`: search + table (name, email, hotel badges) + pagination, loading / error / empty states, "เพิ่มพนักงาน".
- `/staff/new`: form (name, email, password, phone) → redirects to the detail page.
- `/staff/[userId]`: profile card (edit name/phone) + hotels card (list with remove → `AlertDialog`,
  "เพิ่มโรงแรม" dialog with hotel search from `GET /api/admin/hotels?q=`, already-assigned hotels disabled).
- `/amenities`: scope tabs (ทั้งหมด / โรงแรม / ห้องพัก), table (name, code, scope, usage), create / edit in a
  dialog, delete in an `AlertDialog` that names the usage count.
- `features/staff/` (`adminStaffKeys`), `features/amenities/` extended (writes invalidate `amenityKeys.all` and
  the admin hotel / room type details that embed amenities).

## Tests (API)

Staff: STAFF caller → 403 on every route, web session → 401; list only STAFF users + search; create 201 (role STAFF,
can sign in to admin), duplicate email 409; detail of an ADMIN/CUSTOMER id → 404; edit; assign 201 → staff can
read that hotel, assign twice 409, unknown hotel 404; remove 204 → staff gets 403 on that hotel, remove again 404.
Amenities: STAFF can list but writes → 403; create 201 + duplicate code 409; invalid code 400; edit; list counts;
delete 204 removes the hotel link.
