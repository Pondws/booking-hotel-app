# Auth & Roles (Phase 2) — Design

Date: 2026-11-12
Status: Approved in chat, awaiting written-spec review
Roadmap: `PLAN.md` Phase 2

## Goal

Customers register and log in on `apps/web`. Staff and admins log in on `apps/web-admin`. The API
enforces every role check. Session cookies are backed by a `Session` table. The web and admin apps
use separate cookies, so a customer-site session can never call `/api/admin/*`.

## Decisions

| Topic | Decision |
| --- | --- |
| Mechanism | Opaque session token in an httpOnly cookie. Only `sha256(token)` is stored in `Session` |
| Cookies | Web uses `sid` with audience `WEB`. Admin uses `admin_sid` with audience `ADMIN`. A session only works for its own audience |
| Lifetime | WEB 30 days, ADMIN 12 hours. Expiry is fixed (no sliding renewal) |
| Cookie flags | `httpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` when `NODE_ENV=production`. `maxAge` = lifetime |
| CSRF | No token. Protection comes from `SameSite=Lax`, the CORS origin allow-list with credentials, and JSON-only bodies |
| Rate limit | `express-rate-limit` (new dependency, approved) on register, login and admin login. 10 requests per 15 min per IP, configurable via `AUTH_RATE_LIMIT_MAX`. Over the limit returns 429 `RATE_LIMITED` |
| Forms | `react-hook-form` + `@hookform/resolvers` (new dependencies in both apps, approved). Every form uses them, including the existing `CreateHotelForm` |
| Route protection (FE) | A client-side guard reads `useMe()`. There is no Next.js proxy, because it can't read API cookies once the API and web run on different domains |
| Hotel creation | `POST /api/admin/hotels` is **ADMIN only**. STAFF gets 403 |
| Cookie parsing | A small `readCookie(req, name)` helper. No `cookie-parser` dependency |
| Out of scope | OAuth, password reset, email verification, a staff-user admin UI (Phase 6), "log out all devices", and the API lint script |

## Schema (additive migration `auth_sessions`)

```prisma
enum SessionAudience { WEB ADMIN }

model Session {
  id        String          @id @default(cuid())
  tokenHash String          @unique @map("token_hash")
  userId    String          @map("user_id")
  audience  SessionAudience
  expiresAt DateTime        @map("expires_at")
  userAgent String?         @map("user_agent")
  ip        String?
  createdAt DateTime        @default(now()) @map("created_at")
  updatedAt DateTime        @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("sessions")
}
```
`User` also gets `sessions Session[]`.

## Shared (`packages/shared`)

- `roleSchema = z.enum(["CUSTOMER", "STAFF", "ADMIN"])`.
- `publicUserSchema = z.object({ id, email, name, phone: z.string().nullable(), role: roleSchema })`, plus `type PublicUser`.
- `registerSchema`:
  - `email`: `z.email()`, trimmed and lowercased.
  - `password`: `z.string().min(8).max(128)`.
  - `name`: trimmed, 1–120 characters.
- `loginSchema`: `{ email` (trimmed and lowercased, `z.email()`), `password: z.string().min(1).max(128) }`.
- `errorCodeSchema` gains `RATE_LIMITED`.

## API (`apps/api/src`)

