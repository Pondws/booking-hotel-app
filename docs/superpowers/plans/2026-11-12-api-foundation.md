# API Foundation (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every API response the `{ data }` / `{ error: { code, message } }` envelope, add `AppError` and a global error handler, split hotels into route → controller → service, put admin routes behind a role guard, and move both frontends to an axios client and the `features/` layout.

**Architecture:**
- `packages/shared` holds the envelope and error schemas, so the API and both frontends agree on the response shape.
- The API gets three small `lib/` + `middleware/` units (errors, response helpers, guard), a hotel service (the only code that calls Prisma) and thin controllers.
- Each frontend gets its own axios-based `lib/api.ts` that unwraps `{ data }` and throws a typed `ApiError`. The hotel and health features move under `features/<name>/`.

**Tech Stack:** Express 5, Prisma 7, zod v4, `node:test` + `supertest` (via `tsx`), Next.js 16, TanStack Query v5, axios.

**Spec:** `docs/superpowers/specs/2026-11-12-api-foundation-design.md` is the binding source for every file's responsibility, the error mapping table and the test list. Read it first.

## Global Constraints

- **Success body:** `{ "data": ... }`.
- **Error body:** `{ "error": { "code": string, "message": string, "details"?: unknown } }`.
- **Error codes:** `VALIDATION_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL`. The frontend adds a client-only `NETWORK_ERROR` (status 0).
- **Error messages, verbatim:**
  - 500: `"Internal server error"`.
  - 404: `"Route not found"`.
  - Guard: `"Authentication required"`.
- **Approved dependencies only:**
  - `supertest` and `@types/supertest`: devDependencies in `apps/api`.
  - `axios`: dependency in `apps/web` and `apps/web-admin`.
  - Nothing else.
- **TypeScript:** strict, no `any`. Routes and controllers never import `prisma`.
- **App boundaries:** `apps/web` and `apps/web-admin` never import from each other.
- **Frontend rules:** no `fetch` or axios calls inside components; UI from `@booking/ui` only; theme tokens only; no inline styles.
- **Do not edit:** `schema.prisma`, migrations, `seed.ts`.
- **Running tests:** they need the DB up and seeded (`npm run db:up`, `npm run db:seed`). Run them with `npm test` from the repo root.
- **Skills to load before starting:**
  - Tasks 1–2: `prisma-client-api`.
  - Task 3: `tanstack-query-best-practices` and `next-dev-loop`.

## Review Focus

1. When the DB is down, `/api/health` returns 503 with `{ data: { db: false } }`. `ApiStatus` must show "DB offline", not "API offline", which means the health fetcher must accept 503. Pinned in Task 3 Step 6.
2. An unhandled error must never leak its message or stack in the 500 body. Pinned in Task 1's test.
3. A malformed JSON body must get 400 `VALIDATION_FAILED`, not 500. Pinned in Task 1's test.
4. The admin guard must run before validation, so an invalid body sent to `POST /api/admin/hotels` still gets 401, not 400. Pinned in Task 2's test.
5. A non-JSON error response (an HTML 502 from a proxy, an empty body) must become `ApiError` with `code: "INTERNAL"` and a readable message, not a zod parse crash in the UI. Pinned in Task 3 Step 3 (code) and checked in its review. There is no frontend test runner.

---

### Task 1: Shared contract, error handling and response envelope

**Files:**
- Modify: `packages/shared/src/index.ts` (add the "API envelope" section)
- Create: `apps/api/src/lib/app-error.ts`, `apps/api/src/lib/http.ts`
- Create: `apps/api/src/middleware/error-handler.ts`, `apps/api/src/middleware/not-found.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/routes/health.ts`
- Modify: `apps/api/package.json` (test script, devDependencies)
- Test: `apps/api/src/middleware/error-handler.test.ts`, `apps/api/src/app.test.ts`

**Interfaces:**
- Produces (`@booking/shared`):
  - `errorCodeSchema` and `type ErrorCode`.
  - `apiErrorSchema` and `type ApiErrorBody = z.infer<typeof apiErrorSchema>`.
  - `dataEnvelope<S extends z.ZodType>(schema: S)`, which returns `z.object({ data: schema })`.
- Produces (api):
  - `class AppError extends Error { readonly status: number; readonly code: ErrorCode; readonly details?: unknown; constructor(status, code, message, details?) }`.
  - `ok<T>(res: Response, data: T, status?: number): void`.
  - `noContent(res: Response): void`.
  - `errorHandler: ErrorRequestHandler`.
  - `notFound: RequestHandler`.

- [ ] **Step 1: Install supertest and load env in tests**

Run: `npm install -D supertest @types/supertest -w @booking/api`
Change the `apps/api/package.json` `test` script to `tsx --env-file=.env --test src/**/*.test.ts`. Tests import `app`, which imports `env.ts`, which needs `DATABASE_URL`.

- [ ] **Step 2: Write the failing tests**

