# Booking Hotel App

ระบบจองโรงแรม — ลูกค้าจองห้องผ่าน `apps/web`, staff/admin จัดการโรงแรม ห้อง ราคา และการจองผ่าน `apps/web-admin`

Monorepo (npm workspaces, `package-lock.json` เดียวที่ root)

| Workspace | Package | Port | Stack |
| --- | --- | --- | --- |
| `apps/web` | `@booking/web` | 3000 | Next.js 16 (App Router) + TS + Tailwind v4 + shadcn/ui + TanStack Query |
| `apps/web-admin` | `@booking/web-admin` | 3001 | เหมือน web |
| `apps/api` | `@booking/api` | 8000 | Express 5 + TS + Prisma 7 + zod |
| `packages/ui` | `@booking/ui` | – | shadcn/ui components + `globals.css` + `cn()` ใช้ร่วม web/admin |
| `packages/shared` | `@booking/shared` | – | zod schemas + types ใช้ร่วมทุกแอป |

## เริ่มต้นใช้งาน

ต้องมี Node.js 22+ และ Docker

```bash
npm install

# สร้างไฟล์ env จากตัวอย่าง
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/web-admin/.env.example apps/web-admin/.env.local

# ฐานข้อมูล PostgreSQL 18 (Docker, host port 5433)
npm run db:up
npm run db:migrate          # prisma migrate dev
npm run db:seed             # ข้อมูลตัวอย่าง (โรงแรม ห้อง ราคา การจอง และบัญชีผู้ใช้)

# รัน api + web + admin พร้อมกัน
npm run dev
```

- Web: http://localhost:3000 (`/` ค้นหา, `/hotels` ผลค้นหา, `/hotels/<slug>` รายละเอียด + ราคาตามวันที่, `/book` จอง + hold 15 นาที, `/account/bookings` การจองของฉัน, `/account/bookings/<code>` รายละเอียด + นับถอยหลัง + ชำระเงิน (Stripe) + ยกเลิก/คืนเงิน, `/login`, `/register`, `/account`)
- Admin: http://localhost:3001 (`/login`; หน้าอื่นต้อง login เป็น ADMIN หรือ STAFF)
- API: http://localhost:8000/api/health, http://localhost:8000/api/hotels

> Postgres ใน Docker ใช้ host port **5433** เพื่อไม่ชนกับ Postgres ที่ติดตั้งในเครื่อง (5432)
> เปลี่ยนได้ด้วย env `POSTGRES_PORT` ตอน `docker compose up` (อย่าลืมแก้ `DATABASE_URL` ใน `apps/api/.env`)

### บัญชีทดสอบ (จาก seed)

รหัสผ่านทุกบัญชี: `Password123!` (ใช้ใน dev เท่านั้น)

| Email | Role | ใช้กับ |
| --- | --- | --- |
| `admin@booking.local` | ADMIN | admin (ทุกโรงแรม, สร้างโรงแรมได้) |
| `staff@booking.local` | STAFF | admin (เฉพาะโรงแรม Riverside Bangkok) |
| `customer@booking.local` | CUSTOMER | web |

## Scripts (root)

| Script | ทำอะไร |
| --- | --- |
| `npm run dev` | รัน api, web, admin พร้อมกัน (concurrently) |
| `npm run dev:api` / `dev:web` / `dev:admin` | รันทีละแอป |
| `npm run build` / `lint` / `typecheck` | รันทุก workspace (`lint` + `typecheck` ต้องผ่านก่อน commit) |
| `npm test` | test ของ api (unit + integration) |
| `npm run db:up` / `db:down` | เปิด/ปิด Postgres container |
| `npm run db:migrate -- --name <name>` | สร้าง/รัน migration |
| `npm run db:generate` / `db:seed` / `db:studio` | Prisma generate / seed / studio |
| `npm run db:check` | ตรวจ constraint ของ DB (`prisma/checks/constraints.sql`, รันใน transaction แล้ว rollback) |
| `npm run ui:add -- <component...>` | เพิ่ม shadcn component ลง `packages/ui` |

