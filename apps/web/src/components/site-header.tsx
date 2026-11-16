import Link from "next/link";
import { BedDouble, Heart } from "lucide-react";
import { buttonVariants } from "@booking/ui/components/button";
import { UserNav } from "@/features/auth/components/user-nav";
import { MAIN_NAV } from "./nav-links";

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <BedDouble aria-hidden className="size-5" />
      </span>
      <span className="text-lg">Booking Hotel</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 py-3">
        <Logo />
        <nav aria-label="เมนูหลัก" className="hidden items-center gap-1 md:flex">
          {MAIN_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/wishlist"
            aria-label="รายการโปรด"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
          >
            <Heart aria-hidden className="size-4" />
          </Link>
          <UserNav />
        </div>
      </div>
      {/* Phones: the main links scroll sideways under the logo row */}
      <nav aria-label="เมนูหลัก (มือถือ)" className="border-t md:hidden">
        <ul className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 py-1.5">
          {MAIN_NAV.map((item) => (
            <li key={item.href} className="shrink-0">
              <Link href={item.href} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
