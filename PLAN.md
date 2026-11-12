# Roadmap — แอปจองโรงแรม

ลูกค้าจองห้องผ่าน `apps/web` ส่วน staff และ admin จัดการโรงแรม ห้อง ราคา และการจองผ่าน
`apps/web-admin` โดย `apps/api` เป็นตัวบังคับกฎทุกข้อ กฎของโปรเจกต์อยู่ใน `CLAUDE.md`
data model อยู่ใน `apps/api/prisma/schema.prisma` และเอกสารออกแบบอยู่ที่
`docs/superpowers/specs/2026-11-12-booking-schema-v1-design.md`

แต่ละ phase จบด้วยซอฟต์แวร์ที่ใช้งานได้จริง และทุกฟีเจอร์ทำตามลำดับใน CLAUDE.md:
schema → shared zod schema → service → controller → route (+ tests) → FE fetcher → TanStack Query
hook → UI พร้อม loading/error/empty states → lint, typecheck, test

## การใช้ Skills

**Skill ประจำทุก phase (ลำดับการทำงาน)**
1. `superpowers:brainstorming`: ตกลง scope และ design ของ phase แล้วเขียน spec ลง `docs/superpowers/specs/`
2. `superpowers:writing-plans`: เขียนแผนลง `docs/superpowers/plans/`
3. `superpowers:subagent-driven-development` หรือ `superpowers:executing-plans`: ลงมือทำตามแผน
4. `superpowers:test-driven-development`: เขียน test ก่อนโค้ดทุก service และ endpoint
5. `superpowers:verification-before-completion`: ก่อนบอกว่าเสร็จ ต้องรัน lint, typecheck, `npm test` และ `npm run db:check` ให้เห็นผลจริง
6. `superpowers:requesting-code-review`: review ทั้ง branch ก่อน merge
7. `superpowers:finishing-a-development-branch`: เลือก merge / PR / keep

ถ้าเจอ bug หรือ test ล้ม ให้ใช้ `superpowers:systematic-debugging` ก่อนลงมือแก้

**Skill ของโปรเจกต์ (`.claude/skills/`)**

| Skill | ใช้เมื่อ |
| --- | --- |
| `prisma-cli` | สร้างหรือ apply migration, `generate`, `migrate status/diff` (รวมกรณีที่ shell เป็นแบบ non-interactive) |
| `prisma-client-api` | เขียน query ใน service: filter, relations, `$transaction`, `omit`/`select` และจัดการ Prisma error |
| `prisma-orm-setup` | แก้ปัญหาการเชื่อมต่อ DB หรือตั้งค่า DB ของ environment ใหม่ |
| `shadcn` | เพิ่มหรือประกอบ UI components ใน `packages/ui` (ใช้คู่กับ `npm run ui:add`) |
| `tanstack-query-best-practices` | สร้าง query key factory, hooks, mutations, invalidation, prefetch และการจัดการ error/loading |
| `impeccable` | ออกแบบหรือขัดเกลา UI: `DESIGN.md`, audit, polish, responsive, a11y, empty/error states |
| `next-dev-loop` | ตรวจว่าหน้าเว็บทำงานจริงใน `next dev` ไม่ใช่แค่ compile ผ่าน |
| `dataviz` | กราฟและ stat tiles บน dashboard |
| `next-bundle-optimizer` | ลดขนาด client bundle และ initial load |
| `next-cache-components-adoption` → `next-cache-components-optimizer` | เปิดใช้ Cache Components แล้วปรับให้ส่วนสำคัญของหน้าแสดงได้ทันที |
| `next-partial-prefetching-adoption` → `next-partial-prefetching-optimizer` | เปิดใช้ Partial Prefetching เพื่อให้การเปลี่ยนหน้าเร็วขึ้น |
| `security-review` | ตรวจความปลอดภัยของ branch ก่อน merge งาน auth และ payment |

## สถานะ

