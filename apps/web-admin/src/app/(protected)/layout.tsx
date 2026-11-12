import type { ReactNode } from "react";
import { AdminHeader } from "@/features/auth/components/admin-header";
import { RequireAuth } from "@/features/auth/components/require-auth";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AdminHeader />
      {children}
    </RequireAuth>
  );
}
