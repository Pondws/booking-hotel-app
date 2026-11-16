"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, LogOut, UserRound } from "lucide-react";
import { Button, buttonVariants } from "@booking/ui/components/button";
import { useLogout, useMe } from "../hooks";
import { markExplicitLogout, resetExplicitLogout } from "../logout-intent";

export function UserNav() {
  const router = useRouter();
  const { data: user, isPending } = useMe();
  const logout = useLogout();

  if (isPending) return <div className="h-8 w-32" aria-hidden />;

  if (!user) {
    return (
      <nav aria-label="บัญชีผู้ใช้" className="flex items-center gap-2">
        <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          เข้าสู่ระบบ
        </Link>
        <Link href="/register" className={buttonVariants({ size: "sm" })}>
          สมัครสมาชิก
        </Link>
      </nav>
    );
  }

  return (
    <nav aria-label="บัญชีผู้ใช้" className="flex items-center gap-1">
      <Link
        href="/account/bookings"
        aria-label="การจองของฉัน"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <CalendarCheck aria-hidden className="size-4" />
        <span className="hidden sm:inline">การจองของฉัน</span>
      </Link>
      <Link
        href="/account"
        aria-label={`บัญชีของ ${user.name}`}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <UserRound aria-hidden className="size-4" />
        <span className="hidden max-w-32 truncate lg:inline">{user.name}</span>
      </Link>
      <Button
        variant="outline"
        size="sm"
        aria-label="ออกจากระบบ"
        disabled={logout.isPending}
        onClick={() => {
          markExplicitLogout();
          // On a protected page RequireAuth already redirects to "/"; this covers public pages
          // (same target, so the two never race to different places).
          logout.mutate(undefined, {
            onSuccess: () => router.replace("/"),
            onError: resetExplicitLogout,
          });
        }}
      >
        <LogOut aria-hidden className="size-4" />
        <span className="hidden sm:inline">ออกจากระบบ</span>
      </Button>
    </nav>
  );
}