## Environment

| ไฟล์ | ตัวแปร |
| --- | --- |
| `apps/api/.env` | `DATABASE_URL`, `PORT` (8000), `WEB_ORIGINS` / `ADMIN_ORIGINS` (origin ของแต่ละแอป คั่นด้วย `,`), `AUTH_RATE_LIMIT_MAX` (10), `AUTH_RATE_LIMIT_WINDOW_MS` (900000), `TRUST_PROXY` (จำนวน proxy hop, local = 0 — ห้ามใช้ `true`), `PAYMENT_PROVIDER` (`stripe` | `mock`, ค่าเริ่มต้น `stripe`; `mock` ห้ามใช้ใน production), `STRIPE_SECRET_KEY` (`sk_test_…`), `STRIPE_WEBHOOK_SECRET` (`whsec_…`) |
| `apps/api/.env.test` | ค่า override ตอน `npm test` (commit ไว้แล้ว ไม่มี secret เช่น rate limit สูง, `PAYMENT_PROVIDER=mock`) |
| `apps/web/.env.local`, `apps/web-admin/.env.local` | `NEXT_PUBLIC_API_URL` (http://localhost:8000); web เท่านั้น: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_…`) |

ทุกไฟล์มี `.env.example` ให้ copy — อย่า commit `.env`

### Payments (Stripe test mode)

- ยังไม่มี key: ใส่ `PAYMENT_PROVIDER=mock` ใน `apps/api/.env` (API บูตได้, หน้า web จะขึ้น "Payments aren't configured")
- มี key: `PAYMENT_PROVIDER=stripe` + `STRIPE_SECRET_KEY` ใน `apps/api/.env` และ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` ใน `apps/web/.env.local`
- Webhook ตอน dev: `stripe listen --forward-to localhost:8000/api/webhooks/stripe` แล้วเอา `whsec_…` ที่พิมพ์ออกมาใส่ `STRIPE_WEBHOOK_SECRET`
  (ไม่รันก็ได้ — หน้า web เรียก `/payments/sync` ยืนยันเองหลังจ่าย)
- บัตรทดสอบ: `4242 4242 4242 4242` สำเร็จ, `4000 0000 0000 0002` ถูกปฏิเสธ, `4000 0027 6000 3184` 3-D Secure (วันหมดอายุในอนาคต, CVC อะไรก็ได้)

## Auth & Roles

- ใช้ **session cookie** (httpOnly, `SameSite=Lax`) ไม่ใช้ JWT
  - `sid` — ลูกค้า (web), อายุ 30 วัน
  - `admin_sid` — back-office (admin), อายุ 12 ชั่วโมง
  - session ผูกกับ audience: cookie ของ web ใช้กับ admin ไม่ได้และกลับกัน
- Roles: `CUSTOMER`, `STAFF`, `ADMIN`
  - `/api/admin/*` ต้องเป็น ADMIN หรือ STAFF เสมอ; บาง route จำกัดเพิ่ม (เช่น สร้างโรงแรม = ADMIN เท่านั้น)
  - STAFF เข้าถึงได้เฉพาะโรงแรมที่ผูกไว้ (`HotelStaff`) ผ่าน `requireHotelAccess()`
- Rate limit ที่ register / login / admin login (`429 RATE_LIMITED` เมื่อเกิน)
- CORS แยกตาม path (`src/lib/cors-policy.ts`): `/api/admin/*` + `/api/auth/admin/*` → `ADMIN_ORIGINS`,
  `/api/auth/*` อื่น ๆ → `WEB_ORIGINS`, route สาธารณะ → ทั้งสอง

## API Endpoints

Response สำเร็จ: `{ "data": ... }` · Error: `{ "error": { "code": "NOT_FOUND", "message": "..." } }`

| Method | Path | สิทธิ์ |
| --- | --- | --- |
| GET | `/api/health` | public |
| GET | `/api/hotels?city=&checkIn=&checkOut=&guests=&page=&pageSize=` | public — ค้นหาโรงแรม active แบบแบ่งหน้า (`{ items, page, pageSize, total, totalPages }`) |
| GET | `/api/hotels/:slug` | public — รูป, amenities, room types ที่ active |
| GET | `/api/hotels/:slug/availability?checkIn=&checkOut=&guests=` | public — ห้องว่าง + ราคาทีละคืนของแต่ละ room type |
| POST | `/api/bookings` | `sid` — จอง room type (PENDING, hold 15 นาที; 409 `ROOM_UNAVAILABLE` ถ้าห้องหมด) |
| GET | `/api/bookings/me?page=&pageSize=` | `sid` — การจองของฉัน แบบแบ่งหน้า |
| GET | `/api/bookings/:code` | `sid` — เฉพาะเจ้าของ (คนอื่น = 404) |
| POST | `/api/bookings/:code/cancel` | `sid` — ยกเลิกได้ก่อนวัน check-in (PENDING/CONFIRMED); จ่ายแล้ว → คืนเงินเต็มจำนวน |
| POST | `/api/bookings/:code/payments` | `sid` — 201 `{ clientSecret }` ของ PaymentIntent (สร้างใหม่หรือใช้อันเดิม); จ่ายไม่ได้ → 409 |
| POST | `/api/bookings/:code/payments/sync` | `sid` — ถาม Stripe ฝั่ง server แล้ว settle ทันที → booking |
| POST | `/api/webhooks/stripe` | Stripe เท่านั้น (ตรวจ `stripe-signature`) — `payment_intent.succeeded` / `.canceled` |
| POST | `/api/auth/register` | public (rate limited) |
| POST | `/api/auth/login` / `logout` | public / `sid` |
| GET | `/api/auth/me` | `sid` |
| POST | `/api/auth/admin/login` / `admin/logout` | public / `admin_sid` |
| GET | `/api/auth/admin/me` | `admin_sid` + ADMIN/STAFF |
| GET | `/api/admin/hotels?q=&status=active|inactive|all&page=&pageSize=` | `admin_sid` — STAFF เห็นเฉพาะโรงแรมที่ดูแล, ADMIN เห็นทั้งหมด (รวมที่ปิดใช้งาน) |
| POST | `/api/admin/hotels` | `admin_sid` + ADMIN — 201 รายละเอียดโรงแรม (shape admin); รับ `images` / `amenityIds` ได้ด้วย (สร้างพร้อมกันแบบ all-or-nothing) |
| GET | `/api/admin/hotels/:hotelId` | `admin_sid` + เข้าถึงโรงแรมได้ (STAFF ที่ไม่ได้ดูแล = 403) — รายละเอียด, รูป, amenities |
| PUT | `/api/admin/hotels/:hotelId` | เหมือนข้างบน — บันทึกทั้งโรงแรมในครั้งเดียว (details + เวลา + รูปเรียงลำดับ + amenities) ใน transaction เดียว; หน้า admin ใช้อันนี้ |
| PATCH | `/api/admin/hotels/:hotelId` | เหมือนข้างบน — แก้ name/city/address/description/checkInTime/checkOutTime (slug ไม่เปลี่ยน) |
| PUT | `/api/admin/hotels/:hotelId/images` | เหมือนข้างบน — แทนรายการรูปทั้งชุด `{ images: [{ url, alt? }] }` (สูงสุด 20, ลำดับ = ลำดับใน array) |
| PUT | `/api/admin/hotels/:hotelId/amenities` | เหมือนข้างบน — แทน amenity ทั้งชุด `{ amenityIds }` (เฉพาะ scope HOTEL) |
| PATCH | `/api/admin/hotels/:hotelId/status` | `admin_sid` + ADMIN — `{ isActive }` ปิด/เปิดใช้งาน |
| GET | `/api/admin/amenities?scope=HOTEL|ROOM` | `admin_sid` — ตัวเลือก amenity |
| GET | `/api/admin/hotels/:hotelId/room-types` | `admin_sid` + เข้าถึงโรงแรมได้ — room types ของโรงแรม (จำนวนห้อง/ห้องที่ active) |
| POST | `/api/admin/hotels/:hotelId/room-types` | เหมือนข้างบน — 201; `{ name, description?, capacity, basePrice, images, amenityIds }` (amenity เฉพาะ scope ROOM) |
| GET | `/api/admin/hotels/:hotelId/room-types/:roomTypeId` | เหมือนข้างบน — รายละเอียด + rooms + `deletable`; room type ของโรงแรมอื่น = 404 |
| PUT | `/api/admin/hotels/:hotelId/room-types/:roomTypeId` | เหมือนข้างบน — บันทึกทั้ง room type ใน transaction เดียว |
| PATCH | `/api/admin/hotels/:hotelId/room-types/:roomTypeId/status` | เหมือนข้างบน — `{ isActive }` |
| DELETE | `/api/admin/hotels/:hotelId/room-types/:roomTypeId` | เหมือนข้างบน — 204; มีห้องหรือ rate period = 409 (ให้ปิดใช้งานแทน) |
| POST | `/api/admin/hotels/:hotelId/room-types/:roomTypeId/rooms` | เหมือนข้างบน — 201 `{ number }`; เลขห้องซ้ำในโรงแรมเดียวกัน = 409 |
| PATCH | `/api/admin/hotels/:hotelId/room-types/:roomTypeId/rooms/:roomId` | เหมือนข้างบน — `{ number?, isActive? }` |
| POST | `/api/admin/uploads/images` | `admin_sid` — body = ไฟล์รูปดิบ (`Content-Type: image/jpeg|png|webp`, ≤ 5 MB, ตรวจ magic bytes) → 201 `{ url }`; ไฟล์เก็บที่ `UPLOAD_DIR` และเสิร์ฟที่ `/uploads/*` (dev เท่านั้น — object storage → Phase 8) |

กฎวันที่ (ใช้ร่วม FE/BE จาก `@booking/shared`): วันที่ส่งเป็น `YYYY-MM-DD`, คืนที่พักคือ `[checkIn, checkOut)`,
`checkIn` ต้องไม่ก่อน "วันนี้" ตามเวลา Asia/Bangkok และพักได้ไม่เกิน 30 คืน (`MAX_NIGHTS`)
· booking ที่กันห้อง = `CONFIRMED` หรือ `PENDING` ที่ยังไม่หมด `expiresAt`

## เพิ่ม shadcn component

```bash
npm run ui:add -- dialog dropdown-menu
```

ใช้ใน web/admin:

```tsx
import { Button } from "@booking/ui/components/button";
```

> ใช้ `ui:add` แทน `npx shadcn add` ตรง ๆ เพราะ shadcn CLI 4.x ใส่ `import { cn } from "cn"` ผิด
> สคริปต์ `packages/ui/scripts/add.mjs` จะแก้ import ให้เป็น `@booking/ui/lib/utils` และลบแพ็กเกจ `cn` ที่ติดมา

## โครงสร้าง

### API (`apps/api`)

- Layering: `routes → controllers → services → prisma` (controller ไม่เรียก Prisma ตรง)
- `src/env.ts` ตรวจ env ด้วย zod
- `src/app.ts` trust proxy, CORS ตาม path, JSON, routes, `notFound` + `errorHandler`
- `src/routes/admin/index.ts` `adminRouter` — guard ด้วย `loadSession('ADMIN')` + `requireRole('ADMIN','STAFF')` ครั้งเดียว
- `src/middleware/` `validate({ body, query, params })`, `load-session`, `require-auth`, `require-role`,
  `require-hotel-access`, `rate-limit`, error handler
- `src/services/` `hotel.service` (search/detail/availability), `pricing.service` (`quoteStay`), `availability.service`
  (นับห้องว่างแบบ bulk), `auth.service`, `hotel-access.service`, `booking.service`, `payment.service`
  (`settlePayment` เป็นที่เดียวที่ย้าย payment ออกจาก PENDING: ยืนยัน booking หรือคืนเงิน)
- `src/lib/payments/` `PaymentProvider` + `StripeProvider` / `MockProvider`, `getPaymentProvider()`; `src/lib/money.ts` (`toMinorUnits`)
- `src/routes/webhooks.ts` mount ใน `app.ts` **ก่อน** `express.json()` (ต้องใช้ raw body ตรวจลายเซ็น)
- `src/lib/` Prisma client เดียว (`passwordHash` ถูก omit ทั่วระบบ), `AppError`, `ok()`/`noContent()`, scrypt password, session token, cookies,
  `dates.ts` (แปลง `@db.Date` ↔ `YYYY-MM-DD`), `stay-pricing.ts` (`priceNights` คำนวณราคาทีละคืนด้วย `Prisma.Decimal`)
- `prisma/schema.prisma` models หลัก: `User`, `Session`, `HotelStaff`, `Hotel`, `RoomType`, `Room`, `RatePeriod`,
  `Booking`, `Payment`, `Review` (+ images/amenities); client generate ไปที่ `src/generated/prisma`
- schema ของ request ใช้จาก `@booking/shared` ร่วมกับฝั่ง frontend

### Frontend (`apps/web`, `apps/web-admin`)

- `src/app/` routes (App Router); `providers.tsx` = QueryClient (ไม่ retry 4xx, 401 → ล้างสถานะ `me`)
- `src/features/<name>/` แยกตาม feature: `api.ts` (fetcher), `hooks.ts` (TanStack Query + key factory), `components/`
- `src/lib/api.ts` axios client — `request(schema, config)` แกะ `{ data }` และ throw `ApiError`
- web-admin: `app/login/` เป็น public, หน้าอื่นอยู่ใน `app/(protected)/` (layout = `RequireAuth` + `AdminShell` เมนูข้าง
  จาก `components/nav-items.ts`); routes: `/` → `/hotels`, `/hotels` (ค้นหา/กรองสถานะ/แบ่งหน้าผ่าน URL),
  `/hotels/new` (ADMIN), `/hotels/[hotelId]` (Details / Images / Amenities, ADMIN ปิด-เปิดใช้งาน + รายการ Room types),
  `/hotels/[hotelId]/room-types/new`, `/hotels/[hotelId]/room-types/[roomTypeId]` (Details / Images / Amenities +
  Rooms: เพิ่ม, เปลี่ยนเลข, ปิด-เปิดใช้งาน)
- web: `features/hotels/search-params.ts` — URL search params คือ state ของการค้นหา/วันที่ (ค่าที่ไม่ถูกต้องถูกตัดทิ้ง ไม่ throw)
- web กับ web-admin ห้าม import กันเอง — ของที่ใช้ร่วมไปไว้ใน `packages/ui` หรือ `packages/shared`
- UI ทำตาม `DESIGN.md` (tokens, การใช้ component, สถานะ loading/error/empty)

## Testing

```bash
npm run db:up && npm run db:seed
npm test
```

- ใช้ `node:test` + `node:assert/strict` + `supertest` (ไม่มี test framework) ไฟล์ `*.test.ts` วางข้างโค้ดใน `apps/api/src`
- test รันกับ dev DB: ใช้ prefix ชื่อเฉพาะให้แถวที่สร้าง, ลบใน `after()`, ห้ามแก้แถวจาก seed
- frontend ยังไม่มี test runner — ตรวจใน browser

## เอกสารเพิ่มเติม

- `CLAUDE.md` — กฎและโครงสร้างโปรเจกต์ฉบับเต็ม
- `DESIGN.md` — กฎการออกแบบ FE (tokens, components, states)
- `PLAN.md` — roadmap และสถานะแต่ละ phase
- `docs/superpowers/specs/` และ `docs/superpowers/plans/` — design spec และแผนของแต่ละ phase