| Phase | หัวข้อ | สถานะ |
| --- | --- | --- |
| 0 | Monorepo + booking schema v1 | ✅ เสร็จแล้ว |
| 1 | API foundation | ✅ เสร็จแล้ว |
| 2 | Auth และ roles | ✅ เสร็จแล้ว |
| 3 | Catalog สาธารณะ + ห้องว่าง | ⬜ ถัดไป |
| 4 | Booking flow | ⬜ |
| 5 | Payments (เริ่มจาก mock provider) | ⬜ |
| 6 | Back-office (web-admin) | ⬜ |
| 7 | Reviews | ⬜ |
| 8 | Hardening และ deployment | ⬜ |

---

## Phase 0 — Foundation ✅

- npm workspaces monorepo: `web` (3000), `web-admin` (3001), `api` (8000), `packages/ui`, `packages/shared`
- PostgreSQL 18 รันบน Docker (port 5433) และใช้ Prisma 7 กับ PrismaPg adapter
- Schema v1 มี 14 models:
  - `User` (role CUSTOMER/STAFF/ADMIN), `HotelStaff`
  - `Hotel`, `HotelImage`, `Amenity`, `HotelAmenity`
  - `RoomType`, `RoomTypeImage`, `RoomTypeAmenity`, `Room`, `RatePeriod`
  - `Booking`, `Payment`, `Review`
- ตัวกันระดับ DB:
  - `bookings_no_overlap`: booking ที่เป็น PENDING/CONFIRMED บนห้องเดียวกันมีคืนทับกันไม่ได้
  - `rate_periods_no_overlap`: ช่วงราคาของ room type เดียวกันทับกันไม่ได้
  - CHECK constraints สำหรับวันที่ จำนวนแขก และคะแนนรีวิว
- `hashPassword` / `verifyPassword` (scrypt), global `omit` ของ `User.passwordHash` และ seed ที่รันซ้ำได้
- คำสั่ง `npm test` (node:test ผ่าน tsx) และ `npm run db:check` (สคริปต์ตรวจ constraint)

## Phase 1 — API foundation

เป้าหมาย: ปรับ API ให้ตรงกับกฎ backend ใน CLAUDE.md ก่อนเริ่มสร้างฟีเจอร์

**Skills:**
- `prisma-client-api`: ย้าย query ไปไว้ใน service และ map error `P2002`/`P2025`
- `tanstack-query-best-practices`: ปรับ `apiFetch` และ hooks ให้รับ error shape ใหม่
- `next-dev-loop`: ตรวจว่าทั้ง web และ web-admin ยังโหลดรายการโรงแรมได้หลังเปลี่ยน response shape

- [x] สร้าง class `AppError(status, code, message)` ใน `apps/api/src/lib/`
- [x] Global error handler ตอบกลับเป็น `{ "error": { "code", "message" } }` ให้ทุกกรณีต่อไปนี้:
  - `AppError`
  - zod (`VALIDATION_FAILED` พร้อมรายละเอียดราย field)
  - Prisma `P2002` (`CONFLICT`) และ `P2025` (`NOT_FOUND`)
  - 404 handler ใช้รูปแบบเดียวกัน
- [x] Response ที่สำเร็จห่อเป็น `{ "data": ... }` และ `request()` ใน `lib/api.ts` (axios) ของ FE ทั้งสองแอปต้องแกะ `data` ออก
      แล้ว throw error แบบมี type ตามรูปแบบ error ⚠️ เป็นการเปลี่ยน response shape ต้องถามก่อน
- [x] สร้าง `controllers/` และ `services/` แล้วย้าย `routes/hotels.ts` ให้เป็น route → controller → service
- [x] ย้ายการสร้างโรงแรมไปที่ `POST /api/admin/hotels` (ใส่ guard ใน Phase 2) ส่วน `GET /api/hotels`
      ยังเปิดสาธารณะ แต่คืนเฉพาะโรงแรมที่ `isActive`
