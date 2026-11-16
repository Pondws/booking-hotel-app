"use client";

import Link from "next/link";
import type { Role } from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import { useLogout, useMe } from "../hooks";
import { markExplicitLogout, resetExplicitLogout } from "../logout-intent";

const ROLE_LABELS: Record<Role, string> = { ADMIN: "ผู้ดูแลระบบ", STAFF: "พนักงาน", CUSTOMER: "ลูกค้า" };

/** Signed-in user's name (links to their account page), role and Log out — in the admin shell's sidebar footer. */
export function AdminUserBlock({ onNavigate }: { onNavigate?: () => void }) {
  const { data: user } = useMe();
  const logout = useLogout();

  if (!user) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/account"
          onClick={onNavigate}
          title="บัญชีของฉัน"
          className="truncate rounded-sm text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
        >
          {user.name}
        </Link>
        <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
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
        {logout.isPending ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}
      </Button>
    </div>
  );
}
