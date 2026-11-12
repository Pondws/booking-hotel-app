"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
      <nav className="flex items-center gap-2">
        <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Log in
        </Link>
        <Link href="/register" className={buttonVariants({ size: "sm" })}>
          Register
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-2">
      <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
      <Link href="/account" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        Account
      </Link>
      <Button
        variant="outline"
        size="sm"
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
        Log out
      </Button>
    </nav>
  );
}
