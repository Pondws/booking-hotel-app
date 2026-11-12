# Roadmap — แอปจองโรงแรม

ลูกค้าจองห้องผ่าน `apps/web` ส่วน staff และ admin จัดการโรงแรม ห้อง ราคา และการจองผ่าน
`apps/web-admin` โดย `apps/api` เป็นตัวบังคับกฎทุกข้อ กฎของโปรเจกต์อยู่ใน `CLAUDE.md`
data model อยู่ใน `apps/api/prisma/schema.prisma` และเอกสารออกแบบอยู่ที่
`docs/superpowers/specs/2026-11-12-booking-schema-v1-design.md`

แต่ละ phase จบด้วยซอฟต์แวร์ที่ใช้งานได้จริง และทุกฟีเจอร์ทำตามลำดับใน CLAUDE.md:
schema → shared zod schema → service → controller → route (+ tests) → FE fetcher → TanStack Query
hook → UI พร้อม loading/error/empty states → lint, typecheck, test

## สถานะ

| Phase | หัวข้อ | สถานะ |
| --- | --- | --- |
| 0 | Monorepo + booking schema v1 | ✅ เสร็จแล้ว |
| 1 | API foundation | ⬜ ถัดไป |
| 2 | Auth และ roles | ⬜ |
| 3 | Catalog สาธารณะ + ห้องว่าง | ⬜ |
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

- [ ] สร้าง class `AppError(status, code, message)` ใน `apps/api/src/lib/`
- [ ] Global error handler ตอบกลับเป็น `{ "error": { "code", "message" } }` ให้ทุกกรณีต่อไปนี้:
  - `AppError`
  - zod (`VALIDATION_FAILED` พร้อมรายละเอียดราย field)
  - Prisma `P2002` (`CONFLICT`) และ `P2025` (`NOT_FOUND`)
  - 404 handler ใช้รูปแบบเดียวกัน
- [ ] Response ที่สำเร็จห่อเป็น `{ "data": ... }` และ `apiFetch` ของ FE ทั้งสองแอปต้องแกะ `data` ออก
      แล้ว throw error แบบมี type ตามรูปแบบ error ⚠️ เป็นการเปลี่ยน response shape ต้องถามก่อน
- [ ] สร้าง `controllers/` และ `services/` แล้วย้าย `routes/hotels.ts` ให้เป็น route → controller → service
- [ ] ย้ายการสร้างโรงแรมไปที่ `POST /api/admin/hotels` (ใส่ guard ใน Phase 2) ส่วน `GET /api/hotels`
      ยังเปิดสาธารณะ แต่คืนเฉพาะโรงแรมที่ `isActive`
- [ ] ถ้าสร้างโรงแรมแล้วชน `P2002` จาก slug race ให้ retry 1 ครั้ง
- [ ] Test ระดับ HTTP ของ routes (เช่น supertest) ⚠️ ต้องเพิ่ม dependency ต้องถามก่อน

**เสร็จเมื่อ:** ทุก route ตอบตามรูปแบบมาตรฐาน, route และ controller ไม่เรียก Prisma ตรง, และ lint/typecheck/test ผ่าน

## Phase 2 — Auth และ roles

เป้าหมาย: ลูกค้าสมัครและ login ได้, staff/admin login เข้า back-office ได้ และ API เป็นตัวบังคับ role

- [ ] **ต้องตัดสินใจ (ถามก่อน):** จะใช้ session cookie (มีตาราง `Session` ใน DB) หรือ JWT (access + refresh)
      ไม่ว่าแบบไหนต้องเป็น httpOnly, `SameSite=Lax` และ `Secure` บน production ทั้งสองแบบต้องทำ schema migration เพิ่ม
- [ ] Shared schemas: `registerSchema`, `loginSchema`, `meSchema` (ห้ามมี `passwordHash`)
- [ ] Endpoints:
  - `POST /api/auth/register` (ได้ role CUSTOMER เสมอ)
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- [ ] ตอน login ให้อ่าน hash ด้วย `omit: { passwordHash: false }` แล้วตรวจด้วย `verifyPassword`
      ถ้าไม่พบอีเมล หรือรหัสผ่านผิด ให้ตอบ error แบบเดียวกัน