- [x] ถ้าสร้างโรงแรมแล้วชน `P2002` จาก slug race ให้ retry 1 ครั้ง
- [x] Test ระดับ HTTP ของ routes (เช่น supertest) ⚠️ ต้องเพิ่ม dependency ต้องถามก่อน

**เสร็จเมื่อ:** ทุก route ตอบตามรูปแบบมาตรฐาน, route และ controller ไม่เรียก Prisma ตรง, และ lint/typecheck/test ผ่าน

## Phase 2 — Auth และ roles

เป้าหมาย: ลูกค้าสมัครและ login ได้, staff/admin login เข้า back-office ได้ และ API เป็นตัวบังคับ role

**Skills:**
- `prisma-cli`: migration ของตาราง session (ถ้าเลือกใช้)
- `prisma-client-api`: ใช้ `omit: { passwordHash: false }` เฉพาะตอน login
- `shadcn`: ฟอร์ม login/register
- `tanstack-query-best-practices`: query `me` และ invalidate หลัง login/logout
- `impeccable`: หน้า auth ของทั้งสองแอป
- `next-dev-loop`: ตรวจ redirect และการป้องกัน route
- `security-review`: ตรวจก่อน merge (บังคับ)

- [x] **ต้องตัดสินใจ (ถามก่อน):** จะใช้ session cookie (มีตาราง `Session` ใน DB) หรือ JWT (access + refresh)
      ไม่ว่าแบบไหนต้องเป็น httpOnly, `SameSite=Lax` และ `Secure` บน production ทั้งสองแบบต้องทำ schema migration เพิ่ม
- [x] Shared schemas: `registerSchema`, `loginSchema`, `meSchema` (ห้ามมี `passwordHash`) — ใช้ชื่อ `publicUserSchema` แทน `meSchema`
- [x] Endpoints:
  - `POST /api/auth/register` (ได้ role CUSTOMER เสมอ)
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- [x] ตอน login ให้อ่าน hash ด้วย `omit: { passwordHash: false }` แล้วตรวจด้วย `verifyPassword`
      ถ้าไม่พบอีเมล หรือรหัสผ่านผิด ให้ตอบ error แบบเดียวกัน
- [x] Middleware:
  - `requireAuth`
  - `requireRole('ADMIN','STAFF')` ครอบทุก route ใต้ `/api/admin/*`
  - `requireHotelAccess(hotelId)`: ADMIN เข้าได้ทุกโรงแรม ส่วน STAFF เข้าได้เฉพาะโรงแรมที่อยู่ใน `HotelStaff`
- [x] จำกัดจำนวนครั้ง (rate limit) การลอง login — ทำแบบต่อ IP แล้ว (ต่อบัญชียังไม่ทำ)
- [x] web: หน้า register, login, logout, เมนูบัญชี และป้องกัน route `/account/*`
- [x] web-admin: หน้า login, ปฏิเสธ CUSTOMER และทุกหน้าต้องเป็น STAFF/ADMIN

**เสร็จเมื่อ:**
- ลูกค้าเรียก `/api/admin/*` ไม่ได้เลย
- staff ของโรงแรม A แตะข้อมูลโรงแรม B ไม่ได้
- password hash ไม่โผล่ใน response ใดเลย

## Phase 3 — Catalog สาธารณะ + ห้องว่าง (web)

เป้าหมาย: ลูกค้าค้นหาโรงแรมและเห็นราคาจริงตามวันที่เลือก

