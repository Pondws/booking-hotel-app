# Account security (Phase 8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users edit their own profile + password; ADMIN deactivates staff / resets their password; per-account login limit.

**Architecture:** New auth endpoints in `routes/auth.ts` → `auth.controller` → `auth.service` (profile/password). Staff status + reset under
`/api/admin/staff/:userId/*` → `admin-staff.service`. `User.isActive` checked in `login` and `resolveSession`. FE: TanStack hooks in
`features/auth` (web, web-admin) and `features/staff` (web-admin).

**Tech Stack:** Express 5, Prisma 7, zod v4, express-rate-limit, Next.js 16, TanStack Query, react-hook-form, shadcn (`@booking/ui`).

**Spec:** `docs/superpowers/specs/2026-11-16-account-security-design.md`

## Global Constraints
- No new dependencies. No `any`. Layering route → controller → service → prisma.
- Every password/session-wipe change in one `prisma.$transaction`.
- `passwordHash` never in any response (only `auth.service` opts in with `omit: { passwordHash: false }`).
- Error copy in English from the API, translated in each app's `lib/messages-th.ts`. UI copy Thai.
- One commit + push per task (memory: push every commit).

## Review Focus
- Change password with a wrong current password must not wipe sessions or change the hash → test in Task 1.
- A deactivated staff member's existing `admin_sid` gets 401 on the next `/api/admin/*` request → test in Task 2.
- A deactivated user logging in with the right password gets the same 401 body as a wrong password → test in Task 2.
- Per-account limit: email in different case / with spaces counts as the same account → test in Task 3.
- `PATCH /me` with `phone: ""` stores null; unknown keys (`role`, `email`) are ignored, never written → test in Task 1.

---

### Task 1 (8.1): API — profile + change password

**Files:** Modify `packages/shared/src/index.ts`, `apps/api/src/services/auth.service.ts`, `apps/api/src/controllers/auth.controller.ts`,
`apps/api/src/routes/auth.ts`; Test `apps/api/src/routes/auth.test.ts`

**Interfaces — Produces:**
- shared: `updateProfileSchema = z.object({ name, phone })` (same fields as `updateStaffSchema`; reuse its field helpers, moved above Auth),
  `UpdateProfileInput`/`UpdateProfileData`; `changePasswordSchema = z.object({ currentPassword: z.string().min(1,"Password is required").max(128), newPassword: registerSchema.shape.password })`, `ChangePasswordInput`.
- service: `updateProfile(userId, data): Promise<PublicUser>`; `changePassword(userId, sessionId, input): Promise<void>`
  — wrong current → `AppError(400,"VALIDATION_ERROR","Current password is incorrect", { formErrors: [], fieldErrors: { currentPassword: [msg] } })`;
  else `$transaction([user.update(passwordHash), session.deleteMany({ userId, id: { not: sessionId } })])`.
- routes: `PATCH /me`, `POST /me/password` (WEB) and `PATCH /admin/me`, `POST /admin/me/password` (ADMIN, + requireRole ADMIN/STAFF);
  password routes use `authLimiter`. PATCH → 200 PublicUser; password → 204.

- [ ] Tests: `PATCH /me updates name+phone, "" → null, ignores role`; `PATCH /me without cookie → 401`;
  `change password: wrong current → 400 fieldErrors.currentPassword, other session still works`;
  `change password: ok → 204, current session works, other WEB+ADMIN-less session → 401, login with new password works`;
  `PATCH /admin/me with sid (web cookie) → 401`.
- [ ] Run `npm test -w apps/api` → new tests fail; implement; rerun → pass. lint + typecheck.
- [ ] Commit `feat(api): edit own profile + change password (revokes other sessions)`, push.

### Task 2 (8.2): API — deactivate staff + reset password

