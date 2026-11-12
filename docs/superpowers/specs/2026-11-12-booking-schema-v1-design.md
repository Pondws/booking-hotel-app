# Booking Schema v1 — Design

Date: 2026-11-12
Status: Approved in chat, awaiting written-spec review

## Goal

Replace the initial `Hotel` / `Room` / `Booking` schema with a data model that supports the
real booking domain: room types with physical rooms, base + seasonal pricing, user accounts
with roles, staff assigned to hotels, images, amenities, payments and reviews. Double booking
must be impossible at the database level.

## Decisions

| Topic | Decision |
| --- | --- |
| Room model | `RoomType` (what customers book) → many `Room` (physical units, e.g. 101) |
| Pricing | `RoomType.basePrice` + `RatePeriod` overrides by date range |
| Users | Single `User` table with `Role` (`CUSTOMER`, `STAFF`, `ADMIN`); login required to book |
| Staff scope | `HotelStaff` join table; STAFF manages only assigned hotels, ADMIN manages all |
| Booking unit | 1 booking = 1 physical room. Multiple rooms = multiple bookings |
| Double-booking guard | Room is assigned at booking time; Postgres exclusion constraint on `(room_id, daterange)` for active bookings |
| Dates | `checkIn`, `checkOut`, `startDate`, `endDate` are `@db.Date`; end dates are exclusive (`[)`) |
| Money | `Decimal(10,2)`; currency set per hotel (default `THB`) and copied onto bookings/payments |
| Migration | New migration drops the old tables and creates the new ones (approved: dev data is seed-only). The applied `init` migration is not edited |
| Out of scope | Auth sessions/tokens, controller/service layering, `{ data }` response wrapping, `requireRole`, new endpoints |

## Conventions

Every model has `id String @id @default(cuid())`, `createdAt DateTime @default(now())` and
`updatedAt DateTime @updatedAt`. Every model uses `@@map` to a plural snake_case table name, and
every field uses `@map` to its snake_case column name (needed so raw SQL can refer to columns
like `room_id`). Every foreign key has an `@@index`, or is the leading column of a
`@@unique`/`@@index`.

## Enums

- `Role`: `CUSTOMER`, `STAFF`, `ADMIN`
- `BookingStatus`: `PENDING`, `CONFIRMED`, `CANCELLED`, `EXPIRED`, `COMPLETED`
- `PaymentStatus`: `PENDING`, `SUCCEEDED`, `FAILED`, `REFUNDED`
- `AmenityScope`: `HOTEL`, `ROOM`

## Models

### Users

| Model (table) | Fields | Constraints / indexes |
| --- | --- | --- |
| `User` (`users`) | `email`, `passwordHash`, `name`, `phone?`, `role Role @default(CUSTOMER)` | `email @unique` |
| `HotelStaff` (`hotel_staff`) | `userId`, `hotelId` | `@@unique([userId, hotelId])`, `@@index([hotelId])` |

`passwordHash` must never be selected into API responses.

### Hotels and rooms

| Model (table) | Fields | Constraints / indexes |
| --- | --- | --- |
| `Hotel` (`hotels`) | `name`, `slug`, `city`, `address`, `description?`, `currency @default("THB")`, `ratingAvg Float @default(0)`, `reviewCount Int @default(0)`, `isActive Boolean @default(true)` | `slug @unique`, `@@index([city])` |
| `HotelImage` (`hotel_images`) | `hotelId`, `url`, `alt?`, `sortOrder Int @default(0)` | `@@index([hotelId])` |
| `Amenity` (`amenities`) | `code`, `name`, `scope AmenityScope` | `code @unique` |
| `HotelAmenity` (`hotel_amenities`) | `hotelId`, `amenityId` | `@@unique([hotelId, amenityId])`, `@@index([amenityId])` |
| `RoomType` (`room_types`) | `hotelId`, `name`, `description?`, `capacity Int`, `basePrice Decimal(10,2)`, `isActive Boolean @default(true)` | `@@index([hotelId])` |
| `RoomTypeImage` (`room_type_images`) | `roomTypeId`, `url`, `alt?`, `sortOrder Int @default(0)` | `@@index([roomTypeId])` |
| `RoomTypeAmenity` (`room_type_amenities`) | `roomTypeId`, `amenityId` | `@@unique([roomTypeId, amenityId])`, `@@index([amenityId])` |
| `Room` (`rooms`) | `roomTypeId`, `number String`, `isActive Boolean @default(true)` | `@@unique([roomTypeId, number])` |