**Skills:**
- `impeccable`: ก่อนเริ่มทำ UI ให้สร้าง `DESIGN.md` (design tokens และทิศทาง UI ที่ใช้ร่วมกันทั้ง web และ web-admin) จากนั้นใช้ออกแบบหน้าค้นหาและหน้ารายละเอียด และรัน audit + polish ก่อนปิด phase
- `prisma-client-api`: query หาห้องว่างที่เช็คคืนทับกัน และ pagination
- `shadcn`: date range picker, cards, gallery
- `tanstack-query-best-practices`: key factory สำหรับการค้นหา, `placeholderData` ตอนเปลี่ยนหน้า, prefetch หน้ารายละเอียด
- `next-dev-loop`: ตรวจหน้าค้นหาและหน้ารายละเอียดในเบราว์เซอร์จริง

- [ ] `GET /api/hotels?city=&checkIn=&checkOut=&guests=&page=`
  - คืนโรงแรมที่ active พร้อมรูปปก, `ratingAvg`, `reviewCount` และราคาเริ่มต้น
  - ถ้าระบุวันที่ ให้คืนเฉพาะโรงแรมที่มี room type ว่าง
  - แบ่งหน้า (pagination)
- [ ] `GET /api/hotels/:slug`: รายละเอียดโรงแรม พร้อมรูป, amenities และ room types ที่ active (พร้อมรูปและ amenities ของแต่ละแบบ)
- [ ] Pricing service `quoteStay(roomTypeId, checkIn, checkOut)`
  - รวมราคาทีละคืน: ใช้ `RatePeriod.price` ถ้ามีช่วงราคาครอบคืนนั้น ไม่มีก็ใช้ `basePrice`
  - คืนค่าเป็น `{ nights, nightly[], total, currency }`
  - มี unit test รวมกรณีที่ช่วงเข้าพักคร่อมขอบของช่วงราคา
- [ ] Availability service: room type ถือว่าว่าง เมื่อมี `Room` ที่ active อย่างน้อย 1 ห้องที่ไม่มี booking PENDING/CONFIRMED คืนทับกัน
      booking ที่ PENDING แต่เลย `expiresAt` แล้วไม่นับ
- [ ] `GET /api/hotels/:slug/availability?checkIn=&checkOut=&guests=`: คืนสถานะว่าง/ไม่ว่าง พร้อมราคาของแต่ละ room type
      และตัด room type ที่ `capacity < guests` ออก
- [ ] web: แถบค้นหา (เมือง, วันที่, จำนวนแขก), หน้าผลค้นหา, หน้ารายละเอียดโรงแรมที่มีการ์ด room type พร้อมราคาจริง, ไอคอน amenities และแกลเลอรีรูป
- [ ] กฎวันที่: `checkIn` ต้องเป็นวันนี้หรือหลังจากนี้ และพักได้ไม่เกิน 30 คืน (ตัวเลขนี้ต้องยืนยัน)

## Phase 4 — Booking flow

เป้าหมาย: ลูกค้าที่ login แล้วจอง room type ได้ และจองซ้อนไม่ได้เด็ดขาด

**Skills:**
- `prisma-client-api`: `$transaction`, จับ error `23P01` แล้ว retry
- `superpowers:test-driven-development`: เขียน concurrency test ก่อนเขียน service
- `superpowers:systematic-debugging`: ถ้า concurrency test ล้มแบบไม่แน่นอน
- `shadcn`: ฟอร์มจอง (react-hook-form + zod)
- `tanstack-query-best-practices`: mutation, invalidate "การจองของฉัน" และ "ห้องว่าง" หลังจอง/ยกเลิก
- `impeccable`: ขั้นตอนการจองทั้ง flow
- `next-dev-loop`: ตรวจ flow จองตั้งแต่ต้นจนจบ

