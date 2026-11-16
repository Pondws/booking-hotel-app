import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ · Booking Hotel" };

export default function LoginPage() {
  return (
    <AuthShell title="เข้าสู่ระบบ" description="ยินดีต้อนรับกลับมา กรอกอีเมลและรหัสผ่านเพื่อดำเนินการต่อ">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