| File | Responsibility |
| --- | --- |
| `lib/session-token.ts` | `generateToken(): string` (32 random bytes, base64url) and `hashToken(token): string` (sha256 hex) |
| `lib/cookies.ts` | `readCookie(req, name): string \| undefined`; `COOKIE = { WEB: "sid", ADMIN: "admin_sid" }`; `setSessionCookie(res, audience, token, maxAgeMs)`; `clearSessionCookie(res, audience)` |
| `services/auth.service.ts` | `register(input, meta)`, `login(input, audience, meta)`, `logout(sessionId)`, `resolveSession(token, audience)`. These are the only auth code that touches prisma. User reads use `publicUserSelect`. Only `login` reads `passwordHash`, via `omit: { passwordHash: false }` |
| `services/hotel-access.service.ts` | `canAccessHotel(user, hotelId): Promise<boolean>`. ADMIN → true. STAFF → whether a `HotelStaff` row exists. Anyone else → false |
| `controllers/auth.controller.ts` | Thin handlers for the endpoints below. They set or clear cookies and respond with `ok()` / `noContent()` |
| `middleware/load-session.ts` | `loadSession(audience): RequestHandler`. Reads the cookie and calls `resolveSession`. On success it sets `req.auth = { user: PublicUser, sessionId }`. If there is no cookie, or the session is unknown, expired or for the wrong audience, `req.auth` stays undefined. Expired rows are deleted. It never throws for a missing session |
| `middleware/require-auth.ts` | `requireAuth`: 401 `UNAUTHORIZED` "Authentication required" when `req.auth` is missing |
| `middleware/require-role.ts` | Same signature as Phase 1. No `req.auth` → 401 "Authentication required". Role not in the list → 403 `FORBIDDEN` "Insufficient permissions" |
| `middleware/require-hotel-access.ts` | `requireHotelAccess(param = "hotelId")` → 403 "No access to this hotel" when `canAccessHotel` is false. It is built and tested now, and first used in Phase 6 |
| `middleware/rate-limit.ts` | `createAuthLimiter({ limit, windowMs })`. Its handler calls `next(new AppError(429, "RATE_LIMITED", "Too many attempts, try again later"))`. `authLimiter` uses the env values |
| `types/express.d.ts` | Declaration merging: `Request.auth?: { user: PublicUser; sessionId: string }` |
| `routes/auth.ts` | Mounted at `/api/auth` (see the endpoints below) |
| `routes/admin/index.ts` | `router.use(loadSession("ADMIN"), requireRole("ADMIN", "STAFF"))` |
| `routes/admin/hotels.ts` | `POST /` → `requireRole("ADMIN")` → `validate` → `createHotel` |
| `env.ts` | Adds `AUTH_RATE_LIMIT_MAX` (int, default 10) and `AUTH_RATE_LIMIT_WINDOW_MS` (default 900000). Both go in `.env.example` |
| `middleware/error-handler.ts` | Adds body-parser errors with a numeric `status`/`statusCode` in the 4xx range (`entity.too.large` → 413, `encoding.unsupported`/`charset.unsupported` → 415). They map to `VALIDATION_FAILED` with that status (carry-over from Phase 1) |
| `controllers/hotel.controller.ts` | Types the handler as `Request<ParamsDictionary, unknown, CreateHotelData>` instead of casting `req.body` (carry-over from Phase 1) |

### Endpoints (`/api/auth`)

| Method + path | Behaviour |
| --- | --- |
| `POST /register` (rate-limited) | `registerSchema`. Creates a CUSTOMER and a WEB session, and sets `sid`. Returns 201 `{ data: PublicUser }`. A duplicate email returns 409 `CONFLICT` "Email already registered" |
| `POST /login` (rate-limited) | `loginSchema`. On success creates a WEB session (any role), sets `sid`, and returns 200 `{ data: PublicUser }`. On failure returns 401 "Invalid email or password". An unknown email still runs `verifyPassword` against a fixed dummy hash, so both failure paths take about the same time and return identical bodies |
| `POST /logout` | Uses `loadSession("WEB")`. Deletes the session if one is present and clears `sid`. Always returns 204 |
| `GET /me` | `loadSession("WEB")` → `requireAuth` → 200 `{ data: PublicUser }` |
| `POST /admin/login` (rate-limited) | Like `/login` but with audience ADMIN and the `admin_sid` cookie. Correct credentials for a CUSTOMER return 403 `FORBIDDEN` "Staff access only", and no session is created |
| `POST /admin/logout`, `GET /admin/me` | Like `/logout` and `/me`, using ADMIN / `admin_sid` |

Session `ip` comes from `req.ip`, and `userAgent` from the `User-Agent` header truncated to 255
characters.

## Frontend

### Both apps
- `features/auth/api.ts`: `fetchMe(): Promise<PublicUser | null>` (an `ApiError` with status 401 → `null`), `login(input)` and `logout()`. Web also has `register(input)`. Admin calls the `/api/auth/admin/*` paths.
- `features/auth/hooks.ts`:
  - `authKeys = { all: ["auth"], me: () => [...authKeys.all, "me"] }`.
  - `useMe()` (`staleTime` 5 min).
  - `useLogin()` / `useRegister()`, whose `onSuccess` calls `setQueryData(authKeys.me(), user)`.
  - `useLogout()`: `setQueryData(authKeys.me(), null)`, then `removeQueries` for everything except `authKeys.all`.