`apps/api/src/middleware/error-handler.test.ts` builds a throwaway express app: `express.json()`, then the routes below, then `notFound`, then `errorHandler`. Tests:

```ts
// routes: GET /app-error → throw new AppError(403, "FORBIDDEN", "Nope", { why: "x" })
//         POST /zod      → z.object({ name: z.string() }).parse(req.body)
//         GET /p2002     → throw new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "7" })
//         GET /p2025     → same with code "P2025"
//         GET /boom      → throw new Error("secret-db-password")
test("AppError keeps its status, code, message and details", ...)        // 403, { error: { code: "FORBIDDEN", message: "Nope", details: { why: "x" } } }
test("ZodError → 400 VALIDATION_FAILED with fieldErrors", ...)            // POST /zod {} → 400, body.error.code === "VALIDATION_FAILED", body.error.details.fieldErrors.name is an array
test("malformed JSON → 400 VALIDATION_FAILED", ...)                       // POST /zod with header Content-Type: application/json and raw body "{bad" → 400
test("Prisma P2002 → 409 CONFLICT, P2025 → 404 NOT_FOUND", ...)
test("unknown error → 500 INTERNAL without leaking the message", ...)     // 500, code "INTERNAL", message "Internal server error", JSON.stringify(body) does not include "secret-db-password"
test("unknown route → 404 NOT_FOUND", ...)                                 // GET /nope → 404, { error: { code: "NOT_FOUND", message: "Route not found" } }
```

`Prisma` comes from `../generated/prisma/client`. Silence the handler's `console.error` in the 500 test with `t.mock.method(console, "error", () => {})`, so the test output stays clean.

`apps/api/src/app.test.ts` uses `request(app)`:
```ts
test("GET /api/health → 200 { data: { ok: true, db: true, timestamp } }", ...)
test("GET /api/does-not-exist → 404 NOT_FOUND envelope", ...)
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npm test`
Expected: FAIL. The new imports can't be resolved, and `/api/health` currently returns an unwrapped body.

- [ ] **Step 4: Implement the shared contract, `AppError`, `http.ts`, `errorHandler`, `notFound`**

Follow the mapping table in the spec. Detect malformed JSON with `err instanceof SyntaxError && "type" in err && err.type === "entity.parse.failed"`. Wire `app.ts`: routers → `notFound` → `errorHandler`. Remove the old inline handlers. In `routes/health.ts`, respond with `ok(res, body, db ? 200 : 503)`.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npm test`
Expected: all of the new tests and the 11 existing tests pass. Output is clean, with no stray `console.error` lines.

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both pass. The frontends still compile, because their contract change happens in Task 3.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/index.ts apps/api package-lock.json
git commit -m "feat(api): response envelope, AppError and global error handler"
```

---

### Task 2: Hotel service, controller, public and admin routes

**Files:**
- Create: `apps/api/src/services/hotel.service.ts`, `apps/api/src/controllers/hotel.controller.ts`
- Create: `apps/api/src/middleware/require-role.ts`
- Create: `apps/api/src/routes/admin/index.ts`, `apps/api/src/routes/admin/hotels.ts`
- Modify: `apps/api/src/routes/hotels.ts` (GET only), `apps/api/src/app.ts` (mount `/api/admin`)
- Test: `apps/api/src/services/hotel.service.test.ts`, `apps/api/src/app.test.ts` (add cases)

**Interfaces:**
- Consumes (Task 1): `AppError`, `ok`, `errorHandler`, `notFound`.
- Produces:
  - `listActiveHotels(): Promise<Hotel[]>`, which returns active hotels ordered by `createdAt` desc.
  - `createHotel(input: CreateHotelData): Promise<Hotel>`.
  - `Hotel` is the Prisma model type from `../generated/prisma/client`.
  - `requireRole(...roles: Role[]): RequestHandler`, with `Role` from the generated client.
  - `adminRouter`, mounted at `/api/admin`.

- [ ] **Step 1: Write the failing tests**

`apps/api/src/services/hotel.service.test.ts` uses a unique prefix, `const name = \`Svc Test ${Date.now()}\``. An `after()` hook deletes every hotel whose `name` starts with `"Svc Test "`.
```ts
test("same name twice → slugs base and base-2", ...)              // toSlug(name) and `${toSlug(name)}-2`
test("concurrent creates with the same new name both succeed with distinct slugs", ...)  // Promise.all of 2 createHotel → 2 hotels, slugs differ
test("listActiveHotels omits inactive hotels", ...)               // create one, set isActive false via prisma, assert absent from list
```

Add these cases to `apps/api/src/app.test.ts`:
```ts
test("GET /api/hotels → 200 { data: [...] }, seeded hotels present", ...)   // data is an array, includes slug "riverside-bangkok"
test("POST /api/admin/hotels with a valid body → 401 UNAUTHORIZED, nothing created", ...)
     // name `App Test ${Date.now()}`; 401 { error: { code: "UNAUTHORIZED", message: "Authentication required" } };
     // then prisma.hotel.count({ where: { name } }) === 0
test("POST /api/admin/hotels with an invalid body → still 401 (guard runs before validation)", ...)  // body {}
test("POST /api/hotels is no longer a route → 404", ...)
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test`
Expected: FAIL. The service module can't be resolved, `GET /api/hotels` returns an unwrapped array, and `/api/admin/hotels` returns 404.

