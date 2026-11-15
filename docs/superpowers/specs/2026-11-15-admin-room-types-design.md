# Room types + Rooms (Phase 6.2) — Design

Date: 2026-11-15
Status: Decided by the builder (short directive "6.2 ต่อ"), following the 6.1 patterns
Roadmap: `PLAN.md` Phase 6 → 6.2 · Branch: `feat/admin-room-types` (on top of `feat/hotel-single-form`)

## Intent

Staff and admins manage what a hotel sells: room types (name, description, capacity, base price, images, room
amenities) and the physical rooms under each type. Customers already only see active room types with active
rooms (`hotel.service`, `availability.service`, `booking.service` all filter `isActive`), so no public change.

## Goals

- Room types: list per hotel, create, edit (one form, saved atomically like the hotel page), deactivate /
  reactivate, delete only while nothing depends on it.
- Room type images: ordered URL list (upload or URL), same rules as hotel images (max 20, unique, http/https).
- Room type amenities: ROOM-scope only — checked in the service (the DB doesn't check scope).
- Rooms: add, rename (change number), deactivate / reactivate.
- Every endpoint enforces hotel access; a room type / room that doesn't belong to the hotel in the URL is `404`.

## Non-goals

- Rate periods (6.3), bookings / moving guests (6.4).
- Deleting rooms (bookings reference them — deactivate instead).
- Bulk-adding rooms, reordering room types.
- Cancelling or moving existing bookings when a room / room type is deactivated (they're kept, like hotels).

## Anti-goals

- STAFF reading or changing room types / rooms of a hotel they're not assigned to.
- Reaching a room type of hotel B through `/hotels/A/room-types/:id`.
- A HOTEL-scope amenity on a room type.
- Two rooms with the same number in one hotel.
- A half-applied room type save.

## Decisions

| Topic | Decision |
| --- | --- |
| Who | ADMIN + assigned STAFF can do everything in 6.2, including create, deactivate and delete *(my call — room setup is day-to-day hotel work; only hotel create/status stay ADMIN-only)* |
| Routes | Nested router `/api/admin/hotels/:hotelId/room-types` (`mergeParams`), mounted behind `requireHotelAccess()` once |
| List | `GET …/room-types` → `AdminRoomTypeSummary[]` ordered by name (no paging — per hotel, small): `id, name, capacity, basePrice, isActive, roomCount, activeRoomCount, coverImage, updatedAt` |
| Detail | `GET …/room-types/:roomTypeId` → `AdminRoomType`: `id, hotel{ id, name, currency }, name, description, capacity, basePrice, isActive, images[], amenities[], rooms[{ id, number, isActive }] (by number), deletable, createdAt, updatedAt`. Every write returns it |
| Create | `POST …/room-types` body `roomTypeInputSchema` → `201` |
| Save | `PUT …/room-types/:roomTypeId` body `roomTypeInputSchema` (name, description, capacity, basePrice, images, amenityIds) — one `$transaction` |
| Fields | name 1–120, description ≤ 2000 (`""` → null), capacity int 1–20, basePrice number 0–99,999,999.99 with ≤ 2 decimals (stored as `Decimal(10,2)` via a string) |
| Status | `PATCH …/room-types/:roomTypeId/status` `{ isActive }` |
| Delete | `DELETE …/room-types/:roomTypeId` → `204`; `409 CONFLICT` if it has rooms or rate periods ("Deactivate it instead"). `deletable` tells the UI |
| Rooms | `POST …/:roomTypeId/rooms` `{ number }` → `201`; `PATCH …/:roomTypeId/rooms/:roomId` `{ number?, isActive? }` (≥ 1). Number: trimmed, 1–20 chars, `[A-Za-z0-9-]` |
| Room numbers | Unique per **hotel** (checked in the service; DB `@@unique([roomTypeId, number])` stays as the backstop) → `409 CONFLICT` "Room 101 already exists in this hotel" |
| Ownership | Service loads with `where: { id: roomTypeId, hotelId }` / `{ id: roomId, roomTypeId }` → `404` otherwise; unknown hotel (ADMIN) → `404` |
| Deactivated room / type | Hidden from search, quotes and new bookings (existing filters). Existing bookings untouched |

## web-admin

| Route | Content |
| --- | --- |
| `/hotels/[hotelId]` | new **Room types** card under the hotel form: table (name, guests, base price, rooms active/total, status) linking to each, "New room type" button; loading / error / empty states |
| `/hotels/[hotelId]/room-types/new` | room type form (create) → opens the new room type |
| `/hotels/[hotelId]/room-types/[roomTypeId]` | room type form (Details, Images, Amenities) with Deactivate / Reactivate and Delete (when `deletable`) in the header; **Rooms** card below: add room, rename inline, deactivate / reactivate |

- The images and amenities sections and `Field` move out of `hotel-form.tsx` into `components/` and read the form
  through `useFormContext`, so the hotel and room type forms share them (amenities take a `scope`).
- `features/room-types/`: `api.ts`, `hooks.ts` (`adminRoomTypeKeys.list(hotelId)` / `.detail(hotelId, id)`;
  writes `setQueryData` the detail and invalidate the list), components.

## Tests (API)

Access (unassigned STAFF 403, web session 401, cross-hotel 404), list counts, create/save with images + ROOM
amenities, HOTEL amenity → 400, validation (capacity, price decimals), status hides it from the public hotel page,
delete (204 when empty, 409 with rooms), rooms add / rename / deactivate, duplicate number in the same hotel
(other type) → 409.
