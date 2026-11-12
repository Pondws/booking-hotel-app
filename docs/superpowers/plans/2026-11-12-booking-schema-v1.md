# Booking Schema v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the initial Hotel/Room/Booking schema with the v1 booking domain model (room types + physical rooms, seasonal rates, users/roles, staff, images, amenities, payments, reviews), with double booking blocked by Postgres constraints. Then update the seed and the existing code so lint, typecheck and build pass again.

**Architecture:** Prisma 7 `schema.prisma` defines the models. A single new migration drops the old tables, creates the new ones, and has raw SQL appended for the constraints Prisma cannot express (a `btree_gist` exclusion constraint and CHECKs). A self-contained SQL script tests those constraints inside a transaction that is rolled back. Pure helpers (`toSlug`, the shared zod schemas) are unit-tested with Node's built-in `node:test`, run through the `tsx` package that is already installed.

**Tech Stack:** Prisma 7 (`prisma-client` generator, PrismaPg adapter), PostgreSQL 18 (Docker container `booking-hotel-postgres`, DB `booking_hotel`, user `postgres`), zod v4, Express 5, Next.js 16, `node:test` + `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-12-booking-schema-v1-design.md`. Read it first; it holds every model, field, index and delete rule. This plan does not repeat them.

## Global Constraints

- Every model has `id String @id @default(cuid())`, `createdAt DateTime @default(now()) @map("created_at")`, `updatedAt DateTime @updatedAt @map("updated_at")`.
- Every model uses `@@map("<plural_snake_case>")`, and every field `@map("<snake_case>")`. Raw SQL depends on these exact names: `room_id`, `check_in`, `check_out`, `status`, `guests`, `room_type_id`, `start_date`, `end_date`, `rating`.
- Money fields are `Decimal @db.Decimal(10, 2)`. Date-only fields are `DateTime @db.Date`.
- Do not edit `apps/api/prisma/migrations/20261112042443_init/`.
- Do not add npm dependencies. Password hashing uses `node:crypto` `scrypt`. Tests use `node:test` + `node:assert/strict` run through `npx tsx --test`.
- TypeScript strict, no `any`. Never select `passwordHash` into API responses.
- Out of scope: auth/sessions, `requireRole`, controller/service layering, `{ data }` response wrapping, new endpoints.

## Review Focus

- A hotel name with no Latin characters (e.g. `"โรงแรมริมน้ำ"`) must still get a non-empty, URL-safe slug (`"hotel"`, then `-2`, `-3`…). Pinned in Task 2.
- Creating two hotels with the same name must not fail on `slug @unique`; the second gets `-2`. Pinned in Task 2 (pure suffix logic) and a manual curl check.
- `checkIn: "2027-01-10"` must stay the 10th, with no shift from a UTC/local timezone conversion, so booking dates are ISO date strings (`YYYY-MM-DD`), not `z.coerce.date()`. Pinned in Task 2.
- `checkOut` equal to `checkIn` (zero nights) must be rejected by the shared schema as well as by the DB CHECK. Pinned in Task 2 and Task 1.
- Running `npm run db:seed` twice in a row must succeed: deletes respect the `Restrict` relations. Pinned in Task 3.

---

### Task 1: Schema, migration and DB constraints

**Files:**
- Create: `apps/api/prisma/checks/constraints.sql`
- Modify: `apps/api/prisma/schema.prisma` (full rewrite)
- Create: `apps/api/prisma/migrations/<timestamp>_booking_domain_v1/migration.sql` (generated, then appended)

**Interfaces:**
- Produces: the generated Prisma client models `user`, `hotelStaff`, `hotel`, `hotelImage`, `amenity`, `hotelAmenity`, `roomType`, `roomTypeImage`, `roomTypeAmenity`, `room`, `ratePeriod`, `booking`, `payment`, `review`, plus the enums `Role`, `BookingStatus`, `PaymentStatus`, `AmenityScope`, all exported from `apps/api/src/generated/prisma/client`. Field names exactly as in the spec.
- Produces: DB constraints named `bookings_no_overlap`, `rate_periods_no_overlap`, `bookings_dates_check`, `bookings_guests_check`, `rate_periods_dates_check`, `reviews_rating_check`.

