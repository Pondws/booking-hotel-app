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
| 3 | Catalog สาธารณะ + ห้องว่าง | ✅ เสร็จแล้ว |
| 4 | Booking flow | ✅ เสร็จแล้ว |
| 5 | Payments (Stripe, test mode) | ✅ เสร็จแล้ว (ยังไม่ได้ทดสอบ Stripe จริงในเบราว์เซอร์) |
| 6 | Back-office (web-admin) | ✅ เสร็จแล้ว (6.1–6.7) |
| 7 | Reviews | 🟡 กำลังทำ (7.1–7.4) |
| 8 | บัญชีผู้ใช้ + ความปลอดภัยของ staff | 🟡 8.1–8.5 ทำแล้ว (branch `feat/account-security`) รอ security-review + ตรวจในเบราว์เซอร์; ลืมรหัสผ่าน → Phase 10 |
| 9 | ตรวจและแก้ UI ทั้งหมด | 🟡 9.0 (redesign web + ภาษาไทย) ทำแล้ว รอตรวจในเบราว์เซอร์ |
| 10 | Hardening และ deployment | ⬜ |
| 11 | ฟีเจอร์ลูกค้าเพิ่มเติม (ref: Booking.com, Airbnb, Expedia) | ⬜ มีหน้า placeholder แล้ว |

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

## Phase 3 — Catalog สาธารณะ + ห้องว่าง (web) ✅

เป้าหมาย: ลูกค้าค้นหาโรงแรมและเห็นราคาจริงตามวันที่เลือก

**Skills:**
- `impeccable`: ก่อนเริ่มทำ UI ให้สร้าง `DESIGN.md` (design tokens และทิศทาง UI ที่ใช้ร่วมกันทั้ง web และ web-admin) จากนั้นใช้ออกแบบหน้าค้นหาและหน้ารายละเอียด และรัน audit + polish ก่อนปิด phase
- `prisma-client-api`: query หาห้องว่างที่เช็คคืนทับกัน และ pagination
- `shadcn`: date range picker, cards, gallery
- `tanstack-query-best-practices`: key factory สำหรับการค้นหา, `placeholderData` ตอนเปลี่ยนหน้า, prefetch หน้ารายละเอียด
- `next-dev-loop`: ตรวจหน้าค้นหาและหน้ารายละเอียดในเบราว์เซอร์จริง

- [x] `GET /api/hotels?city=&checkIn=&checkOut=&guests=&page=`
  - คืนโรงแรมที่ active พร้อมรูปปก, `ratingAvg`, `reviewCount` และราคาเริ่มต้น
  - ถ้าระบุวันที่ ให้คืนเฉพาะโรงแรมที่มี room type ว่าง
  - แบ่งหน้า (pagination)
- [x] `GET /api/hotels/:slug`: รายละเอียดโรงแรม พร้อมรูป, amenities และ room types ที่ active (พร้อมรูปและ amenities ของแต่ละแบบ)
- [x] Pricing service `quoteStay(roomTypeId, checkIn, checkOut)`
  - รวมราคาทีละคืน: ใช้ `RatePeriod.price` ถ้ามีช่วงราคาครอบคืนนั้น ไม่มีก็ใช้ `basePrice`
  - คืนค่าเป็น `{ nights, nightly[], total, currency }`
  - มี unit test รวมกรณีที่ช่วงเข้าพักคร่อมขอบของช่วงราคา
- [x] Availability service: room type ถือว่าว่าง เมื่อมี `Room` ที่ active อย่างน้อย 1 ห้องที่ไม่มี booking PENDING/CONFIRMED คืนทับกัน
      booking ที่ PENDING แต่เลย `expiresAt` แล้วไม่นับ
- [x] `GET /api/hotels/:slug/availability?checkIn=&checkOut=&guests=`: คืนสถานะว่าง/ไม่ว่าง พร้อมราคาของแต่ละ room type
      และตัด room type ที่ `capacity < guests` ออก
- [x] web: แถบค้นหา (เมือง, วันที่, จำนวนแขก), หน้าผลค้นหา, หน้ารายละเอียดโรงแรมที่มีการ์ด room type พร้อมราคาจริง, ไอคอน amenities และแกลเลอรีรูป
- [x] กฎวันที่: `checkIn` ต้องเป็นวันนี้หรือหลังจากนี้ และพักได้ไม่เกิน 30 คืน (ยืนยันแล้ว: `MAX_NIGHTS = 30`, "วันนี้" นับตามเวลา Asia/Bangkok)

## Phase 4 — Booking flow ✅

เป้าหมาย: ลูกค้าที่ login แล้วจอง room type ได้ และจองซ้อนไม่ได้เด็ดขาด

**Skills:**
- `prisma-client-api`: `$transaction`, จับ error `23P01` แล้ว retry
- `superpowers:test-driven-development`: เขียน concurrency test ก่อนเขียน service
- `superpowers:systematic-debugging`: ถ้า concurrency test ล้มแบบไม่แน่นอน
- `shadcn`: ฟอร์มจอง (react-hook-form + zod)
- `tanstack-query-best-practices`: mutation, invalidate "การจองของฉัน" และ "ห้องว่าง" หลังจอง/ยกเลิก
- `impeccable`: ขั้นตอนการจองทั้ง flow
- `next-dev-loop`: ตรวจ flow จองตั้งแต่ต้นจนจบ

