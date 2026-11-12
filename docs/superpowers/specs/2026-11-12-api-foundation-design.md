# API Foundation (Phase 1) — Design

Date: 2026-11-12
Status: Approved in chat, awaiting written-spec review
Roadmap: `PLAN.md` Phase 1

## Goal

Bring the API in line with the CLAUDE.md backend rules before features are built on it. That
means a standard response envelope, `AppError` plus one global error handler, route →
controller → service layering, and admin routes under `/api/admin/*` behind a role guard. Both
frontends move to an axios client and the `features/<name>/` layout.

## Decisions

| Topic | Decision |
| --- | --- |
| Response shape | Every endpoint, `/api/health` included: success `{ "data": ... }`, error `{ "error": { "code", "message", "details"? } }` |
| Health status | `/api/health` keeps 200, or 503 when the DB is down; the body is wrapped in `{ data }` |
| FE HTTP client | `axios` (new dependency in `apps/web` and `apps/web-admin`, approved) |
| HTTP tests | `supertest` + `@types/supertest` (devDependencies in `apps/api`, approved) |
| Admin route | Hotel creation moves to `POST /api/admin/hotels` now. The `/api/admin` router is guarded by `requireRole('ADMIN','STAFF')`, which rejects every request with 401 until Phase 2 |
| Public hotel list | `GET /api/hotels` returns only `isActive = true` hotels, newest first |
| FE layout | `features/<name>/{api.ts,hooks.ts,components/}` per CLAUDE.md; `src/hooks/` and `src/components/` are removed |
| Out of scope | Real auth, other resources, pagination, search filters |

## Shared contract (`packages/shared/src/index.ts`)

- `errorCodeSchema = z.enum(["VALIDATION_FAILED", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "INTERNAL"])` and `type ErrorCode`.
- `apiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }) })`.
  `code` is a plain string, so an old client doesn't break when the server adds a new code.
- `dataEnvelope(schema)` returns `z.object({ data: schema })`. Both frontends use it to validate
  success bodies.

## API (`apps/api/src`)

| File | Responsibility |
| --- | --- |
| `lib/app-error.ts` | `class AppError extends Error { constructor(status: number, code: ErrorCode, message: string, details?: unknown) }` |
| `lib/http.ts` | `ok(res, data, status = 200)` sends `{ data }`; `noContent(res)` sends 204 |
| `middleware/error-handler.ts` | `AppError` → its own status/code/message/details. `ZodError` → 400 `VALIDATION_FAILED`, with `details = z.flattenError(err)`. `Prisma.PrismaClientKnownRequestError` `P2002` → 409 `CONFLICT`, `P2025` → 404 `NOT_FOUND`. A malformed JSON body (`SyntaxError` from `express.json`, `type === "entity.parse.failed"`) → 400 `VALIDATION_FAILED`. Anything else → 500 `INTERNAL` with the message `"Internal server error"`; the error is logged and never echoed to the client |
| `middleware/not-found.ts` | 404 `NOT_FOUND` with the message `"Route not found"` |
| `middleware/require-role.ts` | `requireRole(...roles: Role[]): RequestHandler`. In Phase 1 there is no session, so it always calls `next(new AppError(401, "UNAUTHORIZED", "Authentication required"))`. Phase 2 replaces the body; the signature stays |
| `services/hotel.service.ts` | `listActiveHotels(): Promise<Hotel[]>` and `createHotel(input: CreateHotelData): Promise<Hotel>`. These are the only hotel code that touches `prisma` |
| `controllers/hotel.controller.ts` | `listHotels(req, res)` and `createHotel(req, res)`: read the input, call the service, respond with `ok()` |
| `routes/hotels.ts` | `GET /` → `listHotels` (public, mounted at `/api/hotels`) |
| `routes/admin/index.ts` | `adminRouter`. `router.use(requireRole("ADMIN", "STAFF"))` runs once, before any sub-router, then `router.use("/hotels", adminHotelsRouter)`. Mounted at `/api/admin` |
| `routes/admin/hotels.ts` | `POST /` → `validate({ body: createHotelSchema })` → `createHotel` (201) |
| `routes/health.ts` | Unchanged logic; the response is wrapped in `{ data }` |
| `app.ts` | Mounts the routers, then `notFound`, then `errorHandler` |