- [ ] **Step 1: Write the constraint check script** at `apps/api/prisma/checks/constraints.sql`

```sql
-- Run: docker exec -i booking-hotel-postgres psql -U postgres -d booking_hotel -v ON_ERROR_STOP=1 < apps/api/prisma/checks/constraints.sql
BEGIN;

CREATE FUNCTION pg_temp.expect_fail(stmt text, code text) RETURNS void AS $$
BEGIN
  EXECUTE stmt;
  RAISE EXCEPTION 'expected SQLSTATE % but statement succeeded: %', code, stmt;
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE <> code THEN
    RAISE EXCEPTION 'expected SQLSTATE %, got % (%): %', code, SQLSTATE, SQLERRM, stmt;
  END IF;
END $$ LANGUAGE plpgsql;

INSERT INTO users (id, email, password_hash, name, updated_at) VALUES ('t_user', 't@test.local', 'x', 'T', now());
INSERT INTO hotels (id, name, slug, city, address, updated_at) VALUES ('t_hotel', 'T', 't-hotel', 'C', 'A', now());
INSERT INTO room_types (id, hotel_id, name, capacity, base_price, updated_at) VALUES ('t_rt', 't_hotel', 'RT', 2, 1000, now());
INSERT INTO rooms (id, room_type_id, number, updated_at) VALUES ('t_r1', 't_rt', '101', now()), ('t_r2', 't_rt', '102', now());
INSERT INTO bookings (id, code, user_id, room_id, guest_name, guest_email, guests, check_in, check_out, status, total_amount, currency, updated_at)
  VALUES ('t_b1', 'T1', 't_user', 't_r1', 'G', 'g@test.local', 1, '2027-01-10', '2027-01-13', 'CONFIRMED', 3000, 'THB', now());

-- overlapping active booking on the same room is rejected
SELECT pg_temp.expect_fail($q$INSERT INTO bookings (id, code, user_id, room_id, guest_name, guest_email, guests, check_in, check_out, status, total_amount, currency, updated_at)
  VALUES ('t_b2', 'T2', 't_user', 't_r1', 'G', 'g@test.local', 1, '2027-01-12', '2027-01-14', 'PENDING', 2000, 'THB', now())$q$, '23P01');
-- overlapping CANCELLED booking is allowed
INSERT INTO bookings (id, code, user_id, room_id, guest_name, guest_email, guests, check_in, check_out, status, total_amount, currency, updated_at)
  VALUES ('t_b3', 'T3', 't_user', 't_r1', 'G', 'g@test.local', 1, '2027-01-11', '2027-01-12', 'CANCELLED', 1000, 'THB', now());
-- back-to-back (checkOut = next checkIn) is allowed
INSERT INTO bookings (id, code, user_id, room_id, guest_name, guest_email, guests, check_in, check_out, status, total_amount, currency, updated_at)
  VALUES ('t_b4', 'T4', 't_user', 't_r1', 'G', 'g@test.local', 1, '2027-01-13', '2027-01-15', 'CONFIRMED', 2000, 'THB', now());
-- same dates on a different room is allowed
INSERT INTO bookings (id, code, user_id, room_id, guest_name, guest_email, guests, check_in, check_out, status, total_amount, currency, updated_at)
  VALUES ('t_b5', 'T5', 't_user', 't_r2', 'G', 'g@test.local', 1, '2027-01-10', '2027-01-13', 'PENDING', 3000, 'THB', now());
-- zero nights and zero guests are rejected
SELECT pg_temp.expect_fail($q$INSERT INTO bookings (id, code, user_id, room_id, guest_name, guest_email, guests, check_in, check_out, status, total_amount, currency, updated_at)
  VALUES ('t_b6', 'T6', 't_user', 't_r2', 'G', 'g@test.local', 1, '2027-02-01', '2027-02-01', 'PENDING', 0, 'THB', now())$q$, '23514');
SELECT pg_temp.expect_fail($q$INSERT INTO bookings (id, code, user_id, room_id, guest_name, guest_email, guests, check_in, check_out, status, total_amount, currency, updated_at)
  VALUES ('t_b7', 'T7', 't_user', 't_r2', 'G', 'g@test.local', 0, '2027-02-01', '2027-02-02', 'PENDING', 1000, 'THB', now())$q$, '23514');

-- rate periods: overlap rejected, adjacent allowed, empty range rejected
INSERT INTO rate_periods (id, room_type_id, start_date, end_date, price, updated_at) VALUES ('t_p1', 't_rt', '2027-04-10', '2027-04-17', 1500, now());
SELECT pg_temp.expect_fail($q$INSERT INTO rate_periods (id, room_type_id, start_date, end_date, price, updated_at) VALUES ('t_p2', 't_rt', '2027-04-15', '2027-04-20', 1600, now())$q$, '23P01');
INSERT INTO rate_periods (id, room_type_id, start_date, end_date, price, updated_at) VALUES ('t_p3', 't_rt', '2027-04-17', '2027-04-20', 1600, now());
SELECT pg_temp.expect_fail($q$INSERT INTO rate_periods (id, room_type_id, start_date, end_date, price, updated_at) VALUES ('t_p4', 't_rt', '2027-05-01', '2027-05-01', 1600, now())$q$, '23514');

-- review rating outside 1..5 is rejected
SELECT pg_temp.expect_fail($q$INSERT INTO reviews (id, booking_id, user_id, hotel_id, rating, updated_at) VALUES ('t_v1', 't_b1', 't_user', 't_hotel', 6, now())$q$, '23514');

DO $$ BEGIN RAISE NOTICE 'ALL CONSTRAINT CHECKS PASSED'; END $$;
ROLLBACK;
```