- [x] `POST /api/bookings` รับ `createBookingSchema` (`roomTypeId`, วันที่, `guests` และข้อมูลแขกที่ไม่บังคับ)
      ไม่ใช้ `$transaction` ครอบ — แต่ละ insert เป็นคำสั่งเดียว และให้ DB exclusion constraint `bookings_no_overlap` ตัดสิน (Postgres จะ abort transaction ทันทีที่เกิด error แรก ทำให้ retry ห้องถัดไปไม่ได้):
  1. เปลี่ยน booking PENDING ของ room type นี้ที่ `expiresAt < now()` ให้เป็น `EXPIRED`
  2. ตรวจว่า `guests ≤ capacity` และคำนวณราคาด้วย `quoteStay`
  3. หาห้องจริงที่ active และไม่มี booking active คืนทับกัน
  4. insert ลงห้องแรกที่ว่าง ถ้าเจอ `23P01` ให้ลองห้องถัดไป ถ้าไม่เหลือห้องเลย throw `409 ROOM_UNAVAILABLE`

  booking ที่สร้างได้:
  - status เป็น `PENDING` และ `expiresAt = now + 15 นาที` (ยืนยันแล้ว: `HOLD_MINUTES = 15`)
  - มี `code` ไม่ซ้ำ รูปแบบ `BK` + 6 ตัวอักษร ถ้าชนให้สุ่มใหม่
  - `guestName` / `guestEmail` ใช้ค่าของ user ถ้าไม่ได้ส่งมา
- [x] `GET /api/bookings/me` และ `GET /api/bookings/:code` (เฉพาะเจ้าของ)
- [x] `POST /api/bookings/:code/cancel`
  - เฉพาะเจ้าของ booking
  - ยกเลิกได้ตอนที่เป็น PENDING/CONFIRMED และยังไม่ถึงวันเข้าพัก (ยืนยันแล้ว: ยกเลิกได้ก่อนวัน check-in; การคืนเงินรอ Phase 5)
  - บันทึก `cancelledAt`
- [x] Concurrency test: ส่ง 2 คำขอจองพร้อมกันสำหรับห้องว่างห้องสุดท้าย ต้องสำเร็จเพียง 1 คำขอ
- [x] เพิ่มกรณีใน `prisma/checks/constraints.sql`: booking ที่ EXPIRED และ COMPLETED ต้องไม่บล็อกห้อง
- [x] web:
  - หน้าจอง (สรุปรายการ + ฟอร์มข้อมูลแขกด้วย react-hook-form + zod)
  - ตัวนับถอยหลัง "เหลือเวลาจองอีก"
  - หน้ายืนยัน, รายการ "การจองของฉัน" พร้อมหน้ารายละเอียด และปุ่มยกเลิก

## Phase 5 — Payments (Stripe Payment Element, test mode) ✅

เป้าหมาย: booking เป็น CONFIRMED ได้ก็ต่อเมื่อชำระเงินแล้วเท่านั้น
Spec: `docs/superpowers/specs/2026-11-15-payments-design.md` · Plan: `docs/superpowers/plans/2026-11-15-payments.md`

**Skills:**
- `prisma-client-api`: transaction ที่อัปเดต payment + booking พร้อมกัน และ idempotency ด้วย `providerRef`
- `tanstack-query-best-practices`: สถานะ mutation ระหว่างจ่ายเงิน และ refetch สถานะ booking
- `impeccable`: หน้าชำระเงินและหน้าผลลัพธ์ (รวมกรณีจ่ายไม่สำเร็จ)
- `security-review`: ตรวจก่อน merge (บังคับ โดยเฉพาะตอนต่อ gateway จริง)

- [x] Interface `PaymentProvider` (`createIntent`, `getIntent`, `cancelIntent`, `refund`, `parseWebhook`) —
      `StripeProvider` (dev/prod) และ `MockProvider` (`npm test`, dev ที่ยังไม่มี key; ห้ามใช้ใน production)
- [x] `POST /api/bookings/:code/payments` สร้างหรือใช้ PaymentIntent เดิม (บัตรเท่านั้น) ตาม `totalAmount` → `{ clientSecret }`;
      booking ที่จ่ายไม่ได้ (EXPIRED/CANCELLED/CONFIRMED) → `409`
- [x] Webhook `POST /api/webhooks/stripe` (raw body + ตรวจลายเซ็น) และ `POST /api/bookings/:code/payments/sync`
      → `settlePayment` ที่เดียวที่ย้าย payment ออกจาก PENDING: SUCCEEDED + booking CONFIRMED ใน transaction เดียว
- [x] Idempotency: claim payment row ก่อน, partial unique index `payments_one_active_per_booking`,
      idempotency key ฝั่ง Stripe — webhook ซ้ำ / sync + webhook พร้อมกันไม่จ่ายซ้ำ
- [x] จ่ายสำเร็จหลัง hold หมดเวลา → คืนเงินอัตโนมัติ, booking ไม่ถูกยืนยัน
- [x] ยกเลิก booking ที่จ่ายแล้ว → คืนเงินเต็มจำนวน (`REFUNDED` + `refundedAt`); hold ที่ยังไม่จ่าย → ยกเลิก intent
- [x] Hold ที่ไม่จ่ายเงิน: ยังใช้ lazy expiry ตอนมี request (Phase 4) ไม่มี background job
- [x] web: การ์ดชำระเงิน (Payment Element) ในหน้ารายละเอียด, สถานะ "Paid on" / "Refunded on",
      ข้อความคืนเงินใน dialog ยกเลิก; ไม่มี publishable key → "Payments aren't configured"