- [ ] Middleware:
  - `requireAuth`
  - `requireRole('ADMIN','STAFF')` ครอบทุก route ใต้ `/api/admin/*`
  - `requireHotelAccess(hotelId)`: ADMIN เข้าได้ทุกโรงแรม ส่วน STAFF เข้าได้เฉพาะโรงแรมที่อยู่ใน `HotelStaff`
- [ ] จำกัดจำนวนครั้ง (rate limit) การลอง login
- [ ] web: หน้า register, login, logout, เมนูบัญชี และป้องกัน route `/account/*`
- [ ] web-admin: หน้า login, ปฏิเสธ CUSTOMER และทุกหน้าต้องเป็น STAFF/ADMIN

**เสร็จเมื่อ:**
- ลูกค้าเรียก `/api/admin/*` ไม่ได้เลย
- staff ของโรงแรม A แตะข้อมูลโรงแรม B ไม่ได้
- password hash ไม่โผล่ใน response ใดเลย

## Phase 3 — Catalog สาธารณะ + ห้องว่าง (web)

เป้าหมาย: ลูกค้าค้นหาโรงแรมและเห็นราคาจริงตามวันที่เลือก

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

- [ ] `POST /api/bookings/:code/review`
  - เฉพาะเจ้าของ, booking ต้องเป็น `COMPLETED` และรีวิวได้ booking ละครั้ง
  - `userId` และ `hotelId` ดึงจาก booking (ห้ามรับจาก request body)
  - คำนวณ `Hotel.ratingAvg` / `reviewCount` ใหม่ใน `$transaction` เดียวกัน
- [ ] `GET /api/hotels/:slug/reviews` แบบแบ่งหน้า
- [ ] web: ฟอร์มรีวิวในหน้าการจองที่เสร็จสิ้นแล้ว และส่วนรีวิวในหน้าโรงแรม
- [ ] Admin: ซ่อนรีวิวที่ไม่เหมาะสม (ต้องเพิ่ม field `isHidden` + migration) แล้วคำนวณคะแนนใหม่

## Phase 8 — Hardening และ deployment

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
| 1 | เปลี่ยน response shape เป็น `{ data }` / `{ error }` (กระทบ FE ทั้งสองแอป) | Phase 1 |
| 2 | เพิ่ม dependency สำหรับ HTTP tests (เช่น supertest) | Phase 1 |
| 3 | Session cookie หรือ JWT | Phase 2 |
| 4 | เวลา hold รอจ่ายเงิน (ค่าเริ่มต้น 15 นาที) และจำนวนคืนสูงสุด (ค่าเริ่มต้น 30 คืน) | Phase 4 |
| 5 | นโยบายยกเลิก (ยกเลิกฟรีก่อนเข้าพัก X วัน? คืนเงินบางส่วน?) | Phase 4–5 |
| 6 | Payment gateway จริง | Phase 5 |
| 7 | เวลา check-in/check-out ของโรงแรม (ต้องเพิ่ม field ใน `Hotel`) | Phase 6 |
| 8 | ผู้ให้บริการเก็บรูปและส่งอีเมล | Phase 8 |

## ช่องโหว่ที่ค้างมาจาก schema v1

- `POST /api/hotels` ยังไม่เช็คสิทธิ์ และไม่ได้อยู่ใต้ `/api/admin` → Phase 1–2
- routes เรียก Prisma ตรงและคืน JSON แบบไม่ห่อ → Phase 1
- ถ้าสร้างโรงแรมชื่อซ้ำพร้อมกัน slug race จะตอบ 500 → Phase 1
- `Review.userId` / `hotelId` ซ้ำกับข้อมูลใน booking ดังนั้น service ต้องดึงค่าจาก booking เอง → Phase 7
- DB ไม่ได้ตรวจ scope ของ amenity (HOTEL/ROOM) ดังนั้น service ต้องตรวจเอง → Phase 6
