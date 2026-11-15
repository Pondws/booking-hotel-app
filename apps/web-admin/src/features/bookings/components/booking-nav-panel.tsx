"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ADMIN_BOOKING_STATUS_FILTERS, type AdminBookingStatusFilter } from "@booking/shared";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@booking/ui/components/sidebar";
import { parseListParams, serializeListParams } from "../list-params";
import { STAGE_LABELS } from "./booking-badges";

/** Sidebar second column for /bookings: one shortcut per status filter. */
export function BookingNavPanel() {
  return (
    <>
      <SidebarHeader className="border-b p-4">
        <h2 className="text-base font-medium text-foreground">การจอง</h2>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>สถานะ</SidebarGroupLabel>
          <SidebarGroupContent>
            {/* useSearchParams needs a Suspense boundary; the fallback is the same links with nothing active */}
            <Suspense fallback={<StatusLinks current={null} />}>
              <StatusLinksFromUrl />
            </Suspense>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
}

function StatusLinksFromUrl() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = pathname === "/bookings" ? parseListParams(searchParams).status : null;
  return <StatusLinks current={current} />;
}

function StatusLinks({ current }: { current: AdminBookingStatusFilter | null }) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      {ADMIN_BOOKING_STATUS_FILTERS.map((status) => (
        <SidebarMenuItem key={status}>
          <SidebarMenuButton asChild isActive={status === current}>
            <Link href={`/bookings${serializeListParams({ status })}`} onClick={() => setOpenMobile(false)}>
              {status === "all" ? "การจองทั้งหมด" : STAGE_LABELS[status]}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