**Files:** `apps/api/prisma/schema.prisma` (+ migration `user_is_active`), shared (`adminStaffSummarySchema.isActive: z.boolean()`,
`setStaffActiveSchema = z.object({ isActive: z.boolean() })`, `resetStaffPasswordSchema = z.object({ password: registerSchema.shape.password })`),
`auth.service.ts`, `admin-staff.service.ts`, `admin-staff.controller.ts`, `routes/admin/staff.ts`, `audit.service.ts` (`staffSnapshot` + `isActive`);
Test `routes/admin/staff.test.ts`

**Interfaces — Produces:**
- `User.isActive Boolean @default(true) @map("is_active")`.
- `login`: `!found || !valid || !found.isActive` → same 401. `resolveSession`: selects `user.isActive`; inactive → delete session, return null.
- `PATCH /api/admin/staff/:userId/status { isActive }` → `setStaffActive(actor, userId, isActive): Promise<AdminStaff>`;
  `userId === actor.id` → 409 CONFLICT "You can't deactivate your own account"; deactivate = `$transaction([user.updateMany({id, role:STAFF}), session.deleteMany({userId})])`; audit via `auditStaff`.
- `POST /api/admin/staff/:userId/password { password }` → `resetStaffPassword(actor, userId, password): Promise<void>` → 204;
  transaction update hash + delete all sessions; audit `recordAudit` with before `{ password: null }`, after `{ password: "reset" }`.

- [ ] Tests: deactivate → 200 `isActive:false`, staff's existing admin_sid → 401 on `/api/admin/hotels`; login → 401 same body as wrong password;
  reactivate → login works; STAFF caller → 403; reset password → old session 401, old password 401, new password 200; reset unknown id → 404.
- [ ] `npm run db:migrate -- --name user_is_active`, tests, lint, typecheck, `npm run db:check`.
- [ ] Commit `feat(api): deactivate staff accounts + admin password reset`, push.

### Task 3 (8.3): API — per-account login limit

**Files:** `apps/api/src/middleware/rate-limit.ts`, `routes/auth.ts`; Test `middleware/rate-limit.test.ts`

**Interfaces — Produces:** `createAccountLimiter(opts): RequestHandler` — `keyGenerator` = `"acct:" + String(req.body?.email ?? "").trim().toLowerCase()`
(skip when no email string), same 429 handler; `accountLimiter` (env `AUTH_RATE_LIMIT_*`) added after `authLimiter` on `/login` + `/admin/login`.
- [ ] Tests: limit 2 → third attempt for `A@x.com ` → 429 even from different IP keys; other email still passes.
- [ ] Commit `feat(api): per-account login rate limit`, push.

### Task 4 (8.4): web — profile + security pages

**Files:** `apps/web/src/features/auth/{api,hooks}.ts` (`updateProfile`, `changePassword`, `useUpdateProfile` → `setQueryData(authKeys.me())`,
`useChangePassword`), `features/auth/components/profile-form.tsx`, `change-password-form.tsx`, `app/account/page.tsx`, `app/account/security/page.tsx`,
`lib/messages-th.ts` ("Current password is incorrect" → "รหัสผ่านปัจจุบันไม่ถูกต้อง"). Confirm field compared client-side only.
- [ ] Browser check; lint + typecheck. Commit `feat(web): edit profile + change password on /account`, push.

### Task 5 (8.5): web-admin — own account + staff status/reset

**Files:** web-admin `features/auth` (same hooks for `/admin/me`), `app/(protected)/account/page.tsx`, link in `admin-shell.tsx`;
`features/staff` (`useSetStaffActive`, `useResetStaffPassword`, invalidate staff keys), staff list badge + detail page buttons / dialogs;
`messages-th.ts`. Also tick Phase 8 boxes in `PLAN.md` (forgot password → Phase 10).
- [ ] Browser check; lint + typecheck. Commit `feat(web-admin): own account page, deactivate + reset staff password`, push.
- [ ] Run `security-review` on the branch; fix findings.
