"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { Button } from "@booking/ui/components/button";
import { Skeleton } from "@booking/ui/components/skeleton";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "@booking/ui/components/sidebar";
import { cn } from "@booking/ui/lib/utils";
import { serializeListParams as serializeBookingParams } from "@/features/bookings/list-params";
import { useRoomTypes } from "@/features/room-types/hooks";
import { isActivePath } from "@/lib/is-active-path";
import { useAdminHotel, useAdminHotels } from "../hooks";

/** The API's max page size; past this the switcher links to the full list. */
const SWITCHER_LIMIT = 50;

/**
 * Sidebar second column for /hotels. Inside a hotel it's that hotel's menu (details, room types, its
 * bookings); otherwise a compact hotel switcher. Searching and filtering stay on the /hotels table.
 */
export function HotelNavPanel() {
  const { hotelId } = useParams<{ hotelId?: string }>();
  return hotelId ? <HotelMenu hotelId={hotelId} /> : <HotelSwitcher />;
}

function useCloseMobile() {
  const { setOpenMobile } = useSidebar();
  return () => setOpenMobile(false);
}

function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-2 px-2 text-sm">
      <p className="text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        ลองอีกครั้ง
      </Button>
    </div>
  );
}

function MenuSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <SidebarMenu aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <SidebarMenuItem key={i}>
          <SidebarMenuSkeleton />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  const closeMobile = useCloseMobile();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active}>
        <Link href={href} onClick={closeMobile} aria-current={active ? "page" : undefined}>
          {children}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ---------- No hotel selected: switcher ----------

function HotelSwitcher() {
  const pathname = usePathname();
  const closeMobile = useCloseMobile();
  const { data, isPending, isError, refetch } = useAdminHotels({
    status: "all",
    page: 1,
    pageSize: SWITCHER_LIMIT,
  });

  let body: ReactNode;
  if (isPending) body = <MenuSkeleton />;
  else if (isError) body = <PanelError message="โหลดรายชื่อโรงแรมไม่สำเร็จ" onRetry={() => void refetch()} />;
  else if (data.items.length === 0) body = <p className="px-2 text-sm text-muted-foreground">ยังไม่มีโรงแรม</p>;
  else
    body = (
      <SidebarMenu>
        {data.items.map((hotel) => (
          <NavLink key={hotel.id} href={`/hotels/${hotel.id}`} active={false}>
            <span className="truncate">{hotel.name}</span>
            {!hotel.isActive && <span className="ml-auto text-xs text-muted-foreground">ปิด</span>}
          </NavLink>
        ))}
        {data.total > data.items.length && (
          <NavLink href="/hotels" active={false}>
            <span className="text-muted-foreground">ดูทั้งหมด {data.total} แห่ง</span>
          </NavLink>
        )}
      </SidebarMenu>
    );

  return (
    <>
      <SidebarHeader className="border-b p-4">
        <h2 className="text-base font-medium text-foreground">โรงแรม</h2>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavLink href="/hotels" active={pathname === "/hotels"}>
                โรงแรมทั้งหมด
              </NavLink>
              <NavLink href="/hotels/new" active={pathname === "/hotels/new"}>
                <Plus />
                เพิ่มโรงแรม
              </NavLink>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel asChild>
            <Link href="/hotels" onClick={closeMobile}>
              สลับโรงแรม
            </Link>
          </SidebarGroupLabel>
          <SidebarGroupContent>{body}</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
}

// ---------- Inside a hotel: its menu ----------

function HotelMenu({ hotelId }: { hotelId: string }) {
  const pathname = usePathname();
  const closeMobile = useCloseMobile();
  const hotel = useAdminHotel(hotelId);
  const roomTypes = useRoomTypes(hotelId);
  const base = `/hotels/${hotelId}`;

  let roomTypeBody: ReactNode;
  if (roomTypes.isPending) roomTypeBody = <MenuSkeleton rows={3} />;
  else if (roomTypes.isError)
    roomTypeBody = <PanelError message="โหลดประเภทห้องไม่สำเร็จ" onRetry={() => void roomTypes.refetch()} />;
  else if (roomTypes.data.length === 0)
    roomTypeBody = <p className="px-2 text-sm text-muted-foreground">ยังไม่มีประเภทห้อง</p>;
  else
    roomTypeBody = (
      <SidebarMenu>
        {roomTypes.data.map((rt) => {
          const href = `${base}/room-types/${rt.id}`;
          return (
            <NavLink key={rt.id} href={href} active={isActivePath(pathname, href)}>
              <span className="truncate">{rt.name}</span>
              <span className={cn("ml-auto text-xs", !rt.isActive && "text-muted-foreground")}>
                {rt.isActive ? `${rt.activeRoomCount} ห้อง` : "ปิด"}
              </span>
            </NavLink>
          );
        })}
      </SidebarMenu>
    );

  return (
    <>
      <SidebarHeader className="gap-2 border-b p-4">
        <Link
          href="/hotels"
          onClick={closeMobile}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3" aria-hidden />
          โรงแรมทั้งหมด
        </Link>
        {hotel.isPending ? (
          <Skeleton className="h-6 w-40" />
        ) : hotel.isError ? (
          <h2 className="text-base font-medium text-foreground">ไม่พบโรงแรม</h2>
        ) : (
          <div className="min-w-0">
            <h2 className="truncate text-base font-medium text-foreground">{hotel.data.name}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {hotel.data.city}
              {!hotel.data.isActive && " · ปิดใช้งาน"}
            </p>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavLink href={base} active={pathname === base}>
                ข้อมูลโรงแรม
              </NavLink>
              <NavLink href={`/bookings${serializeBookingParams({ hotelId })}`} active={false}>
                การจองของโรงแรมนี้
              </NavLink>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>ประเภทห้อง</SidebarGroupLabel>
          <SidebarGroupAction asChild title="เพิ่มประเภทห้อง">
            <Link href={`${base}/room-types/new`} onClick={closeMobile} aria-label="เพิ่มประเภทห้อง">
              <Plus />
            </Link>
          </SidebarGroupAction>
          <SidebarGroupContent>{roomTypeBody}</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
}
