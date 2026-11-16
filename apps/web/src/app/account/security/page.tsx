import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { Skeleton } from "@booking/ui/components/skeleton";
import { AccountSecurity } from "@/features/auth/components/account-security";
import { RequireAuth } from "@/features/auth/components/require-auth";

export const metadata: Metadata = { title: "ความปลอดภัยของบัญชี · Booking Hotel" };

export default function AccountSecurityPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <Link
          href="/account"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-4" />
          บัญชีของฉัน
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">โปรไฟล์และความปลอดภัย</h1>
      </div>
      <Suspense fallback={<FormsFallback />}>
        <RequireAuth>
          <AccountSecurity />
        </RequireAuth>
      </Suspense>
    </main>
  );
}

function FormsFallback() {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label="กำลังโหลด">
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
