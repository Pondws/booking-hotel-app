"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Hotel } from "lucide-react";
import { Separator } from "@booking/ui/components/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@booking/ui/components/sidebar";
import { NavUser } from "@/features/auth/components/nav-user";
import { ApiStatus } from "@/features/health/components/api-status";
import { isActivePath } from "@/lib/is-active-path";
import { NAV_ITEMS, type NavItem } from "./nav-items";

const APP_NAME = "ระบบจัดการโรงแรม";

/**
 * Collapsible nested sidebars (shadcn sidebar-09): an icon rail of sections + a second column with the
 * active section's panel. Collapsing (trigger, Ctrl/⌘+B) leaves just the rail; below md it's a sheet.
 */
function AdminSidebar({ active }: { active: NavItem }) {
  const { setOpen } = useSidebar();
  const Panel = active.panel;

  return (
    <Sidebar collapsible="icon" className="overflow-hidden">
      <div className="flex h-full w-full overflow-hidden">
        {/* Icon rail — never collapses itself */}
        <Sidebar collapsible="none" className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  size="lg"
                  className="md:h-8 md:p-0"
                  tooltip={{ children: APP_NAME, hidden: false }}
                >
                  <Link href="/">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <Hotel className="size-4" aria-hidden />
                    </div>
                    <span className="truncate font-semibold">{APP_NAME}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent className="px-1.5 md:px-0">
                <nav aria-label="เมนูหลัก">
                  <SidebarMenu>
                    {NAV_ITEMS.map((item) => {
                      const isCurrent = item.href === active.href;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            asChild
                            isActive={isCurrent}
                            tooltip={{ children: item.label, hidden: false }}
                            className="px-2.5 md:px-2"
                          >
                            {/* Opening a section also re-expands a collapsed sidebar to show its panel */}
                            <Link
                              href={item.href}
                              onClick={() => setOpen(true)}
                              aria-current={isCurrent ? "page" : undefined}
                            >
                              <item.icon />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </nav>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <NavUser />
          </SidebarFooter>
        </Sidebar>

        {/* Section panel — fills the rest; hidden when collapsed to the rail */}
        <Sidebar collapsible="none" className="min-w-0 flex-1">
          <Panel />
          <SidebarFooter className="border-t p-4">
            <ApiStatus />
          </SidebarFooter>
        </Sidebar>
      </div>
    </Sidebar>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = NAV_ITEMS.find((item) => isActivePath(pathname, item.href)) ?? NAV_ITEMS[0];

  return (
    // `!` so the class beats the provider's inline default width
    <SidebarProvider className="[--sidebar-width:20rem]!">
      <AdminSidebar active={active} />
      <div className="relative flex w-full min-w-0 flex-1 flex-col bg-background">
        <header className="sticky top-0 z-10 flex shrink-0 items-center gap-2 border-b bg-background px-4 py-3">
          <SidebarTrigger className="-ml-1" aria-label="เปิด/ปิดแถบเมนู" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <span className="text-sm font-medium">{active.label}</span>
        </header>
        {children}
      </div>
    </SidebarProvider>
  );
}
