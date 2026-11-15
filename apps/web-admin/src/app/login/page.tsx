import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@booking/ui/components/card";
import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-sm px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>เข้าสู่ระบบหลังบ้าน</CardTitle>
          <CardDescription>สำหรับพนักงานและผู้ดูแลระบบเท่านั้น</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