- `features/auth/components/require-auth.tsx`: while `useMe` is pending, render a loading state. When it resolves to `null`, `router.replace("/login?next=<current path>")`. Otherwise render the children.
- `app/providers.tsx`: `QueryCache({ onError })` → if the error is an `ApiError` with status 401 and is not from the `me` query, `setQueryData(authKeys.me(), null)`.
- Login redirect target: `next` is accepted only when it starts with `/` and not `//`. Otherwise the target is `/`.
- All forms use react-hook-form + `zodResolver` with the shared schemas. Server `VALIDATION_FAILED` `details.fieldErrors` are mapped onto fields with `setError`. Other `ApiError`s show their `message`. A 429 shows "Too many attempts, try again later".

### web
- `app/login/page.tsx`, `app/register/page.tsx`: the forms, with links to each other.
- `app/account/page.tsx`: wrapped in `RequireAuth`. Shows name, email and role.
- `features/auth/components/user-nav.tsx`: added to the header in `layout.tsx`. Shows "Log in" and "Register" links, or the user's name, an "Account" link and a "Log out" button.

### web-admin
- `app/login/page.tsx`: the admin login form. A 403 shows "Staff access only".
- `app/(protected)/layout.tsx`: wraps every other admin page in `RequireAuth` and renders a header with the name, a role `Badge` and a "Log out" button. `app/page.tsx` moves into `(protected)/`.
- `CreateHotelForm` is rewritten on react-hook-form and rendered only when `me.role === "ADMIN"`. The API enforces the same rule.

## Testing (API, node:test + supertest, real dev DB)

Fixtures:
- Seeded `admin@booking.local`, `staff@booking.local` (assigned to Riverside Bangkok) and `customer@booking.local`, all with password `Password123!`. These are read-only.
- Users created by tests use emails `auth-test+<timestamp>-<n>@test.local` and are deleted in `after()`. Their sessions cascade.
- Sessions created for seed users are deleted by id in `after()`.
- The test script sets `AUTH_RATE_LIMIT_MAX=1000`, so the suite never trips the limiter.

Cases:
- Unit: `generateToken` gives a 43-character base64url string. `hashToken` is deterministic, 64 hex characters, and differs from the token. `readCookie` handles a missing header, several cookies, and URL-encoded values.
- Register:
  - Returns 201, with a `Set-Cookie` header for `sid` that contains `HttpOnly` and `SameSite=Lax`.
  - `GET /me` with that cookie returns the user. No response body contains `passwordHash`.
  - Registering the same email again returns 409.
  - An invalid body returns 400 with `fieldErrors`.
- Login:
  - Wrong password and unknown email return identical 401 bodies.
  - Logging out returns 204, `/me` then returns 401, and the session row is gone.
- Admin login:
  - The customer gets 403 and no session row is created.
  - Staff and admin get an `admin_sid` cookie.
- Audience isolation:
  - `sid` sent to `GET /api/admin/...` returns 401.
  - `admin_sid` sent to `GET /api/auth/me` returns 401.
- `POST /api/admin/hotels`:
  - No cookie returns 401.
  - Staff returns 403 "Insufficient permissions".
  - Admin returns 201. The hotel is created with the `App Test` prefix and cleaned up afterwards.
- Expiry: a session row with `expiresAt` in the past returns 401, and the row is deleted.
- `requireHotelAccess` (throwaway express app):
  - Staff assigned to the hotel passes.
  - Staff on another hotel gets 403.
  - Admin passes.
  - No auth gets 401.
- Rate limit: a throwaway app with `createAuthLimiter({ limit: 2 })` returns 429 `RATE_LIMITED` on the 3rd request.
- Body parser: a JSON body over 100kb sent to `POST /api/auth/login` returns 413 with the error envelope.

Frontend: there is no runner. Use the manual browser checklist delivered at the end of the phase,
the same as Phase 1.

## Skills to use during implementation

- `prisma-cli` (migration)
- `prisma-client-api`
- `shadcn`
- `tanstack-query-best-practices`
- `impeccable` (auth pages)
- `next-dev-loop`
- **`security-review` before merge (mandatory)**
