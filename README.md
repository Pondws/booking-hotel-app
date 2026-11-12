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

- Web: http://localhost:3000 (`/login`, `/register`, `/account`)
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
| `apps/api/.env` | `DATABASE_URL`, `PORT` (8000), `WEB_ORIGINS` / `ADMIN_ORIGINS` (origin ของแต่ละแอป คั่นด้วย `,`), `AUTH_RATE_LIMIT_MAX` (10), `AUTH_RATE_LIMIT_WINDOW_MS` (900000), `TRUST_PROXY` (จำนวน proxy hop, local = 0 — ห้ามใช้ `true`) |
| `apps/api/.env.test` | ค่า override ตอน `npm test` (commit ไว้แล้ว ไม่มี secret เช่น rate limit สูง) |
| `apps/web/.env.local`, `apps/web-admin/.env.local` | `NEXT_PUBLIC_API_URL` (http://localhost:8000) |

ทุกไฟล์มี `.env.example` ให้ copy — อย่า commit `.env`

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
| GET | `/api/hotels` | public |
| POST | `/api/auth/register` | public (rate limited) |
| POST | `/api/auth/login` / `logout` | public / `sid` |
| GET | `/api/auth/me` | `sid` |
| POST | `/api/auth/admin/login` / `admin/logout` | public / `admin_sid` |
| GET | `/api/auth/admin/me` | `admin_sid` + ADMIN/STAFF |
| POST | `/api/admin/hotels` | `admin_sid` + ADMIN |

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
- `src/lib/` Prisma client เดียว (`passwordHash` ถูก omit ทั่วระบบ), `AppError`, `ok()`/`noContent()`, scrypt password, session token, cookies
- `prisma/schema.prisma` models หลัก: `User`, `Session`, `HotelStaff`, `Hotel`, `RoomType`, `Room`, `RatePeriod`,
  `Booking`, `Payment`, `Review` (+ images/amenities); client generate ไปที่ `src/generated/prisma`
- schema ของ request ใช้จาก `@booking/shared` ร่วมกับฝั่ง frontend

### Frontend (`apps/web`, `apps/web-admin`)

- `src/app/` routes (App Router); `providers.tsx` = QueryClient (ไม่ retry 4xx, 401 → ล้างสถานะ `me`)
- `src/features/<name>/` แยกตาม feature: `api.ts` (fetcher), `hooks.ts` (TanStack Query + key factory), `components/`
- `src/lib/api.ts` axios client — `request(schema, config)` แกะ `{ data }` และ throw `ApiError`
- web-admin: `app/login/` เป็น public, หน้าอื่นอยู่ใน `app/(protected)/` (layout = `RequireAuth` + `AdminHeader`)
- web กับ web-admin ห้าม import กันเอง — ของที่ใช้ร่วมไปไว้ใน `packages/ui` หรือ `packages/shared`

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
- `docs/superpowers/specs/` และ `docs/superpowers/plans/` — design spec และแผนของแต่ละ phase