- [ ] **Step 2: Run it against the current DB and confirm it fails**

Run: `npm run db:up`, then `docker exec -i booking-hotel-postgres psql -U postgres -d booking_hotel -v ON_ERROR_STOP=1 < apps/api/prisma/checks/constraints.sql`
Expected: FAIL with `ERROR:  relation "users" does not exist`

- [ ] **Step 3: Rewrite `apps/api/prisma/schema.prisma`** to the spec's models, enums, indexes and `onDelete` table. Keep the existing `generator` and `datasource` blocks unchanged. Add a `///` comment above `Booking`, `RatePeriod` and `Review` naming the raw-SQL constraints from the Interfaces block.

- [ ] **Step 4: Generate the migration without applying it**

Run (inside `apps/api`): `npx prisma migrate dev --create-only --name booking_domain_v1`
Expected: a new `prisma/migrations/<timestamp>_booking_domain_v1/migration.sql` containing `DROP TABLE "Booking"`, `"Room"`, `"Hotel"` and the `CREATE TABLE "users"`… statements. Prisma warns about data loss; confirm with yes. The user approved this in the spec.

- [ ] **Step 5: Append the raw SQL** to the end of that `migration.sql`: the `CREATE EXTENSION`, plus the two `EXCLUDE` constraints from the spec's "Double-booking guard" section. Use the constraint names from the Interfaces block, and add these CHECKs:

```sql
ALTER TABLE bookings     ADD CONSTRAINT bookings_dates_check      CHECK (check_out > check_in);
ALTER TABLE bookings     ADD CONSTRAINT bookings_guests_check     CHECK (guests >= 1);
ALTER TABLE rate_periods ADD CONSTRAINT rate_periods_dates_check  CHECK (end_date > start_date);
ALTER TABLE reviews      ADD CONSTRAINT reviews_rating_check      CHECK (rating BETWEEN 1 AND 5);
```

`CREATE EXTENSION IF NOT EXISTS btree_gist;` must come before the `EXCLUDE` constraints.

- [ ] **Step 6: Apply and regenerate**

