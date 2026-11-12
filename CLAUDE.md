# Project Guide for Claude

Hotel booking app. Customers book rooms in `apps/web`; staff/admins manage hotels, rooms, rates and bookings in `apps/web-admin`.

## Stack
npm workspaces monorepo (`apps/*`, `packages/*`), single root `package-lock.json`.

| Workspace | Package | Port | Stack |
| --- | --- | --- | --- |
| `apps/web` (customer site) | `@booking/web` | 3000 | Next.js 16 (App Router) + TypeScript + TanStack Query + Tailwind v4 |
| `apps/web-admin` (back-office) | `@booking/web-admin` | 3001 | same stack as web |
| `apps/api` (backend) | `@booking/api` | 8000 | Node.js + Express 5 + TypeScript + Prisma 7 |
| `packages/ui` | `@booking/ui` | – | shadcn/ui components + theme, used by web and web-admin |
| `packages/shared` | `@booking/shared` | – | zod schemas + types used by web, web-admin and api |

- **Database**: PostgreSQL 18 (Docker), host port **5433** (5432 is taken by a local Postgres)
- **Validation**: zod v4 (shared schemas between FE and BE where possible)
- Internal packages ship TS source (no build step). Import as `@booking/ui/components/<name>`,
  `@booking/ui/lib/utils`, `@booking/ui/globals.css`, `@booking/shared`.

## Structure
New features follow this layout; add new folders following the rules below.
```
apps/
  web/                   # customer site
    src/
      app/               # routes (App Router): login/, register/, account/; layout.tsx (header + UserNav);
                         # providers.tsx (QueryClient; no retry on 4xx; Query/MutationCache 401 → me = null)
      features/<name>/   # one folder per feature (e.g. auth/, hotels/, health/):
        api.ts           #   fetchers — call request()/requestNoContent() from lib/api.ts, never axios/fetch directly
        hooks.ts         #   TanStack Query hooks + key factory (e.g. hotelKeys.list(), authKeys.me())
        components/      #   feature UI (e.g. hotel-list.tsx, login-form.tsx, require-auth.tsx)
      lib/               # api.ts — axios client: request(schema, config) unwraps { data } and throws ApiError;
                         # form-errors.ts — applyServerFieldErrors (server fieldErrors → react-hook-form setError)
    components.json      # shadcn config — aliases point to @booking/ui
  web-admin/             # back-office — same layout as web, except: app/login/ is public and every other page
                         # lives in app/(protected)/ (layout = RequireAuth + AdminHeader); no register page
  api/
    src/
      index.ts           # starts server (env.PORT)
      app.ts             # express app: trust proxy, corsPolicy, json, routers, then notFound + errorHandler
      env.ts             # zod-validated env
      types/express.d.ts # declaration merging: Request.auth?: { user: PublicUser; sessionId }
      routes/            # express routers (public, e.g. hotels.ts, health.ts; auth.ts = /api/auth/* incl. /admin/*)
        admin/           # index.ts = adminRouter, guarded once by loadSession('ADMIN') + requireRole('ADMIN','STAFF');
                         # sub-routers per resource
      controllers/       # parse req, call service, respond with ok()/noContent() — never import prisma
      services/          # business logic — the only layer that calls prisma (e.g. hotel.service.ts, auth.service.ts)
      lib/               # prisma.ts (single client, PrismaPg adapter, global omit of passwordHash), app-error.ts,
                         # http.ts (ok, noContent), prisma-errors.ts (isUniqueViolationOn), password.ts (scrypt),
                         # session-token.ts, cookies.ts (sid / admin_sid), cors-policy.ts, slug.ts
      middleware/        # validate.ts, error-handler.ts, not-found.ts, load-session.ts, require-auth.ts,
                         # require-role.ts, require-hotel-access.ts, rate-limit.ts
      generated/prisma/  # Prisma client output (git-ignored, from `prisma generate`)
    prisma/
      schema.prisma  migrations/  seed.ts
      checks/            # constraints.sql — raw-SQL constraint checks (run by `npm run db:check`)
    prisma.config.ts     # Prisma 7 config: schema, migrations, seed, DATABASE_URL
    tsup.config.ts       # production bundle
packages/
  ui/                    # shadcn components + theme (shared by web and web-admin)
    src/components/  src/lib/utils.ts  src/styles/globals.css
    scripts/add.mjs      # wrapper used by `npm run ui:add`
  shared/                # zod schemas + types used by web, web-admin and api
    src/index.ts
docker-compose.yml
```

## Env
- `apps/api/.env`: `DATABASE_URL`, `PORT` (8000), `WEB_ORIGINS` / `ADMIN_ORIGINS` (comma-separated browser
  origins per app; defaults localhost:3000 / localhost:3001), `AUTH_RATE_LIMIT_MAX` (10) and
  `AUTH_RATE_LIMIT_WINDOW_MS` (900000), `TRUST_PROXY` (reverse-proxy hop count, 0 locally — never `true`)