Room numbers are unique within a room type, not across the whole hotel. Getting hotel-wide
uniqueness would mean adding a redundant `hotelId` to `Room`, and that column could drift out of
sync with the room type's hotel.

### Pricing

| Model (table) | Fields | Constraints / indexes |
| --- | --- | --- |
| `RatePeriod` (`rate_periods`) | `roomTypeId`, `name?`, `startDate @db.Date`, `endDate @db.Date`, `price Decimal(10,2)` | `@@index([roomTypeId, startDate])`; raw SQL: `CHECK (end_date > start_date)`, exclusion constraint so periods of one room type never overlap |

A night's price is the `price` of the `RatePeriod` that covers that night, or `RoomType.basePrice`
when no period covers it. Because periods cannot overlap, at most one period ever covers a given
night.

### Bookings

| Model (table) | Fields | Constraints / indexes |
| --- | --- | --- |
| `Booking` (`bookings`) | `code`, `userId`, `roomId`, `guestName`, `guestEmail`, `guestPhone?`, `guests Int`, `checkIn @db.Date`, `checkOut @db.Date`, `status BookingStatus @default(PENDING)`, `totalAmount Decimal(10,2)`, `currency`, `expiresAt DateTime?`, `cancelledAt DateTime?` | `code @unique`, `@@index([userId])`, `@@index([roomId, checkIn])`, `@@index([status])`; raw SQL: `CHECK (check_out > check_in)`, `CHECK (guests >= 1)`, exclusion constraint below |
| `Payment` (`payments`) | `bookingId`, `amount Decimal(10,2)`, `currency`, `status PaymentStatus @default(PENDING)`, `provider String`, `providerRef String?`, `paidAt DateTime?` | `providerRef @unique`, `@@index([bookingId])` |
| `Review` (`reviews`) | `bookingId`, `userId`, `hotelId`, `rating Int`, `comment?` | `bookingId @unique`, `@@index([hotelId])`, `@@index([userId])`; raw SQL: `CHECK (rating BETWEEN 1 AND 5)` |

- `code` is a short reference that people can read, e.g. `BK7Q2X9A`. The service generates it.
- `guestName` / `guestEmail` describe who is staying. They default to the booking user's details
  but may differ.
- `totalAmount` and `currency` record the price when the booking was made. Later rate changes do
  not affect existing bookings. Per-night prices are not stored (YAGNI).
- A review is tied to a booking (`bookingId @unique`), so only guests who actually booked can
  review, and only once per booking. Creating a review updates `Hotel.ratingAvg` and
  `Hotel.reviewCount` in the same `$transaction`.

### Double-booking guard

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (room_id WITH =, daterange(check_in, check_out, '[)') WITH &&)
  WHERE (status IN ('PENDING', 'CONFIRMED'));

ALTER TABLE rate_periods ADD CONSTRAINT rate_periods_no_overlap
  EXCLUDE USING gist (room_type_id WITH =, daterange(start_date, end_date, '[)') WITH &&);
