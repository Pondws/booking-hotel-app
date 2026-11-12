"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import { useLogout, useMe } from "../hooks";
import { markExplicitLogout, resetExplicitLogout } from "../logout-intent";

export function AdminHeader() {
  const router = useRouter();
  const { data: user } = useMe();
  const logout = useLogout();

  return (
    <div className="border-b">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <span className="font-semibold">Booking Admin</span>
        {user && (
          <nav className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
            <Badge variant="secondary">{user.role}</Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={logout.isPending}
              onClick={() => {
                markExplicitLogout();
                logout.mutate(undefined, {
                  onSuccess: () => router.replace("/login"),
                  onError: resetExplicitLogout,
                });
              }}
            >
              Log out
            </Button>
          </nav>
        )}
      </div>
    </div>
  );
}
