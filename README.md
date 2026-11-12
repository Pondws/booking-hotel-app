# Booking Hotel App

Monorepo (npm workspaces)

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
npm run db:seed             # ข้อมูลตัวอย่าง

# รัน api + web + admin พร้อมกัน
npm run dev
```

- Web: http://localhost:3000
- Admin: http://localhost:3001
- API: http://localhost:8000/api/health, http://localhost:8000/api/hotels

> Postgres ใน Docker ใช้ host port **5433** เพื่อไม่ชนกับ Postgres ที่ติดตั้งในเครื่อง (5432)
> เปลี่ยนได้ด้วย env `POSTGRES_PORT` ตอน `docker compose up` (อย่าลืมแก้ `DATABASE_URL` ใน `apps/api/.env`)

## Scripts (root)

| Script | ทำอะไร |
| --- | --- |
| `npm run dev` | รัน api, web, admin พร้อมกัน (concurrently) |
| `npm run dev:api` / `dev:web` / `dev:admin` | รันทีละแอป |
| `npm run build` / `lint` / `typecheck` | รันทุก workspace |
| `npm run db:up` / `db:down` | เปิด/ปิด Postgres container |
| `npm run db:migrate -- --name <name>` | สร้าง/รัน migration |
| `npm run db:generate` / `db:seed` / `db:studio` | Prisma generate / seed / studio |
| `npm run ui:add -- <component...>` | เพิ่ม shadcn component ลง `packages/ui` |

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

## โครงสร้าง API

- `src/env.ts` ตรวจ env ด้วย zod (`DATABASE_URL`, `PORT`, `WEB_ORIGINS`, `ADMIN_ORIGINS`, ...)
- `src/app.ts` CORS แยกตาม path (`src/lib/cors-policy.ts`: admin → `ADMIN_ORIGINS`, auth ลูกค้า → `WEB_ORIGINS`), JSON, routes, error handler
- `src/middleware/validate.ts` `validate({ body, query, params })`
- `prisma/schema.prisma` models `Hotel`, `Room`, `Booking`; client generate ไปที่ `src/generated/prisma`
- schema สำหรับ request ใช้จาก `@booking/shared` ร่วมกับฝั่ง frontend
