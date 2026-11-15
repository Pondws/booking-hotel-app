"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@booking/ui/components/button";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "@booking/ui/components/sidebar";
import { cn } from "@booking/ui/lib/utils";
import { isActivePath } from "@/lib/is-active-path";
import { useAdminHotels } from "../hooks";
import { serializeListParams } from "../list-params";

/** The API's max page size; past this the panel links to the full list. */
const PANEL_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 300;

/** Sidebar second column for /hotels: search + every hotel the user can manage. */
export function HotelNavPanel() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isPending, isError, isPlaceholderData, refetch } = useAdminHotels({
    q: q || undefined,
    status: "all",
    page: 1,
    pageSize: PANEL_LIMIT,
  });
  const closeMobile = () => setOpenMobile(false);

  let body;
  if (isPending) {
    body = (
      <SidebarMenu aria-busy>
        {Array.from({ length: 5 }, (_, i) => (
          <SidebarMenuItem key={i}>
            <SidebarMenuSkeleton />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    );
  } else if (isError) {
    body = (
      <div className="flex flex-col gap-2 px-2 text-sm">
        <p className="text-muted-foreground">โหลดรายชื่อโรงแรมไม่สำเร็จ</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          ลองอีกครั้ง
        </Button>
      </div>
    );
  } else if (data.items.length === 0) {
    body = (
      <div className="flex flex-col gap-2 px-2 text-sm">
        <p className="text-muted-foreground">{q ? "ไม่พบโรงแรมที่ตรงกับคำค้น" : "ยังไม่มีโรงแรม"}</p>
        {q && (
          <Button variant="outline" size="sm" onClick={() => setSearch("")}>
            ล้างคำค้น
          </Button>
        )}
      </div>
    );
  } else {
    body = (
      <SidebarMenu aria-busy={isPlaceholderData} className={cn(isPlaceholderData && "opacity-60")}>
        {data.items.map((hotel) => {
          const href = `/hotels/${hotel.id}`;
          return (
            <SidebarMenuItem key={hotel.id}>
              <SidebarMenuButton asChild size="lg" isActive={isActivePath(pathname, href)}>
                <Link href={href} onClick={closeMobile}>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{hotel.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {hotel.city}
                      {!hotel.isActive && " · ปิดใช้งาน"}
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
        {data.total > data.items.length && (
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="text-muted-foreground">
              <Link href={`/hotels${serializeListParams({ q })}`} onClick={closeMobile}>
                ดูทั้งหมด {data.total} แห่ง
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    );
  }

  return (
    <>
      <SidebarHeader className="gap-3 border-b p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-medium text-foreground">โรงแรม</h2>
          <Button asChild variant="ghost" size="icon-sm">
            <Link href="/hotels/new" onClick={closeMobile} aria-label="เพิ่มโรงแรม" title="เพิ่มโรงแรม">
              <Plus aria-hidden />
            </Link>
          </Button>
        </div>
        <SidebarInput
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อหรือเมือง…"
          aria-label="ค้นหาโรงแรม"
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/hotels"}>
                  <Link href="/hotels" onClick={closeMobile}>
                    โรงแรมทั้งหมด
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="pt-0">
          <SidebarGroupContent>{body}</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
}