- [ ] `POST /api/bookings` รับ `createBookingSchema` (`roomTypeId`, วันที่, `guests` และข้อมูลแขกที่ไม่บังคับ)
      ทำทุกขั้นใน `$transaction` เดียว:
  1. เปลี่ยน booking PENDING ของ room type นี้ที่ `expiresAt < now()` ให้เป็น `EXPIRED`
  2. ตรวจว่า `guests ≤ capacity` และคำนวณราคาด้วย `quoteStay`
  3. หาห้องจริงที่ active และไม่มี booking active คืนทับกัน
  4. insert ลงห้องแรกที่ว่าง ถ้าเจอ `23P01` ให้ลองห้องถัดไป ถ้าไม่เหลือห้องเลย throw `409 ROOM_UNAVAILABLE`

  booking ที่สร้างได้:
  - status เป็น `PENDING` และ `expiresAt = now + 15 นาที` (เวลานี้ต้องยืนยัน)
  - มี `code` ไม่ซ้ำ รูปแบบ `BK` + 6 ตัวอักษร ถ้าชนให้สุ่มใหม่
  - `guestName` / `guestEmail` ใช้ค่าของ user ถ้าไม่ได้ส่งมา
- [ ] `GET /api/bookings/me` และ `GET /api/bookings/:code` (เฉพาะเจ้าของ)
- [ ] `POST /api/bookings/:code/cancel`
  - เฉพาะเจ้าของ booking
  - ยกเลิกได้ตอนที่เป็น PENDING/CONFIRMED และยังไม่ถึงวันเข้าพัก (นโยบายยกเลิกค่อยตัดสินใจทีหลัง)
  - บันทึก `cancelledAt`
- [ ] Concurrency test: ส่ง 2 คำขอจองพร้อมกันสำหรับห้องว่างห้องสุดท้าย ต้องสำเร็จเพียง 1 คำขอ
- [ ] เพิ่มกรณีใน `prisma/checks/constraints.sql`: booking ที่ EXPIRED และ COMPLETED ต้องไม่บล็อกห้อง
- [ ] web:
  - หน้าจอง (สรุปรายการ + ฟอร์มข้อมูลแขกด้วย react-hook-form + zod)
  - ตัวนับถอยหลัง "เหลือเวลาจองอีก"
  - หน้ายืนยัน, รายการ "การจองของฉัน" พร้อมหน้ารายละเอียด และปุ่มยกเลิก

## Phase 5 — Payments (เริ่มจาก mock provider)

เป้าหมาย: booking เป็น CONFIRMED ได้ก็ต่อเมื่อชำระเงินแล้วเท่านั้น

**Skills:**
- `prisma-client-api`: transaction ที่อัปเดต payment + booking พร้อมกัน และ idempotency ด้วย `providerRef`
- `tanstack-query-best-practices`: สถานะ mutation ระหว่างจ่ายเงิน และ refetch สถานะ booking
- `impeccable`: หน้าชำระเงินและหน้าผลลัพธ์ (รวมกรณีจ่ายไม่สำเร็จ)
- `security-review`: ตรวจก่อน merge (บังคับ โดยเฉพาะตอนต่อ gateway จริง)

- [ ] Interface `PaymentProvider` (`createCharge`, `refund`) พร้อม `MockProvider` ที่สลับให้สำเร็จหรือล้มเหลวได้ตอน dev
- [ ] `POST /api/bookings/:code/payments`
  - สร้าง `Payment` (PENDING) ตาม `totalAmount`
  - ถ้าสำเร็จ ทำใน transaction เดียว: `Payment` → SUCCEEDED (+ `paidAt`), `Booking` → CONFIRMED และล้าง `expiresAt`
  - จ่ายเงินให้ booking ที่ EXPIRED/CANCELLED → `409`
- [ ] Idempotency: `providerRef @unique` ทำให้ webhook/confirm ที่ซ้ำไม่มีผลอะไร
- [ ] ยกเลิก booking ที่ CONFIRMED แล้วจะคืนเงิน (`REFUNDED`) ตามนโยบายยกเลิก
- [ ] Background job (หรือเช็คตอนมี request) สำหรับยกเลิก hold ที่ไม่จ่ายเงิน
- [ ] ภายหลังค่อยต่อ gateway จริง (เช่น Omise หรือ Stripe สำหรับ THB) ⚠️ ต้องเพิ่ม dependency และ secret ต้องถามก่อน
      และเพิ่ม env vars ลง `.env.example`
