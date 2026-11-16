import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = { title: "สมัครสมาชิก · Booking Hotel" };

export default function RegisterPage() {
  return (
    <AuthShell title="สร้างบัญชีใหม่" description="สมัครสมาชิกเพื่อจองห้องพักและจัดการการเข้าพักของคุณ">
      <RegisterForm />
    </AuthShell>
  );
}