- [ ] **Step 3: Implement the service, controller, `requireRole`, admin router and public router**

The slug logic moves from `routes/hotels.ts` into the service. The retry is: catch the error, check `err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"`, recompute the slug, and try exactly once more. Before writing these queries, load the `prisma-client-api` skill.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test`
Expected: all pass. Then run `npm run typecheck && npm run lint` and expect both to pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): hotel service/controller layers and guarded admin router"
```

---

### Task 3: Frontend axios client and `features/` layout (web + web-admin)

**Files** (in each app unless the line says otherwise):
- Modify: `src/lib/api.ts` (rewrite on axios)
- Create: `src/features/hotels/api.ts`, `src/features/hotels/hooks.ts`, `src/features/hotels/components/hotel-list.tsx`
- Create: `src/features/health/api.ts`, `src/features/health/hooks.ts`, `src/features/health/components/api-status.tsx`
- Create (web-admin only): `src/features/hotels/components/create-hotel-form.tsx`
- Modify: `src/app/page.tsx` (new imports)
- Delete: `src/hooks/use-hotels.ts`, `src/components/hotel-list.tsx`, and in web-admin also `src/components/create-hotel-form.tsx`

**Interfaces:**
- Consumes (Task 1): `dataEnvelope`, `apiErrorSchema`, `hotelListSchema`, `hotelSchema`, `healthSchema`, `createHotelSchema`, `CreateHotelInput` from `@booking/shared`.
- Consumes (Task 2): `GET /api/hotels` and `POST /api/admin/hotels`.
- Produces:
  - `class ApiError extends Error { status: number; code: string; details?: unknown }`.
  - `request<S extends z.ZodType>(schema: S, config: AxiosRequestConfig): Promise<z.output<S>>`.
  - `hotelKeys`, `useHotels()`, `useCreateHotel()` (admin).
  - `healthKeys`, `useHealth()`.

- [ ] **Step 1: Install axios**

Run: `npm install axios -w @booking/web -w @booking/web-admin`

- [ ] **Step 2: Load skills**

Load the `tanstack-query-best-practices` skill (key factory, mutation invalidation) before writing the hooks.

- [ ] **Step 3: Rewrite `src/lib/api.ts`** with the instance options from the spec. The response error interceptor works like this:
  - If the error has a response whose body parses with `apiErrorSchema`, throw `ApiError(status, code, message, details)`.
  - If there is a response but the body doesn't match (HTML, empty), throw `ApiError(status, "INTERNAL", \`Request failed with status ${status}\`)`.
  - If there is no response (network error or timeout), throw `ApiError(0, "NETWORK_ERROR", "Cannot reach the server")`.

  `request` calls `instance.request(config)`, then `dataEnvelope(schema).parse(res.data).data`.

- [ ] **Step 4: Create the `features/hotels` files**
  - Key factory: `hotelKeys = { all: ["hotels"] as const, list: () => [...hotelKeys.all, "list"] as const }`.
  - `useCreateHotel` uses `onSuccess: () => queryClient.invalidateQueries({ queryKey: hotelKeys.all })`.
  - The admin form uses `useCreateHotel`. On `ApiError` with `code === "VALIDATION_FAILED"`, map `details.fieldErrors` (narrow it from `unknown` with a small zod schema, no casts) into the field errors. Any other error shows `error.message`. Keep client-side `createHotelSchema` validation as it is.

- [ ] **Step 5: Move `HotelList` and `ApiStatus`** into their features. Keep the existing markup and the loading/error/empty states. Update both `page.tsx` files, then delete the old files.

- [ ] **Step 6: Make `fetchHealth` accept 503** with `validateStatus: (s) => s === 200 || s === 503`. This way a DB-down response is data, and `ApiStatus` renders "DB offline".

- [ ] **Step 7: Lint, typecheck, build**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all three pass. `grep -rn "hooks/use-hotels\|@/components/" apps/web/src apps/web-admin/src` finds nothing.

- [ ] **Step 8: Verify in the browser with the `next-dev-loop` skill** (`npm run dev`)

Expected:
- **web, `http://localhost:3000`:** the 3 seeded hotels are listed, and the badge reads "API + DB online".
- **web-admin, `http://localhost:3001`:** the same list is shown. Submitting the form with a valid name, city and address shows "Authentication required". Submitting it empty shows client-side field errors.
- **API stopped:** both apps show the hotel error state and "API offline".
- **DB stopped** (`npm run db:down` while the API runs): the badge reads "DB offline". Afterwards, restore with `npm run db:up`.

- [ ] **Step 9: Commit**

```bash
git add apps/web apps/web-admin package-lock.json
git commit -m "feat(web,admin): axios api client and features/ layout"
```