- [ ] ยังไม่ได้ทดสอบ Stripe จริงในเบราว์เซอร์ (4242 สำเร็จ, 4000 0000 0000 0002 ถูกปฏิเสธ, 4000 0027 6000 3184 3-D Secure)
      — รอใส่ test keys (`pk_test` / `sk_test` / `whsec`)
- → "admin เห็นสถานะการชำระเงินในหน้า booking" ย้ายไป Phase 6

## Phase 6 — Back-office (web-admin) ✅

เป้าหมาย: staff ดูแลโรงแรมของตัวเองได้ทุกวัน ส่วน admin จัดการได้ทุกอย่าง
ทุก endpoint อยู่ใต้ `/api/admin/*` และผ่าน guard ทั้ง role และ `requireHotelAccess`

**Skills:**
- `shadcn`: data table, dialog, form, calendar สำหรับ rate periods
- `tanstack-query-best-practices`: key factory ต่อ resource และ invalidate หลัง CRUD
- `impeccable`: back-office เป็นหน้าแบบ Operate ที่เน้นความแม่นยำและอ่านง่าย
- `dataviz`: กราฟ occupancy/รายได้ และ stat tiles บน dashboard
- `prisma-client-api`: query สำหรับ dashboard (aggregate, groupBy)
- `next-dev-loop`: ตรวจแต่ละหน้าจัดการ

Phase 6 แบ่งเป็นงานย่อย แต่ละงานมี spec, plan, branch และ PR ของตัวเอง ทำตามลำดับนี้
(6.4 ต้องใช้ room type/ห้องจาก 6.2, 6.6 ใช้ข้อมูลจากทุกงาน, 6.5 ไม่ขึ้นกับงานอื่น, 6.7 บันทึกการเขียนของทุกงาน)

| # | งาน | Branch | สถานะ |
| --- | --- | --- | --- |
| 6.1 | Admin shell + Hotels | `feat/admin-hotels` | ✅ |
| 6.2 | Room types + Rooms | `feat/admin-room-types` | ✅ |
| 6.3 | Rate periods | `feat/admin-rate-periods` | ✅ |
| 6.4 | Bookings | `feat/admin-bookings` | ✅ |
| 6.5 | Staff + Amenity catalog (เฉพาะ ADMIN) | `feat/admin-staff` | ✅ |
| 6.6 | Dashboard | `feat/admin-dashboard` | ✅ (รอ merge) |
| 6.7 | Audit log (ประวัติการแก้ไข) | `feat/admin-audit-log` | ✅ (รอ merge) |

### 6.1 — Admin shell + Hotels
- [x] Layout และเมนูข้างของ web-admin
- [x] `GET /api/admin/hotels`: staff เห็นเฉพาะโรงแรมที่ตัวเองดูแล ส่วน admin เห็นทุกโรงแรม (รวมที่ปิดใช้งาน)
- [x] Hotels:
  - ดูรายการ, หน้ารายละเอียด, สร้าง, แก้ไข
  - ปิดใช้งานด้วย `isActive = false` (ไม่ลบจริง)
  - รูป (รายการ URL + ลำดับ)
  - amenities (เฉพาะ scope HOTEL โดยตรวจใน service)
- [x] เรื่องที่ต้องตัดสินใจ #7: เวลา check-in/check-out ของโรงแรม

### 6.2 — Room types + Rooms
- [x] Room types (ADMIN + STAFF ที่ดูแลโรงแรม; ลบได้เฉพาะตอนยังไม่มีห้อง/rate period):
  - CRUD และปิดใช้งาน
  - รูป
  - amenities (เฉพาะ scope ROOM โดยตรวจใน service)
- [x] Rooms: เพิ่มห้อง, แก้เลขห้อง, ปิดใช้งาน (เลขห้องไม่ซ้ำภายในโรงแรม)
- [x] ตรวจในเบราว์เซอร์แล้ว (2026-11-15): สร้าง/แก้ไข/ปิดใช้งาน room type, เพิ่ม/เปลี่ยนเลข/ปิดใช้งานห้อง, เลขห้องซ้ำแสดง error

### 6.3 — Rate periods
Spec: `docs/superpowers/specs/2026-11-15-admin-rate-periods-design.md`
- [x] มุมมองรายการ (การ์ด Rates ในหน้า room type), สร้าง/แก้ไข/ลบ และถ้าช่วงทับกันตอบ `409`
      (service ตรวจก่อนเพื่อบอกช่วงที่ทับ, `rate_periods_no_overlap` เป็น backstop ตอนเขียนพร้อมกัน)
- [x] ตรวจในเบราว์เซอร์แล้ว (2026-11-15): สร้าง/แก้ไข/ลบ, ช่วงทับกันได้ 409 ทั้งตอนสร้างและแก้ไข, ช่วงที่ต่อกันพอดีบันทึกได้