- [ ] web มีขั้นตอนชำระเงินและหน้าผลลัพธ์ ส่วน admin เห็นสถานะการชำระเงินในหน้า booking

## Phase 6 — Back-office (web-admin)

เป้าหมาย: staff ดูแลโรงแรมของตัวเองได้ทุกวัน ส่วน admin จัดการได้ทุกอย่าง
ทุก endpoint อยู่ใต้ `/api/admin/*` และผ่าน guard ทั้ง role และ `requireHotelAccess`

**Skills:**
- `shadcn`: data table, dialog, form, calendar สำหรับ rate periods
- `tanstack-query-best-practices`: key factory ต่อ resource และ invalidate หลัง CRUD
- `impeccable`: back-office เป็นหน้าแบบ Operate ที่เน้นความแม่นยำและอ่านง่าย
- `dataviz`: กราฟ occupancy/รายได้ และ stat tiles บน dashboard
- `prisma-client-api`: query สำหรับ dashboard (aggregate, groupBy)
- `next-dev-loop`: ตรวจแต่ละหน้าจัดการ

- [ ] Hotels:
  - ดูรายการ, สร้าง, แก้ไข
  - ปิดใช้งานด้วย `isActive = false` (ไม่ลบจริง)
  - รูป (รายการ URL + ลำดับ)
  - amenities (เฉพาะ scope HOTEL)
- [ ] Room types:
  - CRUD และปิดใช้งาน
  - รูป
  - amenities (เฉพาะ scope ROOM โดยตรวจใน service)
- [ ] Rooms: เพิ่มห้อง, แก้เลขห้อง, ปิดใช้งาน
- [ ] Rate periods: มุมมองปฏิทินหรือรายการ, สร้าง/แก้ไข/ลบ และถ้าช่วงทับกันตอบ `409` (มาจาก `rate_periods_no_overlap`)
- [ ] Bookings:
  - กรองตามโรงแรม, สถานะ และวันที่
  - หน้ารายละเอียด
  - check-in และ check-out → `COMPLETED`
  - ยกเลิกพร้อมเหตุผล
  - ย้ายไปห้องอื่นใน room type เดียวกัน
- [ ] Staff (เฉพาะ ADMIN): สร้าง user STAFF และผูกกับโรงแรมหรือเอาออก
- [ ] Catalog amenities (เฉพาะ ADMIN)
- [ ] Dashboard: แขกเข้า/ออกวันนี้, อัตราการเข้าพัก และรายได้ตามช่วงวันที่

## Phase 7 — Reviews

**Skills:**
- `prisma-client-api`: transaction สร้างรีวิวและคำนวณคะแนนใหม่
- `prisma-cli`: migration เพิ่ม `isHidden`
- `shadcn`: ฟอร์มให้ดาว
- `tanstack-query-best-practices`: infinite/paginated reviews
- `impeccable`: ส่วนรีวิวในหน้าโรงแรม

- [ ] `POST /api/bookings/:code/review`
  - เฉพาะเจ้าของ, booking ต้องเป็น `COMPLETED` และรีวิวได้ booking ละครั้ง
  - `userId` และ `hotelId` ดึงจาก booking (ห้ามรับจาก request body)
  - คำนวณ `Hotel.ratingAvg` / `reviewCount` ใหม่ใน `$transaction` เดียวกัน
- [ ] `GET /api/hotels/:slug/reviews` แบบแบ่งหน้า
- [ ] web: ฟอร์มรีวิวในหน้าการจองที่เสร็จสิ้นแล้ว และส่วนรีวิวในหน้าโรงแรม
- [ ] Admin: ซ่อนรีวิวที่ไม่เหมาะสม (ต้องเพิ่ม field `isHidden` + migration) แล้วคำนวณคะแนนใหม่

