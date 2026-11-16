"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@booking/ui/components/button";
import { cn } from "@booking/ui/lib/utils";
import { AdminUserBlock } from "@/features/auth/components/admin-header";
import { useMe } from "@/features/auth/hooks";
import { ApiStatus } from "@/features/health/components/api-status";
import { NAV_ITEMS } from "./nav-items";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: me } = useMe();
  const items = NAV_ITEMS.filter((item) => !item.roles || (me != null && item.roles.includes(me.role)));
  return (
    <ul className="space-y-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "focus-visible:ring-sidebar-ring focus-visible:ring-2 focus-visible:outline-none",
                active && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="space-y-3 border-t border-sidebar-border p-4">
      <ApiStatus />
      <AdminUserBlock onNavigate={onNavigate} />
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      {/* md+: fixed sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:h-screen">
        <div className="px-4 py-4 font-semibold">ระบบจัดการโรงแรม</div>
        <nav aria-label="เมนูหลัก" className="flex-1 overflow-y-auto px-2">
          <NavLinks />
        </nav>
        <SidebarFooter />
      </aside>

      {/* below md: top bar + toggleable menu */}
      <div className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2">
          <span className="font-semibold">ระบบจัดการโรงแรม</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={menuOpen ? "ปิดเมนู" : "เปิดเมนู"}
            aria-expanded={menuOpen}
            aria-controls="admin-mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
          </Button>
        </div>
        {menuOpen && (
          <div id="admin-mobile-nav">
            <nav aria-label="เมนูหลัก" className="px-2 pb-2">
              <NavLinks onNavigate={() => setMenuOpen(false)} />
            </nav>
            <SidebarFooter onNavigate={() => setMenuOpen(false)} />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
