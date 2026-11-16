import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { RequireAuth } from "@/features/auth/components/require-auth";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    // RequireAuth reads the pathname (request data on dynamic routes), so it must render inside Suspense —
    // otherwise prerendering e.g. /amenities/[amenityId] fails. Same "Loading…" as RequireAuth's own pending state.
    <Suspense fallback={<p className="py-10 text-center text-muted-foreground">กำลังโหลด…</p>}>
      <RequireAuth>
        <AdminShell>{children}</AdminShell>
      </RequireAuth>
    </Suspense>
  );
}
