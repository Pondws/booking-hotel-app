"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Button } from "@booking/ui/components/button";
import { useMe } from "../hooks";

export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isPending, isError, refetch } = useMe();

  useEffect(() => {
    if (user === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [user, pathname, router]);

  if (isError) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-destructive">Could not load your session.</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (isPending || user === null) {
    return <p className="py-10 text-center text-muted-foreground">Loading…</p>;
  }
  return <>{children}</>;
}
