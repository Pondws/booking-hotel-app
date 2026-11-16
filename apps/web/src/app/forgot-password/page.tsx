import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "ลืมรหัสผ่าน · Booking Hotel" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="ลืมรหัสผ่าน" description="กรอกอีเมลที่ใช้สมัคร แล้วเราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