Run: `npm run db:migrate`
Expected: `Applying migration <timestamp>_booking_domain_v1` and the Prisma client is regenerated. No new migration is created.

- [ ] **Step 7: Run the constraint script and confirm it passes**

Run: the same command as Step 2
Expected: `NOTICE:  ALL CONSTRAINT CHECKS PASSED` then `ROLLBACK`, with exit code 0

- [ ] **Step 8: Confirm Prisma sees no drift**

Run (inside `apps/api`): `npx prisma migrate status`, then `npx prisma migrate dev --create-only --name drift_check`
Expected: `Database schema is up to date!`, and the second command reports that nothing changed and creates no migration folder. If it does create one, delete that folder and stop: the raw constraints are being diffed, and the plan needs revisiting.

- [ ] **Step 9: Commit**

`npm run typecheck` is expected to fail only in `apps/api/prisma/seed.ts` and `apps/api/src/routes/hotels.ts` at this point. Task 2 fixes the route and Task 3 fixes the seed.

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/prisma/checks
git commit -m "feat(db): booking domain v1 schema with overlap constraints"
```

---

### Task 2: Shared schemas, hotel slug and existing UI

**Files:**
- Create: `apps/api/src/lib/slug.ts`
- Create: `apps/api/src/lib/slug.test.ts`
- Create: `apps/api/src/lib/shared-schemas.test.ts`
- Modify: `packages/shared/src/index.ts` (Hotel and Booking sections)
- Modify: `apps/api/src/routes/hotels.ts`
- Modify: `apps/web/src/components/hotel-list.tsx:37`
- Modify: `apps/web-admin/src/components/hotel-list.tsx:37`
- Modify: `apps/web-admin/src/components/create-hotel-form.tsx:49`

**Interfaces:**
- Consumes: the `hotel` model from Task 1 (`slug @unique`, `address`, `ratingAvg`, `reviewCount`, `currency`).
- Produces: `toSlug(input: string): string` and `withSuffix(base: string, taken: readonly string[]): string` in `apps/api/src/lib/slug.ts`.
- Produces (`@booking/shared`): `hotelSchema` = `{ id, name, slug, city, address, description: string | null, currency, ratingAvg: number (0–5), reviewCount: int ≥ 0, createdAt: coerce.date }`. `createHotelSchema` = `{ name (1–120), city (1–80), address (1–255), description? (≤2000) }`, all trimmed. `createBookingSchema` = `{ roomTypeId: string min 1, checkIn: z.iso.date(), checkOut: z.iso.date(), guests: z.coerce.number().int().min(1).max(20), guestName?: trimmed 1–120, guestEmail?: z.email(), guestPhone?: trimmed 1–30 }`, plus a refine requiring `checkOut > checkIn` (compare the ISO strings) with `path: ["checkOut"]`.

- [ ] **Step 1: Write the failing tests**

`apps/api/src/lib/slug.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { toSlug, withSuffix } from "./slug";

test("toSlug lowercases, strips accents and joins with dashes", () => {
  assert.equal(toSlug("  Riverside Bangkok "), "riverside-bangkok");
  assert.equal(toSlug("Café  & Spa!!"), "cafe-spa");
});
test("toSlug falls back to 'hotel' when nothing Latin remains", () => {
  assert.equal(toSlug("โรงแรมริมน้ำ"), "hotel");
  assert.equal(toSlug("---"), "hotel");
});
test("withSuffix returns base when free, else the next free -n", () => {
  assert.equal(withSuffix("riverside", []), "riverside");
  assert.equal(withSuffix("riverside", ["riverside"]), "riverside-2");
  assert.equal(withSuffix("riverside", ["riverside", "riverside-2", "riverside-4"]), "riverside-3");
});
```

`apps/api/src/lib/shared-schemas.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBookingSchema, createHotelSchema } from "@booking/shared";

const base = { roomTypeId: "rt1", checkIn: "2027-01-10", checkOut: "2027-01-13", guests: 2 };