### 6.4 — Bookings
Spec: `docs/superpowers/specs/2026-11-15-admin-bookings-design.md`
- [x] กรองตามโรงแรม, สถานะ (รวม "เข้าพักอยู่"), ช่วงวันที่ และค้นหารหัส/ชื่อ/อีเมล
- [x] หน้ารายละเอียด พร้อมสถานะการชำระเงิน (`payment.status`, `paidAt`, `refundedAt`) และเตือนเมื่อคืนเงินไม่สำเร็จ
- [x] check-in และ check-out → `COMPLETED` (เพิ่ม `checkedInAt`/`checkedOutAt`; ไม่เพิ่มสถานะ `CHECKED_IN` —
      "เข้าพักอยู่" = `CONFIRMED` + `checkedInAt` เพื่อไม่ต้องแก้ `bookings_no_overlap`)
- [x] ยกเลิกพร้อมเหตุผล (`cancelReason`) และคืนเงินเต็มจำนวนผ่าน `payment.service` `releaseBookingPayment`
- [x] ย้ายไปห้องอื่นใน room type เดียวกัน (ห้องไม่ว่าง → `409 ROOM_UNAVAILABLE`)
- [x] ตรวจในเบราว์เซอร์แล้ว (2026-11-15): ค้นหา/กรองสถานะ/กรองวันที่, ย้ายห้อง, เช็คอิน → เช็คเอาท์,
      ยกเลิก (เหตุผลว่างแสดง error, การจองที่ชำระแล้วคืนเงินเต็มจำนวน), หน้าไม่พบการจอง

### 6.5 — Staff + Amenity catalog (เฉพาะ ADMIN)
Spec: `docs/superpowers/specs/2026-11-15-admin-staff-design.md`
- [x] Staff: สร้าง user STAFF (อีเมลซ้ำ → `409`), แก้ชื่อ/เบอร์โทร, ผูกกับโรงแรมหรือเอาออก (มีผลใน request ถัดไป)
- [x] Catalog amenities: CRUD (scope แก้ไม่ได้หลังสร้าง, รหัสซ้ำ → `409`, ลบได้แม้ใช้อยู่ — dialog แสดงจำนวนที่ใช้)
- [x] ตรวจในเบราว์เซอร์แล้ว (2026-11-15): สร้างพนักงาน (อีเมลซ้ำแสดง error), เพิ่ม/เอาโรงแรมออก,
      เพิ่ม/แก้/ลบสิ่งอำนวยความสะดวก (รหัสซ้ำแสดง error, dialog ลบบอกจำนวนที่ใช้), STAFF ไม่เห็นเมนูและเปิดหน้าไม่ได้

### 6.6 — Dashboard
Spec: `docs/superpowers/specs/2026-11-15-admin-dashboard-design.md`
- [x] แขกเข้า/ออกวันนี้, อัตราการเข้าพัก และรายได้ตามช่วงวันที่ (stat tiles + กราฟ shadcn chart; รายได้นับตามคืนที่เข้าพัก)
- [x] ตรวจในเบราว์เซอร์แล้ว (2026-11-15): ADMIN ทุกโรงแรม/เลือกโรงแรม, STAFF เห็นเฉพาะโรงแรมของตัวเอง,
      URL ที่ผิด (ช่วงกลับด้าน/เกิน 92 คืน/วันที่ผิด) กลับไปค่าเริ่มต้น, เช็คอินแล้วตัวเลขบน dashboard อัปเดต, จอมือถือไม่ล้น

### 6.7 — Audit log (ประวัติการแก้ไข)
งานนี้เพิ่มเข้ามานอกแผนเดิม
- [x] ตาราง `AuditLog`: บันทึกการเขียนทุกครั้งใน back-office (CREATE/UPDATE/DELETE) ของ hotel, room type, room,
      rate period, amenity, staff และ booking พร้อม `changes` = `[{ field, before, after }]`
      (`entityId` ไม่มี FK เพื่อให้ประวัติอยู่ต่อหลังลบ entity, `entityLabel` = ชื่อ ณ ตอนนั้น)
- [x] `GET /api/admin/audit-logs`: STAFF เห็นเฉพาะแถวของโรงแรมตัวเอง (ผ่าน `hotelId`)
- [x] web-admin: แท็บ "ประวัติ" (activity timeline) ในทุกหน้าแก้ไข, หน้า amenity แยก และ layout เต็มความกว้าง

## Phase 7 — Reviews

**Skills:**
- `prisma-client-api`: transaction สร้างรีวิวและคำนวณคะแนนใหม่
- `prisma-cli`: migration เพิ่ม `isHidden`
- `shadcn`: ฟอร์มให้ดาว
- `tanstack-query-best-practices`: infinite/paginated reviews
- `impeccable`: ส่วนรีวิวในหน้าโรงแรม

แบ่งเป็น 4 งานย่อย งานละ 1 PR (รายละเอียดใน spec `docs/superpowers/specs/2026-11-16-reviews-design.md`)

### 7.1 — เขียนรีวิว (API)
- [x] Migration: `Review.isHidden` + `hiddenAt`, index `(hotelId, isHidden, createdAt)` (CHECK rating 1–5 มีอยู่แล้ว)
- [x] `POST /api/bookings/:code/review`
  - เฉพาะเจ้าของ, booking ต้องเป็น `COMPLETED` และรีวิวได้ booking ละครั้ง
  - `userId` และ `hotelId` ดึงจาก booking (ห้ามรับจาก request body)
  - คำนวณ `Hotel.ratingAvg` / `reviewCount` ใหม่ใน `$transaction` เดียวกัน (นับเฉพาะรีวิวที่ไม่ได้ซ่อน)
