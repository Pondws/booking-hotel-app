"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Button } from "@booking/ui/components/button";
import { useMe } from "../hooks";
import { isExplicitLogout, resetExplicitLogout } from "../logout-intent";

export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isPending, isError, refetch } = useMe();

  // A fresh mount starts clean (a stale flag from a logout elsewhere must not skip the redirect)
  useEffect(() => {
    resetExplicitLogout();
  }, []);

  useEffect(() => {
    if (user !== null) return;
    // Explicit logout always lands on a bare /login; any other session loss keeps the path in ?next
    router.replace(isExplicitLogout() ? "/login" : `/login?next=${encodeURIComponent(pathname)}`);
  }, [user, pathname, router]);

  if (isError) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-destructive">โหลดข้อมูลการเข้าสู่ระบบไม่สำเร็จ</p>
        <Button variant="outline" onClick={() => void refetch()}>
          ลองอีกครั้ง
        </Button>
      </div>
    );
  }
  if (isPending || user === null) {
    return <p className="py-10 text-center text-muted-foreground">กำลังโหลด…</p>;
  }
  return <>{children}</>;
}