test("booking dates stay as the same calendar day strings", () => {
  const r = createBookingSchema.parse(base);
  assert.equal(r.checkIn, "2027-01-10");
  assert.equal(r.checkOut, "2027-01-13");
});
test("booking rejects zero nights and reversed dates on checkOut", () => {
  for (const checkOut of ["2027-01-10", "2027-01-09"]) {
    const r = createBookingSchema.safeParse({ ...base, checkOut });
    assert.equal(r.success, false);
    assert.deepEqual(r.error?.issues[0]?.path, ["checkOut"]);
  }
});
test("booking rejects non-date strings and guests < 1", () => {
  assert.equal(createBookingSchema.safeParse({ ...base, checkIn: "2027-13-01" }).success, false);
  assert.equal(createBookingSchema.safeParse({ ...base, guests: 0 }).success, false);
});
test("createHotel requires address and no longer accepts rating", () => {
  assert.equal(createHotelSchema.safeParse({ name: "A", city: "B" }).success, false);
  const r = createHotelSchema.parse({ name: "A", city: "B", address: "1 Road", rating: 5 });
  assert.equal("rating" in r, false);
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run (inside `apps/api`): `npx tsx --test src/lib/slug.test.ts src/lib/shared-schemas.test.ts`
Expected: FAIL. `slug.test.ts` cannot resolve `./slug`, and the shared-schema tests fail because `checkIn` is a `Date` and `address` is not required.

- [ ] **Step 3: Implement `toSlug` and `withSuffix` in `apps/api/src/lib/slug.ts`**

`toSlug`: `normalize("NFKD")`, remove combining marks (`\p{M}`), lowercase, replace each run of `[^a-z0-9]+` with `-`, trim leading and trailing `-`, and return `"hotel"` if the result is empty. `withSuffix`: return `base` if it is not in `taken`; otherwise return the first `${base}-${n}` with `n` starting at 2 that is not in `taken`.

- [ ] **Step 4: Update `packages/shared/src/index.ts`** Hotel and Booking sections to the shapes in the Interfaces block. Leave the Health section unchanged.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: same as Step 2
Expected: all 7 tests pass

- [ ] **Step 6: Generate a unique slug in `apps/api/src/routes/hotels.ts` POST**

Compute `const base = toSlug(data.name)`. Load `prisma.hotel.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })` and create with `slug: withSuffix(base, taken)`. GET is unchanged. A concurrent duplicate still hits `slug @unique`; that is accepted for v1 (see the spec's known gaps).

- [ ] **Step 7: Update the UI**

In both `hotel-list.tsx` files, `hotel.rating.toFixed(1)` → `hotel.ratingAvg.toFixed(1)`. In `create-hotel-form.tsx`, replace the `rating` `Field` with `<Field name="address" label="Address" error={errors.address} />`.

- [ ] **Step 8: Typecheck and lint**

Run: `npm run typecheck`, then `npm run lint`
Expected: lint passes. Typecheck passes in every workspace except `apps/api/prisma/seed.ts`, which Task 3 fixes.

- [ ] **Step 9: Manual API check**

Run `npm run dev:api`, then POST `{"name":"Riverside Bangkok","city":"Bangkok","address":"1 Road"}` to `http://localhost:8000/api/hotels` twice.
Expected: both return `201`, with slugs `riverside-bangkok` and `riverside-bangkok-2` (or `-2` / `-3` if the seed hotel already holds the base slug).

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/lib/slug.ts apps/api/src/lib/slug.test.ts apps/api/src/lib/shared-schemas.test.ts packages/shared/src/index.ts apps/api/src/routes/hotels.ts apps/web/src/components/hotel-list.tsx apps/web-admin/src/components/hotel-list.tsx apps/web-admin/src/components/create-hotel-form.tsx
git commit -m "feat: align shared schemas, hotel slug and UI with schema v1"
```

---

### Task 3: Password hashing helper and seed rewrite

**Files:**
- Create: `apps/api/src/lib/password.ts`
- Create: `apps/api/src/lib/password.test.ts`
- Modify: `apps/api/prisma/seed.ts` (full rewrite)

**Interfaces:**
- Consumes: the Prisma models from Task 1, plus `toSlug` from Task 2.
- Produces: `hashPassword(plain: string): Promise<string>` and `verifyPassword(plain: string, stored: string): Promise<boolean>` in `apps/api/src/lib/password.ts`. The stored format is `scrypt$<saltHex>$<hashHex>`, with a 16-byte salt and a 64-byte key. Later auth work will import these.

- [ ] **Step 1: Write the failing test** `apps/api/src/lib/password.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password";

test("hash has scrypt format and differs per call", async () => {
  const a = await hashPassword("Password123!");
  const b = await hashPassword("Password123!");
  assert.match(a, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.notEqual(a, b);
});
test("verify accepts the right password and rejects others", async () => {
  const h = await hashPassword("Password123!");
  assert.equal(await verifyPassword("Password123!", h), true);
  assert.equal(await verifyPassword("wrong", h), false);
  assert.equal(await verifyPassword("Password123!", "garbage"), false);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run (inside `apps/api`): `npx tsx --test src/lib/password.test.ts`
Expected: FAIL, because `./password` cannot be resolved

- [ ] **Step 3: Implement `hashPassword` / `verifyPassword`** with `node:crypto` `scrypt` (promisified) and `randomBytes(16)`. `verifyPassword` returns `false` for a malformed `stored` value and compares with `timingSafeEqual`.

- [ ] **Step 4: Run it and confirm it passes**

Run: same as Step 2
Expected: 2 tests pass

- [ ] **Step 5: Rewrite `apps/api/prisma/seed.ts`** to the spec's "Seed" section:
  - Delete in this order: `review`, `payment`, `booking`, `ratePeriod`, `roomTypeAmenity`, `roomTypeImage`, `room`, `roomType`, `hotelAmenity`, `hotelImage`, `hotelStaff`, `hotel`, `amenity`, `user`.
  - Users: `admin@booking.local` (ADMIN), `staff@booking.local` (STAFF, assigned to Riverside Bangkok), `customer@booking.local` (CUSTOMER), all with the password `Password123!` hashed via `hashPassword`. Log the password once at the end.
  - Hotels keep their current names, cities and descriptions. Each gets `slug: toSlug(name)`, an address and placeholder images `https://picsum.photos/seed/<slug>-<n>/800/600`.
  - Room types: Riverside Bangkok has Deluxe King (cap 2, 3200, rooms 101–104) and Family Suite (cap 4, 5800, rooms 201–202). Old Town Chiang Mai has Garden Twin (cap 2, 1900, rooms 1–3). Andaman Beach Resort has Pool Villa (cap 3, 9500, rooms V1–V2).
  - One `RatePeriod` on Deluxe King: `"Songkran"`, `2027-04-10` to `2027-04-17`, price 4500.
  - One `COMPLETED` booking for the customer: code `BKSEED01` on Deluxe King room 101, `2026-10-01` to `2026-10-03`, totalAmount 6400 THB, with a `SUCCEEDED` payment (provider `"seed"`, providerRef `"seed-payment-1"`) and a 5-star review. Set that hotel's `ratingAvg: 5` and `reviewCount: 1` in the same `prisma.$transaction`.
  - Create `Date` values for `@db.Date` fields as `new Date("YYYY-MM-DD")`.

- [ ] **Step 6: Run the seed twice**

Run: `npm run db:seed`, then `npm run db:seed` again
Expected: both runs exit 0 and print the seeded counts. The second run proves the delete order is correct.

- [ ] **Step 7: Full verification**

Run: `npm run lint && npm run typecheck && npm run build`, then the constraint script from Task 1 Step 2, then (inside `apps/api`) `npx tsx --test src/lib/*.test.ts`
Expected: all pass, `ALL CONSTRAINT CHECKS PASSED`, 9 tests pass

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/lib/password.ts apps/api/src/lib/password.test.ts apps/api/prisma/seed.ts
git commit -m "feat(db): password hashing helper and v1 seed data"
```
