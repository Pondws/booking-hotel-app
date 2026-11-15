"use client";

import type { ReactNode } from "react";
import { useMe } from "@/features/auth/hooks";

/** Renders `children` for ADMIN only; STAFF get a no-permission note (the API 403s them anyway). */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  // RequireAuth already waited for `me`; null here only during sign-out
  if (!me) return null;
  if (me.role !== "ADMIN") {
    return <p className="text-sm text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>;
  }
  return children;
}