- `apps/api/.env.test` (committed, no secrets): overrides loaded after `.env` by `npm test` (e.g. a high rate limit)
- `apps/web/.env.local`, `apps/web-admin/.env.local`: `NEXT_PUBLIC_API_URL` (http://localhost:8000)
- Each has a committed `.env.example`.

## Commands
Run from the repo root.
```bash
npm run db:up                     # start Postgres (docker compose up -d); db:down to stop
npm run dev                       # run web + web-admin + api
npm run dev:web                   # web only       (http://localhost:3000)
npm run dev:admin                 # web-admin only (http://localhost:3001)
npm run dev:api                   # api only       (http://localhost:8000)
npm run db:migrate -- --name <x>  # create + apply migration (prisma migrate dev)
npm run db:generate               # regenerate Prisma client
npm run db:seed                   # seed (prisma/seed.ts)
npm run db:studio                 # browse DB
npm run ui:add -- <component...>  # add shadcn component into packages/ui (don't use `npx shadcn add` directly)
npm run lint && npm run typecheck # must pass before finishing a task
npm test                          # api unit + integration tests (node:test + supertest, apps/api/src/**/*.test.ts)
                                  # needs db:up + db:seed and apps/api/.env (loaded via --env-file)
npm run db:check                  # verify DB constraints (prisma/checks/constraints.sql; needs db:up, runs in a rolled-back transaction)
npm run build                     # build all workspaces
```
`npm run dev -w apps/web` style also works. Prisma CLI can be run directly inside `apps/api` (`npx prisma ...`).
Tests use Node's built-in `node:test` + `node:assert/strict` (+ `supertest` for HTTP) — no test framework.
Put test files next to the code as `*.test.ts`. Tests run against the dev DB: use a unique name prefix for
rows you create, clean them up in `after()`, and never modify seeded rows. Run `npm run db:check` after any
migration that touches constraints. There is no FE test runner — verify UI in the browser.

## General Rules
- TypeScript `strict`. No `any` — use `unknown` + narrowing or proper types.
- Small, focused changes. Don't refactor code unrelated to the task.
- Plan first for anything touching more than ~3 files.
- After changes: run lint, typecheck, and relevant tests. Fix failures before reporting done.
- Never commit `.env`. Add new env vars to `.env.example`.

## Backend Rules
- Layering: `route → controller → service → prisma`. Controllers never call Prisma directly.
- Validate every request body/query/params with zod via the `validate` middleware.
- Throw `AppError(status, code, message)`; the global error handler formats responses.
- Response shape:
  - success: `{ "data": ... }`
  - error: `{ "error": { "code": "NOT_FOUND", "message": "..." } }`
- Admin endpoints live under `/api/admin/*` and are always guarded by `loadSession('ADMIN')` +
  `requireRole('ADMIN','STAFF')` (mounted once on `adminRouter`). Narrow further per route (e.g.
  `requireRole('ADMIN')`) and use `requireHotelAccess()` for hotel-scoped staff routes.
  Never rely on the frontend to hide admin features — the API enforces access.
- Auth: session cookies only (`sid` = web, `admin_sid` = admin; sessions are audience-bound). Never return
  `passwordHash` — it is globally omitted; only `auth.service` login opts in with `omit: { passwordHash: false }`.
- CORS is per path (`lib/cors-policy.ts`): `/api/admin/*` + `/api/auth/admin/*` → `ADMIN_ORIGINS`,
  other `/api/auth/*` → `WEB_ORIGINS`, everything else → both. New admin routes must stay under those prefixes.
- REST naming: plural nouns (`/api/users/:id`), proper status codes (201 create, 204 delete).
- Use a single Prisma client instance from `src/lib/prisma.ts`.
- Use `select`/`include` deliberately — never return password hashes or secrets.
- Multi-step writes go in `prisma.$transaction`.

## Database Rules
- Change schema only via `schema.prisma` + `prisma migrate dev`. Never edit applied migrations.
- Models: PascalCase singular (`User`); fields camelCase; use `@@map` for snake_case tables.
- Every model has `id`, `createdAt`, `updatedAt`.
- Add `@@index` for foreign keys and frequently filtered columns.
- Destructive migrations (drop column/table): stop and ask first.

## Frontend Rules (web and web-admin)
- `apps/web` and `apps/web-admin` must never import from each other.
  Anything shared goes in `packages/ui` (components) or `packages/shared` (schemas/types).
- Customer-only features go in `apps/web`; back-office features go in `apps/web-admin`.
- Server Components by default; add `"use client"` only when needed (state, effects, events).
- All client data fetching goes through TanStack Query hooks in `features/<name>/hooks.ts`.
  - Query keys as arrays via a key factory: `userKeys.detail(id)`.
  - Mutations invalidate related queries on success.
- No `fetch` inside components directly — use the api client in `lib/api.ts`.
- UI: use shadcn components from `packages/ui` first. Add new ones into `packages/ui`
  (not into an app), then compose. Use theme tokens — no hardcoded colors or sizes.
- Forms: react-hook-form + zod resolver, reuse schemas from `packages/shared`.
- Handle loading, error, and empty states for every data view.
- Styling: Tailwind utility classes + `cn()`; no inline styles.

## Adding a Feature (order)
1. Schema in `schema.prisma` → migrate
2. Shared zod schema in `packages/shared`
3. Service → controller → route (+ tests)
4. FE api fetcher → TanStack Query hook (in web or web-admin)
5. UI with components from `packages/ui` → loading/error/empty states
6. Lint, typecheck, test

## Ask Before
- Adding new dependencies
- Destructive DB changes
- Changing auth, the API response shape, or folder structure