- [x] booking detail มี `reviewable` + `review`

### 7.2 — ฟอร์มรีวิว (web)
- [x] การ์ดให้ดาว + ความเห็นในหน้า `/account/bookings/[code]`; รีวิวแล้วแสดงแบบอ่านอย่างเดียว

### 7.3 — รีวิวในหน้าโรงแรม
- [x] `GET /api/hotels/:slug/reviews` แบบแบ่งหน้า (ไม่รวมรีวิวที่ซ่อน, แสดงแค่ชื่อต้น)
- [x] web: ส่วนรีวิวในหน้าโรงแรม (คะแนนเฉลี่ย + รายการ + "ดูเพิ่มเติม")

### 7.4 — ซ่อนรีวิว (Admin)
- [x] Migration: `AuditEntityType.REVIEW`
- [x] `GET /api/admin/reviews` + `PATCH /api/admin/reviews/:id { isHidden }` แล้วคำนวณคะแนนใหม่; STAFF เฉพาะโรงแรมตัวเอง; บันทึก audit log
- [x] web-admin: เมนู "รีวิว" ตาราง + ตัวกรองโรงแรม/สถานะ + ปุ่มซ่อน/แสดง

## Phase 8 — บัญชีผู้ใช้ + ความปลอดภัยของ staff

เป้าหมาย: ผู้ใช้ทุกคนดูแลบัญชีของตัวเองได้ และ admin เอา staff ที่ลาออกออกจากระบบได้ทันที
งานนี้เพิ่มเข้ามานอกแผนเดิม และต้องเสร็จก่อน deploy (Phase 10) ⚠️ แตะเรื่อง auth ต้องถามก่อนตาม CLAUDE.md (ตกลงใน spec ตอน brainstorming)

**Skills:**
- `prisma-cli`: migration เพิ่ม `User.isActive`
- `prisma-client-api`: ลบ session ทั้งหมดของ user ใน transaction เดียวกับการเปลี่ยนรหัสผ่าน/ปิดบัญชี
- `shadcn`: ฟอร์มโปรไฟล์และเปลี่ยนรหัสผ่าน
- `tanstack-query-best-practices`: อัปเดต `me` หลังแก้โปรไฟล์
- `security-review`: ตรวจก่อน merge (บังคับ)

- [x] แก้โปรไฟล์ของตัวเอง (ชื่อ, เบอร์โทร): web `/account/security`, web-admin `/account` (`PATCH /api/auth/me`, `/api/auth/admin/me`)
- [x] เปลี่ยนรหัสผ่านของตัวเอง: ต้องใส่รหัสเดิม, rate limit แบบเดียวกับ login และลบ session อื่นทั้งหมด (เก็บ session ปัจจุบันไว้)
- [x] ปิด/เปิดบัญชี staff (เฉพาะ ADMIN):
  - เพิ่ม `User.isActive`; บัญชีที่ปิดอยู่ login ไม่ได้ (ตอบ error เหมือนรหัสผิด) และ `loadSession` ไม่รับ session เดิม
  - ปิดแล้วลบ session ทั้งหมดของคนนั้นทันที
  - ADMIN ปิดบัญชีตัวเองไม่ได้ และบันทึกลง audit log
