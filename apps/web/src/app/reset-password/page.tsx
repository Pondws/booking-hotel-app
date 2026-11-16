import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = { title: "ตั้งรหัสผ่านใหม่ · Booking Hotel" };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="ตั้งรหัสผ่านใหม่" description="ตั้งรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร">
      {/* The token is request data (search params) */}
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
