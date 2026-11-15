"use client";

import { ChevronsUpDown, LogOut } from "lucide-react";
import type { Role } from "@booking/shared";
import { Avatar, AvatarFallback } from "@booking/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@booking/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@booking/ui/components/sidebar";
import { useLogout, useMe } from "../hooks";
import { markExplicitLogout, resetExplicitLogout } from "../logout-intent";

const ROLE_LABELS: Record<Role, string> = { ADMIN: "ผู้ดูแลระบบ", STAFF: "พนักงาน", CUSTOMER: "ลูกค้า" };

/** Signed-in user + Log out, at the bottom of the sidebar's icon rail. */
export function NavUser() {
  const { data: user } = useMe();
  const logout = useLogout();
  const { isMobile } = useSidebar();

  if (!user) return null;
  const initial = user.name.trim().charAt(0).toUpperCase() || "?";
  const identity = (
    <>
      <Avatar className="size-8 rounded-lg">
        <AvatarFallback className="rounded-lg">{initial}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{user.name}</span>
        <span className="truncate text-xs">{ROLE_LABELS[user.role]}</span>
      </div>
    </>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label={`บัญชีผู้ใช้: ${user.name}`}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground md:h-8 md:p-0"
            >
              {identity}
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5">{identity}</div>
              <p className="truncate px-1 pb-1.5 text-xs text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={logout.isPending}
                onSelect={() => {
                  markExplicitLogout();
                  // Navigation is handled by RequireAuth: the shell unmounts once `me` is cleared
                  logout.mutate(undefined, { onError: resetExplicitLogout });
                }}
              >
                <LogOut />
                {logout.isPending ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