- [x] ADMIN รีเซ็ตรหัสผ่าน staff (ตั้งรหัสชั่วคราว) แล้วลบ session ทั้งหมดของคนนั้น
- [x] Rate limit ตอน login แบบต่อบัญชี: นับเฉพาะครั้งที่ผิดต่อ email (memory store — ทบทวนตอนมีหลาย instance ใน Phase 10)
- [ ] → ย้ายไป Phase 10 (ยังไม่มีผู้ให้บริการอีเมล) ลืมรหัสผ่าน (ลูกค้า): token ใช้ครั้งเดียว มีอายุ ส่งลิงก์ทางอีเมล
      ⚠️ ต้องมีผู้ให้บริการส่งอีเมล (เรื่องที่ต้องตัดสินใจ #8) ถ้ายังไม่ได้ตัดสินใจ ให้ย้ายไปทำคู่กับอีเมลแจ้งเตือนใน Phase 10

**เสร็จเมื่อ:**
- staff ที่ถูกปิดบัญชีเรียก `/api/admin/*` ไม่ได้ตั้งแต่ request ถัดไป
- เปลี่ยนหรือรีเซ็ตรหัสผ่านแล้ว session เก่าบนเครื่องอื่นใช้ไม่ได้
- password hash ยังไม่โผล่ใน response ใดเลย

## Phase 9 — ตรวจและแก้ UI ทั้งหมด

เป้าหมาย: ทุกหน้าของ `apps/web` และ `apps/web-admin` ตรงตาม `DESIGN.md` ใช้งานได้ทั้งบนมือถือและเดสก์ท็อป
และมี loading/error/empty states ครบ
Claude ตรวจและแก้เองทั้งหมด: เปิดทุกหน้าในเบราว์เซอร์จริง → จดปัญหา → แก้ → ตรวจซ้ำ
เป็น phase สุดท้ายก่อน deploy เพื่อตรวจทุกหน้ารอบเดียว รวม UI ของรีวิว (Phase 7) และหน้าบัญชี (Phase 8)

### 9.0 — Redesign `apps/web` + เปลี่ยนเป็นภาษาไทย (branch `feat/web-redesign`)

อ้างอิงเว็บจองโรงแรมชั้นนำ 3 เว็บ: **Booking.com** (แถบสีแบรนด์ + กล่องค้นหาซ้อนขอบ, ป้ายคะแนน + คำ, ตัวกรองด้านซ้าย,
ความเร่งด่วน "เหลือ x ห้อง"), **Airbnb** (ภาพเป็นพระเอก, การ์ดมุมโค้ง, mosaic รูปหน้าโรงแรม, กล่องสรุปติดข้าง),
**Expedia** (หน้าบัญชีแบบ hub, footer หลายคอลัมน์, banner สมาชิก/ดีล)

- [x] Theme ของ web: primary สีเขียวน้ำทะเลเข้ม (teal), `--radius` 0.75rem, ฟอนต์ Anuphan, container `max-w-6xl`
- [x] Header ติดบน (เมนูหลัก + รายการโปรด + บัญชี; มือถือมีแถบเมนูเลื่อนข้าง) และ footer 4 คอลัมน์
- [x] หน้าแรก: hero + กล่องค้นหา, จุดหมายยอดนิยม (สรุปจากโรงแรมที่มี), โรงแรมแนะนำ, banner ดีล, "ทำไมต้องจองกับเรา"
- [x] `/hotels`: แถบค้นหา + แผงตัวกรอง (placeholder) + หัวข้อตามเมือง; การ์ดโรงแรมแบบใหม่ (คะแนน + คำ + จำนวนรีวิว)
- [x] หน้าโรงแรม: mosaic รูป (md+), เนื้อหา 2 คอลัมน์ + กล่องสรุปติดข้าง, ห้องพัก, รีวิว
- [x] login/register แบบ 2 คอลัมน์ (สิทธิประโยชน์สมาชิก), หน้าบัญชีเป็น hub
- [x] ข้อความทั้งหมดเป็นภาษาไทย: `lib/messages-th.ts` (toThai + thaiResolver), zod th locale, วันที่ พ.ศ., ปฏิทิน th, Stripe `locale: "th"`
- [x] หน้า placeholder ของฟีเจอร์ที่ยังไม่มี → ดู Phase 11
- [ ] ตรวจในเบราว์เซอร์ที่ 375/768/1280px (ทุก route ตอบ 200 และ h1 เป็นภาษาไทยแล้ว — ตรวจด้วย curl 2026-11-16 แต่ยังไม่ได้ดูหน้าจอจริง)
ส่วนหน้าใหม่ใน Phase 7–8 ให้ทำตาม `DESIGN.md` ตั้งแต่ตอนสร้าง

**Skills:**
- `impeccable`: audit แล้ว polish ทีละหน้า (ลำดับชั้นข้อมูล, ระยะห่าง, typography, สี, ข้อความ)
- `next-dev-loop`: เปิดทุกหน้าใน `next dev` และดู console/error จริง ไม่ใช่แค่ compile ผ่าน
- `shadcn`: เปลี่ยน UI ที่ประกอบเองให้ใช้ component จาก `packages/ui`
- `dataviz`: ตรวจกราฟและ stat tiles ของ dashboard (สี, legend, dark mode)

- [ ] ทำรายการหน้าทั้งหมดของทั้งสองแอป แล้วตรวจทีละหน้าที่ความกว้าง 375px, 768px และ 1280px:
  - web: ค้นหา, ผลค้นหา, รายละเอียดโรงแรม (+ รีวิว), `/book`, login, register, `/account` (+ โปรไฟล์, เปลี่ยนรหัสผ่าน), การจองของฉัน, รายละเอียดการจอง + ชำระเงิน
  - web-admin: login, dashboard, hotels, room types + rooms + rates, bookings, staff (+ ปิดบัญชี/รีเซ็ตรหัสผ่าน), amenities, โปรไฟล์, แท็บประวัติ, รีวิว
- [ ] ตามกฎของ `DESIGN.md`: ใช้ theme tokens เท่านั้น (ไม่ hardcode สีหรือขนาด, ไม่มี inline style) และใช้ component จาก `packages/ui`
- [ ] ทุก data view มี loading (skeleton), error (พร้อมปุ่มลองใหม่) และ empty state
- [ ] ฟอร์ม: error ราย field จาก server แสดงถูกที่, ปุ่มกันกดซ้ำตอนส่ง และข้อความภาษาไทยครบใน web-admin
- [ ] Accessibility: label ของ input, focus ring, ใช้ keyboard ได้ทั้ง dialog/menu/date picker และ contrast ผ่าน WCAG AA
- [ ] Dark mode (ถ้า `DESIGN.md` รองรับ) และไม่มี horizontal scroll บนมือถือ
- [ ] ความสม่ำเสมอระหว่างหน้า: header ของฟอร์ม, ตำแหน่งปุ่ม, รูปแบบวันที่/ราคา และ badge สถานะ
- [ ] จดผลการตรวจและสิ่งที่แก้ไว้ในส่วนนี้ (ตรวจในเบราว์เซอร์แล้ว + วันที่) แบบเดียวกับ Phase 6

**เสร็จเมื่อ:** ทุกหน้าในรายการผ่านทุกข้อ, console ไม่มี error/warning ใหม่ และ lint/typecheck ผ่าน

## Phase 10 — Hardening และ deployment

**Skills:**
- `prisma-cli`: `migrate deploy` ใน CI และ migration สำหรับ CHECK constraints
- `prisma-orm-setup`: เชื่อมต่อ managed Postgres
- `security-review`: ตรวจทั้งระบบ
- performance ของ `apps/web`:
  - `next-bundle-optimizer`
  - `next-cache-components-adoption` → `next-cache-components-optimizer`
  - `next-partial-prefetching-adoption` → `next-partial-prefetching-optimizer`

- [ ] ลืมรหัสผ่าน (ลูกค้า) ย้ายมาจาก Phase 8: token ใช้ครั้งเดียว มีอายุ ส่งลิงก์ทางอีเมล (ต้องเลือกผู้ให้บริการอีเมลก่อน — เรื่องที่ต้องตัดสินใจ #8)
- [ ] Rate limit ต่อบัญชี (Phase 8) ใช้ memory store: ย้ายไป store ที่แชร์กันได้ถ้ามีหลาย instance
- [ ] CI: lint, typecheck, test, build และ `prisma migrate deploy` + `db:check` บน Postgres ชั่วคราว
- [ ] DB CHECKs:
  - `base_price`, `price`, `total_amount`, `amount` ต้อง ≥ 0
  - `capacity` ต้อง ≥ 1
  - `currency` ต้องเป็นตัวอักษร 3 ตัว
- [ ] Seed ต้องไม่ยอมรันเมื่อ `NODE_ENV=production`
- [ ] Background job: เปลี่ยน hold ที่ PENDING และเลย `expiresAt` แล้วเป็น `EXPIRED` (ตอนนี้เป็น lazy ทำให้ admin list
      และ dashboard เห็น PENDING ค้าง) และลบ session ที่หมดอายุ
- [ ] Security headers, request logging, rate limiting และจำกัดขนาด input
- [ ] อัปโหลดรูปไป object storage แทน URL ตรง ⚠️ ต้องใช้ service/dependency ใหม่ ต้องถามก่อน
- [ ] อีเมลแจ้งเตือนเมื่อยืนยันหรือยกเลิกการจอง ⚠️ ต้องใช้ service ใหม่ ต้องถามก่อน
- [ ] Deployment:
  - Docker image ของ api
  - hosting สำหรับ web และ web-admin
  - managed Postgres ที่รองรับ `btree_gist`
- [ ] Payments live mode: ตั้งค่าบัญชี/keys จริง, รองรับ refund ที่ยัง `pending` (webhook `refund.updated`),
      reconciliation ของ payment ที่ SUCCEEDED บน booking ที่ CANCELLED (refund ล้มเหลวตอนยกเลิก)
- [ ] (ไม่บังคับ) i18n ไทย/อังกฤษสำหรับ `apps/web` (ตอนนี้เป็นภาษาไทยแบบ hardcode ตั้งแต่ 9.0) ⚠️ ต้องเพิ่ม dependency ต้องถามก่อน

## Phase 11 — ฟีเจอร์ลูกค้าเพิ่มเติม (ref: Booking.com, Airbnb, Expedia)

เป้าหมาย: เติมฟีเจอร์ที่เว็บจองโรงแรมชั้นนำมี แต่เรายังไม่มี ทุกข้อด้านล่างมีหน้า placeholder (`ComingSoon`
ใน `apps/web/src/components/coming-soon.tsx`) และลิงก์จาก header/footer/หน้าบัญชีอยู่แล้ว
พอทำข้อไหนเสร็จ ให้แทน placeholder ด้วยหน้าจริงและเอาป้าย "เร็ว ๆ นี้" ออก ทุกข้อทำตามลำดับใน CLAUDE.md
(schema → shared → service → controller → route + tests → FE) และผ่าน `superpowers:brainstorming` ก่อน

| # | ฟีเจอร์ | ref | หน้า placeholder | หมายเหตุ |
| --- | --- | --- | --- | --- |
| 11.1 ✅ | ตัวกรอง + เรียงลำดับผลค้นหา (ช่วงราคา, คะแนนรีวิว, สิ่งอำนวยความสะดวก, เรียงตามราคา/คะแนน) | Booking.com | `FilterPanel` ใน `/hotels` | ✅ branch `feat/search-filters`: `minPrice`/`maxPrice`/`minRating`/`amenities`/`sort` ใน URL; กรอง/เรียงตามราคาคำนวณทุกโรงแรมที่ตรงแล้วแบ่งหน้าใน memory; `GET /api/amenities` (public); ยังไม่ได้ตรวจในเบราว์เซอร์ |
| 11.2 | รายการโปรด (wishlist) หลายลิสต์ + ปุ่มหัวใจบนการ์ดและหน้าโรงแรม | Airbnb | `/wishlist` | ตารางใหม่ `Wishlist`/`WishlistItem`; หัวใจต้องอยู่นอก `<Link>` ของการ์ด |
| 11.3 | หน้าจุดหมายปลายทาง: รวมเมือง + จำนวนโรงแรม + ราคาเริ่มต้น, ไอเดียทริปตามธีม | Expedia / Booking.com | `/destinations` | ต้องมี endpoint สรุปรายเมือง (ตอนนี้หน้าแรกสรุปจากหน้าแรกของผลค้นหา) |
| 11.4 | ค้นหาบนแผนที่ (map view) | Airbnb / Booking.com | (อยู่ใน 11.3 และ `FilterPanel`) | ต้องเพิ่ม lat/lng ใน `Hotel` + ไลบรารีแผนที่ ⚠️ dependency ใหม่ ต้องถามก่อน |
| 11.5 | ดีลพิเศษ: early bird, last minute, ส่วนลดพักหลายคืน, โค้ดส่วนลด | Booking.com / Agoda | `/deals` | ต่อยอดจาก rate periods; ราคาต้องมาจาก `pricing.service` เท่านั้น แสดงก่อน/หลังส่วนลด |
| 11.6 | สมาชิกรางวัล: แต้มจากการเข้าพักที่ COMPLETED, ระดับสมาชิก, ใช้แต้มเป็นส่วนลด | Booking.com Genius / Expedia One Key | `/rewards` | แต้มต้องเขียนใน transaction เดียวกับการเปลี่ยนสถานะ booking |
| 11.7 | ศูนย์ช่วยเหลือ: FAQ ค้นหาได้, ติดต่อทีมงานจากหน้าการจอง | ทั้งสามเว็บ | `/help` (มีหัวข้อนโยบายยกเลิก + การชำระเงินที่ถูกต้องแล้ว) | |
| 11.8 | ความปลอดภัยของบัญชี: แก้โปรไฟล์, เปลี่ยนรหัสผ่าน, ลืมรหัสผ่าน | ทั้งสามเว็บ | `/account/security` | คืองานใน Phase 8 — ทำ Phase 8 แล้วใช้หน้านี้เป็น UI |
| 11.9 | Lightbox ดูรูปเต็มจอ (คีย์บอร์ด ← →) แทน "ดูรูปทั้งหมด" แบบกางลง | Airbnb | `HotelGallery` | ใช้ dialog จาก `packages/ui` (`npm run ui:add -- dialog`) |

**เสร็จเมื่อ:** ไม่มีหน้า `ComingSoon` เหลือ และทุกฟีเจอร์มี test ฝั่ง API + loading/error/empty states ฝั่ง FE

---

## เรื่องที่ต้องตัดสินใจ

| # | เรื่อง | ต้องรู้ก่อน |
| --- | --- | --- |
| 1 | เปลี่ยน response shape เป็น `{ data }` / `{ error }` (กระทบ FE ทั้งสองแอป) | Phase 1 — ✅ ตัดสินแล้ว: ใช้ { data }/{ error } ทุก endpoint + axios |
| 2 | เพิ่ม dependency สำหรับ HTTP tests (เช่น supertest) | Phase 1 — ✅ ตัดสินแล้ว: supertest |
| 3 | Session cookie หรือ JWT | Phase 2 — ✅ ตัดสินแล้ว: session cookie + ตาราง Session (แยก sid / admin_sid) |
| 4 | เวลา hold รอจ่ายเงิน (ค่าเริ่มต้น 15 นาที) และจำนวนคืนสูงสุด (ค่าเริ่มต้น 30 คืน) | Phase 4 — จำนวนคืนสูงสุด ✅ ยืนยันแล้วใน Phase 3: 30 คืน (`MAX_NIGHTS` ใน `@booking/shared`); เวลา hold ✅ ยืนยันแล้วใน Phase 4: 15 นาที (`HOLD_MINUTES` ใน `@booking/shared`) |
| 5 | นโยบายยกเลิก (ยกเลิกฟรีก่อนเข้าพัก X วัน? คืนเงินบางส่วน?) | Phase 4–5 — ✅ ตัดสินแล้ว: ยกเลิกได้ก่อนวัน check-in (PENDING/CONFIRMED); คืนเงินเต็มจำนวน (Phase 5) |
| 6 | Payment gateway จริง | Phase 5 — ✅ Stripe (Payment Element), บัตรเท่านั้น, THB, test mode; live mode → Phase 10 |
| 7 | เวลา check-in/check-out ของโรงแรม (ต้องเพิ่ม field ใน `Hotel`) | Phase 6 — ✅ `checkInTime`/`checkOutTime` บน Hotel (HH:mm, 14:00/12:00), แสดงอย่างเดียว ไม่บังคับใน booking |
| 8 | ผู้ให้บริการเก็บรูปและส่งอีเมล | Phase 8 (ลืมรหัสผ่าน) หรือ Phase 10 |

## ช่องโหว่ที่ค้างมาจาก schema v1

- `Review.userId` / `hotelId` ซ้ำกับข้อมูลใน booking ดังนั้น service ต้องดึงค่าจาก booking เอง → Phase 7
- DB ไม่ได้ตรวจ scope ของ amenity (HOTEL/ROOM) ดังนั้น service ต้องตรวจเอง → ตรวจแล้วทั้ง hotel (6.1) และ room types (6.2) ผ่าน `assertAmenityScope`
- Expired sessions ถูกลบเมื่อมีคนใช้เท่านั้น — ต้องมี job ลบ → Phase 10
- `User` ไม่มี `isActive` — staff ที่ลาออกแล้วยัง login ได้ → ✅ Phase 8 (`User.isActive`)

## ไอเดียที่ยังไม่จัดเข้า phase

- รายงาน no-show: booking ที่ CONFIRMED แต่เลยวัน check-in แล้วไม่มี `checkedInAt` ให้ admin ปิดได้
- ส่งออก booking เป็น CSV สำหรับงานบัญชี
- FE e2e test (เช่น Playwright) สำหรับ flow จอง → จ่าย → ยกเลิก ⚠️ ต้องเพิ่ม dependency ต้องถามก่อน