```

The `[)` range treats `checkOut` as exclusive: a guest who checks out on the 5th does not overlap a
guest who checks in on the 5th.

**Expired holds.** A `PENDING` booking holds its room until `expiresAt`. A constraint's `WHERE`
clause cannot use `now()`. So, inside the booking transaction and before it looks for a free room,
the booking service sets `status = 'EXPIRED'` on `PENDING` bookings of that room type whose
`expiresAt < now()`. The rooms they held then become free.

**Booking flow (for the later service work):** in one `$transaction`, expire stale holds, list
the active rooms of the requested room type that have no active overlapping booking, and insert
the booking on the first of them. If the insert fails with exclusion violation `23P01` (a
concurrent request took the same room), try the next room. When no room is left, throw
`AppError(409, "ROOM_UNAVAILABLE", ...)`.

## Delete behaviour

| Relation | onDelete |
| --- | --- |
| `Booking → Room`, `Booking → User`, `Review → Booking/User/Hotel`, `Payment → Booking` | `Restrict` (booking history is never lost) |
| `RoomType → Hotel`, `Room → RoomType`, `RatePeriod → RoomType` | `Restrict` |
| Images, `HotelAmenity`, `RoomTypeAmenity`, `HotelStaff` | `Cascade` |

To retire a hotel, room type or room, set `isActive = false` instead of deleting the row.

## Migration

1. Rewrite `apps/api/prisma/schema.prisma` to match this spec. Add a comment next to `Booking`,
   `RatePeriod` and `Review` naming the constraints that exist only in raw SQL.
2. `npx prisma migrate dev --create-only --name booking_domain_v1` (inside `apps/api`).
3. Append the raw SQL from this spec (extension, exclusion constraints, CHECK constraints) to the
   generated, not-yet-applied migration file.
4. `npm run db:migrate`, then `npx prisma migrate status` must report that the database is up to
   date.

## Seed (`apps/api/prisma/seed.ts`, full rewrite)

- 3 users: admin, staff (assigned to the first hotel) and customer. Passwords are hashed with
  `node:crypto` `scrypt`, so no new dependency is needed. The seed uses a fixed dev password and
  logs it.
- Amenities: `wifi`, `pool`, `parking`, `breakfast` (HOTEL); `aircon`, `bathtub` (ROOM).
- The 3 existing hotels (Bangkok, Chiang Mai, Phuket) with slugs and addresses. Each has 1–2 room
  types, 2–4 rooms per room type, placeholder image URLs, amenities and one `RatePeriod`.
- 1 `COMPLETED` booking for the customer, with a `SUCCEEDED` payment and a review. The seed sets
  that hotel's `ratingAvg` / `reviewCount` to match.
- Deletes run in reverse dependency order, because of the `Restrict` relations.

## Impact on existing code

Change only what is needed to keep lint, typecheck and build passing:

| File | Change |
| --- | --- |
| `packages/shared/src/index.ts` | `hotelSchema`: replace `rating` with `ratingAvg`; add `slug`, `address`, `currency`, `reviewCount`. `createHotelSchema`: remove `rating`, add `address`. `createBookingSchema`: replace `roomId` with `roomTypeId`, remove `guestName`/`guestEmail` as required inputs (the booking user's details are used unless overridden), add `guests` |
| `apps/api/src/routes/hotels.ts` | Generate a unique `slug` from `name` when creating a hotel |
| `apps/web/src/components/hotel-list.tsx` | `rating` → `ratingAvg` |
| `apps/web-admin/src/components/hotel-list.tsx` | `rating` → `ratingAvg` |
| `apps/web-admin/src/components/create-hotel-form.tsx` | Remove the rating field, add an address field |

### Known existing gaps (not fixed here)

- `POST /api/hotels` has no access check and does not live under `/api/admin/*`.
- Routes return unwrapped JSON instead of `{ data: ... }`.
- Routes call Prisma directly. There are no controller or service layers yet.

## Verification

There is no test runner yet. To verify:

1. `npm run lint && npm run typecheck` pass.
2. `npx prisma migrate status` reports that the database is up to date.
3. `npm run db:seed` succeeds.
4. Manual SQL checks against the seeded DB:
   - Inserting an overlapping `PENDING` booking on the same room fails with `23P01`.
   - An overlapping `CANCELLED` booking on the same room succeeds.
   - Back-to-back bookings (checkOut = next checkIn) succeed.
   - An overlapping `RatePeriod` for the same room type fails with `23P01`.
   - `check_out <= check_in` and `rating = 6` fail their CHECK constraints.
