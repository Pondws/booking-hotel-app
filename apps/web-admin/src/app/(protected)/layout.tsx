import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { RequireAuth } from "@/features/auth/components/require-auth";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AdminShell>{children}</AdminShell>
    </RequireAuth>
  );
}
