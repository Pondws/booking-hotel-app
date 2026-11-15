"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BOOKING_TZ, todayIn, type AdminBookingListQuery } from "@booking/shared";
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

type View = { label: string; hint?: string; query: (today: string) => Partial<AdminBookingListQuery> };

/**
 * Front-desk work queues — preset list URLs, not a second copy of the page's filters (those stay on
 * the page). `from`/`to` match stays overlapping the range, so "today" = guests who should be here today.
 */
const VIEWS: View[] = [
  { label: "การจองทั้งหมด", query: () => ({}) },
  {
    label: "รอเช็คอินวันนี้",
    hint: "ยืนยันแล้ว ยังไม่เช็คอิน และช่วงเข้าพักครอบคลุมวันนี้",
    query: (today) => ({ status: "CONFIRMED", from: today, to: today }),
  },
  { label: "เข้าพักอยู่", hint: "เช็คอินแล้ว ยังไม่เช็คเอาท์", query: () => ({ status: "CHECKED_IN" }) },
  { label: "รอชำระเงิน", hint: "การจองที่ยังถือห้องไว้รอชำระ", query: () => ({ status: "PENDING" }) },
];

/** Sidebar second column for /bookings. */
export function BookingNavPanel() {
  return (
    <>
      <SidebarHeader className="border-b p-4">
        <h2 className="text-base font-medium text-foreground">การจอง</h2>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>งานหน้าเคาน์เตอร์</SidebarGroupLabel>
          <SidebarGroupContent>
            {/* useSearchParams needs a Suspense boundary; the fallback is the same links with nothing active */}
            <Suspense fallback={<ViewLinks current={null} />}>
              <ViewLinksFromUrl />
            </Suspense>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
}

function ViewLinksFromUrl() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Compare filters only — paging through a queue keeps it highlighted
  const current =
    pathname === "/bookings"
      ? serializeListParams({ ...parseListParams(searchParams), page: undefined, pageSize: undefined })
      : null;
  return <ViewLinks current={current} />;
}

function ViewLinks({ current }: { current: string | null }) {
  const { setOpenMobile } = useSidebar();
  const today = todayIn(BOOKING_TZ);
  return (
    <SidebarMenu>
      {VIEWS.map((view) => {
        const search = serializeListParams(view.query(today));
        const active = search === current;
        return (
          <SidebarMenuItem key={view.label}>
            <SidebarMenuButton asChild isActive={active} title={view.hint}>
              <Link
                href={`/bookings${search}`}
                onClick={() => setOpenMobile(false)}
                aria-current={active ? "page" : undefined}
              >
                {view.label}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