## Phase 8 — Hardening และ deployment

**Skills:**
- `prisma-cli`: `migrate deploy` ใน CI และ migration สำหรับ CHECK constraints
- `prisma-orm-setup`: เชื่อมต่อ managed Postgres
- `security-review`: ตรวจทั้งระบบ
- `impeccable`: audit/harden ทุกหน้า (a11y, responsive, edge cases)
- performance ของ `apps/web`:
  - `next-bundle-optimizer`
  - `next-cache-components-adoption` → `next-cache-components-optimizer`
  - `next-partial-prefetching-adoption` → `next-partial-prefetching-optimizer`

- [ ] CI: lint, typecheck, test, build และ `prisma migrate deploy` + `db:check` บน Postgres ชั่วคราว
- [ ] DB CHECKs:
  - `base_price`, `price`, `total_amount`, `amount` ต้อง ≥ 0
  - `capacity` ต้อง ≥ 1
  - `currency` ต้องเป็นตัวอักษร 3 ตัว
- [ ] Seed ต้องไม่ยอมรันเมื่อ `NODE_ENV=production`
- [ ] Security headers, request logging, rate limiting และจำกัดขนาด input
- [ ] อัปโหลดรูปไป object storage แทน URL ตรง ⚠️ ต้องใช้ service/dependency ใหม่ ต้องถามก่อน
- [ ] อีเมลแจ้งเตือนเมื่อยืนยันหรือยกเลิกการจอง ⚠️ ต้องใช้ service ใหม่ ต้องถามก่อน
- [ ] Deployment:
  - Docker image ของ api
  - hosting สำหรับ web และ web-admin
  - managed Postgres ที่รองรับ `btree_gist`
- [ ] (ไม่บังคับ) i18n ไทย/อังกฤษสำหรับ `apps/web`

---

## เรื่องที่ต้องตัดสินใจ

| # | เรื่อง | ต้องรู้ก่อน |
| --- | --- | --- |
| 1 | เปลี่ยน response shape เป็น `{ data }` / `{ error }` (กระทบ FE ทั้งสองแอป) | Phase 1 — ✅ ตัดสินแล้ว: ใช้ { data }/{ error } ทุก endpoint + axios |
| 2 | เพิ่ม dependency สำหรับ HTTP tests (เช่น supertest) | Phase 1 — ✅ ตัดสินแล้ว: supertest |
| 3 | Session cookie หรือ JWT | Phase 2 — ✅ ตัดสินแล้ว: session cookie + ตาราง Session (แยก sid / admin_sid) |
| 4 | เวลา hold รอจ่ายเงิน (ค่าเริ่มต้น 15 นาที) และจำนวนคืนสูงสุด (ค่าเริ่มต้น 30 คืน) | Phase 4 |
| 5 | นโยบายยกเลิก (ยกเลิกฟรีก่อนเข้าพัก X วัน? คืนเงินบางส่วน?) | Phase 4–5 |
| 6 | Payment gateway จริง | Phase 5 |
| 7 | เวลา check-in/check-out ของโรงแรม (ต้องเพิ่ม field ใน `Hotel`) | Phase 6 |
| 8 | ผู้ให้บริการเก็บรูปและส่งอีเมล | Phase 8 |

## ช่องโหว่ที่ค้างมาจาก schema v1

- `Review.userId` / `hotelId` ซ้ำกับข้อมูลใน booking ดังนั้น service ต้องดึงค่าจาก booking เอง → Phase 7
- DB ไม่ได้ตรวจ scope ของ amenity (HOTEL/ROOM) ดังนั้น service ต้องตรวจเอง → Phase 6
- CORS origin เดียวกันทุก route — ควรแยก WEB_ORIGINS / ADMIN_ORIGINS → ก่อน Phase 6
- Expired sessions ถูกลบเมื่อมีคนใช้เท่านั้น — ต้องมี job ลบ → Phase 8
