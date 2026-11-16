# Phase 8 — บัญชีผู้ใช้ + ความปลอดภัยของ staff (design)

อนุมัติแล้ว 2026-11-16. Branch `feat/account-security` แตกจาก `feat/web-redesign` (ยังไม่ merge; มี `/account/security` placeholder)

## Intent
ผู้ใช้ทุกคนดูแลบัญชีตัวเองได้ และ ADMIN เอา staff ที่ลาออกออกจากระบบได้ทันที — ต้องเสร็จก่อน deploy (Phase 10)

## Approaches
- รหัสชั่วคราวตอนรีเซ็ต: (a) ADMIN พิมพ์เอง ← เลือก (ง่าย, ไม่ต้องแสดงรหัสครั้งเดียว) (b) server สุ่มแล้วคืนครั้งเดียว
- Rate limit ต่อบัญชี: (a) express-rate-limit memory store คีย์ด้วย email ← เลือก (ไม่มี dependency ใหม่)
  (b) ตารางนับครั้งที่ผิดใน DB (ทนการ restart/หลาย instance แต่ต้อง migration) — ทบทวนใน Phase 10
- ลืมรหัสผ่าน: ย้ายไป Phase 10 (ยังไม่มีผู้ให้บริการอีเมล, เรื่องที่ต้องตัดสินใจ #8)

## Design
### 8.1 API — โปรไฟล์ + เปลี่ยนรหัสผ่าน
- `PATCH /api/auth/me` (WEB) และ `PATCH /api/auth/admin/me` (ADMIN/STAFF): `{ name?, phone? }` (`phone: null` = ลบ) → `PublicUser`
- `POST /api/auth/me/password` และ `/api/auth/admin/me/password`: `{ currentPassword, newPassword }` ผ่าน `authLimiter`
  - รหัสเดิมผิด → 400 `VALIDATION_ERROR` + fieldErrors `currentPassword`
  - ใน `$transaction` เดียว: อัปเดต hash + ลบ session ทุก audience ของ user ยกเว้น session ปัจจุบัน → 204
- schema ใน `@booking/shared` (`updateProfileSchema`, `changePasswordSchema`; newPassword ใช้กฎเดียวกับ register)

### 8.2 API — ปิด/เปิดบัญชี + รีเซ็ตรหัส staff (ADMIN only)
- Migration: `User.isActive Boolean @default(true)`
- login: บัญชีปิด → 401 "Invalid email or password" (หลัง verify รหัสเสมอ เวลาเท่ากัน)
- `resolveSession`: user ไม่ active → ไม่รับ session (และลบทิ้ง)
- `PATCH /api/admin/staff/:userId/status { isActive }` (แยกจาก PATCH ชื่อ/เบอร์ ซึ่งรับทั้งก้อน); ปิด → ลบ session ทั้งหมดใน transaction เดียวกัน; ห้ามปิดตัวเอง (409 CONFLICT); audit STAFF
- `POST /api/admin/staff/:userId/password` `{ password }` → อัปเดต hash + ลบ session ทั้งหมด → 204; audit STAFF (field `password`, ไม่เก็บค่า)
- `AdminStaff` / summary มี `isActive`

### 8.3 API — rate limit login ต่อบัญชี
- limiter ตัวที่สองบน `/login` และ `/admin/login` คีย์ = email ที่ normalize (trim+lowercase) ค่าจาก `AUTH_RATE_LIMIT_*`
- ข้อเสียที่รับได้: คนอื่นล็อกบัญชีชั่วคราวได้; memory store รีเซ็ตเมื่อ restart

### 8.4 web
- `/account`: การ์ดแก้โปรไฟล์ (ชื่อ, เบอร์) → อัปเดต `authKeys.me()` cache
- `/account/security`: แทน `ComingSoon` ด้วยฟอร์มเปลี่ยนรหัสผ่าน (รหัสเดิม, ใหม่, ยืนยัน)

### 8.5 web-admin
- หน้า `/account` (โปรไฟล์ + เปลี่ยนรหัส) ลิงก์จาก AdminShell
- หน้า staff: badge สถานะ, ปุ่มปิด/เปิดบัญชี (confirm dialog), dialog รีเซ็ตรหัส

## Non-goals
- บังคับเปลี่ยนรหัสหลังรีเซ็ต, ลืมรหัสผ่าน, เปลี่ยน email, ปิดบัญชีลูกค้า

## เสร็จเมื่อ
- staff ที่ถูกปิดเรียก `/api/admin/*` ไม่ได้ตั้งแต่ request ถัดไป
- เปลี่ยน/รีเซ็ตรหัสแล้ว session เก่าบนเครื่องอื่นใช้ไม่ได้
- ไม่มี passwordHash ใน response ใด; ผ่าน `security-review`