**Slug race.** `createHotel` computes the slug with `toSlug` + `withSuffix`, as today. If
`prisma.hotel.create` throws `P2002` on `slug`, the service recomputes the slug once and retries.
If the second attempt also hits `P2002`, the error propagates and the handler turns it into 409
`CONFLICT`.

**Express 5** forwards rejected promises from async handlers to the error handler, so the code
needs no async wrapper.

## Frontend (`apps/web` and `apps/web-admin`, one copy each)

| File | Responsibility |
| --- | --- |
| `lib/api.ts` | An axios instance: `baseURL = NEXT_PUBLIC_API_URL ?? "http://localhost:8000"`, `withCredentials: true`, `timeout: 10_000`, JSON headers. `class ApiError extends Error { status: number; code: string; details?: unknown }`. The response interceptor turns an `AxiosError` with a body into `ApiError(status, code, message, details)` using `apiErrorSchema`. A body that doesn't match becomes `code: "INTERNAL"`, and a request with no response (network error or timeout) becomes `status: 0`, `code: "NETWORK_ERROR"`. `request<S extends z.ZodType>(schema: S, config: AxiosRequestConfig): Promise<z.output<S>>` validates `dataEnvelope(schema)` and returns `.data` |
| `features/hotels/api.ts` | `fetchHotels()`; web-admin also has `createHotel(input: CreateHotelInput)` |
| `features/hotels/hooks.ts` | `hotelKeys = { all: ["hotels"], list: () => [...hotelKeys.all, "list"] }`, `useHotels()`; web-admin also has `useCreateHotel()`, which invalidates `hotelKeys.all` on success |
| `features/hotels/components/hotel-list.tsx` | Moved from `src/components/`, with loading, error and empty states |
| `features/hotels/components/create-hotel-form.tsx` (admin) | Uses `useCreateHotel`. A `VALIDATION_FAILED` error with `details.fieldErrors` is shown under the matching fields; any other `ApiError` shows its `message` |
| `features/health/{api.ts,hooks.ts,components/api-status.tsx}` | `healthKeys`, `useHealth()` and the `ApiStatus` badge (moved out of `hotel-list.tsx`) |

The two `lib/api.ts` copies stay in their own apps. CLAUDE.md forbids the apps from importing each
other, and putting axios in `packages/shared` would also bundle it into the API. The envelope and
error schemas are shared.

**Expected in Phase 1:** submitting the admin create-hotel form shows "Authentication required"
(401). Hotels are added through `npm run db:seed` until Phase 2.

## Testing

All API tests use `node:test` + `supertest` and run with `npm test`. They need the DB to be up
(`npm run db:up`) and seeded.

- `middleware/error-handler.test.ts` uses a throwaway express app with routes that throw.
  - `AppError` → its own status/code.
  - `ZodError` → 400 `VALIDATION_FAILED`, with `details.fieldErrors`.
  - Malformed JSON → 400.
  - `P2002` → 409.
  - `P2025` → 404.
  - `new Error("secret")` → 500 `INTERNAL`, and the body does not contain `"secret"`.
- `app.test.ts` runs against the real `app`.
  - `GET /api/health` → 200, with `data.ok === true` and `data.db === true`.
  - `GET /api/hotels` → 200, with `data` an array. A hotel set to `isActive = false` inside the
    test is absent; the test restores it afterwards.
  - `POST /api/admin/hotels` → 401 `UNAUTHORIZED`, and the hotel count is unchanged.
  - `GET /api/nope` → 404 `NOT_FOUND`.
- `services/hotel.service.test.ts`:
  - Two `createHotel` calls with the same name give slugs `x` and `x-2`.
  - Two `createHotel` calls with the same new name, run concurrently via `Promise.all`, both
    succeed with distinct slugs. This exercises the `P2002` retry for real, with no mocks.
  - The test deletes its own rows, which carry a unique name prefix.
- There is no FE test runner, so the frontends are verified with `next-dev-loop`.
  - web lists the seeded hotels.
  - web-admin lists the seeded hotels, and the form shows the 401 message.
  - When the API is stopped, both show the error state, and `ApiStatus` shows the API as down.

## Skills to use during implementation

`prisma-client-api` (service + Prisma error mapping), `tanstack-query-best-practices` (key
factory, mutation invalidation), `next-dev-loop` (browser verification).
