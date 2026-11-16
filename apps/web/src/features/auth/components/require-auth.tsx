"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@booking/ui/components/button";
import { useMe } from "../hooks";
import { isExplicitLogout, resetExplicitLogout } from "../logout-intent";

const noopSubscribe = () => () => {};

/**
 * False on the server and during hydration, true after. A Suspense boundary can hydrate after
 * `me` has already resolved (UserNav fetches it first), so gating on it keeps the first client
 * render equal to the server's "Loading…". Client-side navigations get `true` immediately.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const current = search ? `${pathname}?${search}` : pathname;
  const { data: user, isPending, isError, refetch } = useMe();

  // A fresh mount starts clean (a stale flag from a logout elsewhere must not skip the redirect)
  useEffect(() => {
    resetExplicitLogout();
  }, []);

  useEffect(() => {
    if (user !== null) return;
    // Explicit logout always lands home; any other session loss keeps the path in ?next
    router.replace(isExplicitLogout() ? "/" : `/login?next=${encodeURIComponent(current)}`);
  }, [user, current, router]);

  if (!hydrated) {
    return <p className="py-10 text-center text-muted-foreground">กำลังโหลด…</p>;
  }
  if (isError) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-destructive">โหลดข้อมูลการเข้าสู่ระบบไม่ได้</p>
        <Button variant="outline" onClick={() => void refetch()}>
          ลองใหม่
        </Button>
      </div>
    );
  }
  if (isPending || user === null) {
    return <p className="py-10 text-center text-muted-foreground">กำลังโหลด…</p>;
  }
  return <>{children}</>;
}
