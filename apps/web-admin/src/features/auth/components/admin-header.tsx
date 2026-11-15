"use client";

import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import { useLogout, useMe } from "../hooks";
import { markExplicitLogout, resetExplicitLogout } from "../logout-intent";

/** Signed-in user's name, role and Log out — shown in the admin shell's sidebar footer. */
export function AdminUserBlock() {
  const { data: user } = useMe();
  const logout = useLogout();

  if (!user) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{user.name}</span>
        <Badge variant="secondary">{user.role}</Badge>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={logout.isPending}
        onClick={() => {
          markExplicitLogout();
          // Navigation is handled by RequireAuth: this component unmounts once `me` is cleared
          logout.mutate(undefined, { onError: resetExplicitLogout });
        }}
      >
        {logout.isPending ? "Logging out…" : "Log out"}
      </Button>
    </div>
  );
}
