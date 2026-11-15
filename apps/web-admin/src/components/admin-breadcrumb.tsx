"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@booking/ui/components/breadcrumb";
import { Skeleton } from "@booking/ui/components/skeleton";
import { useAdminHotel } from "@/features/hotels/hooks";
import { useRoomType } from "@/features/room-types/hooks";

/** A crumb's label; `undefined` = still loading (names come from the queries the page already runs). */
type Crumb = { label: string | undefined; href?: string };

const NOT_FOUND = "ไม่พบ";

/** โรงแรม › <hotel> [› last] */
function HotelCrumbs({ hotelId, last }: { hotelId: string; last?: Crumb }) {
  const hotel = useAdminHotel(hotelId);
  const items: Crumb[] = [
    { label: "โรงแรม", href: "/hotels" },
    { label: hotel.isError ? NOT_FOUND : hotel.data?.name, href: `/hotels/${hotelId}` },
  ];
  if (last) items.push(last);
  return <Crumbs items={items} />;
}

function RoomTypeCrumbs({ hotelId, roomTypeId }: { hotelId: string; roomTypeId: string }) {
  const roomType = useRoomType(hotelId, roomTypeId);
  return <HotelCrumbs hotelId={hotelId} last={{ label: roomType.isError ? NOT_FOUND : roomType.data?.name }} />;
}

function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((crumb, i) => {
          const last = i === items.length - 1;
          const label = crumb.label ?? <Skeleton className="h-4 w-24" />;
          return (
            <Fragment key={i}>
              {/* Below md only the current page shows */}
              <BreadcrumbItem className={last ? "min-w-0" : "hidden md:inline-flex"}>
                {last || !crumb.href ? (
                  <BreadcrumbPage className="truncate">{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!last && <BreadcrumbSeparator className="hidden md:block" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** Where you are, from the URL: โรงแรม › <hotel> › <room type>, การจอง › <code>. */
export function AdminBreadcrumb() {
  const pathname = usePathname();
  const { hotelId, roomTypeId, code } = useParams<{ hotelId?: string; roomTypeId?: string; code?: string }>();

  if (hotelId && roomTypeId) return <RoomTypeCrumbs hotelId={hotelId} roomTypeId={roomTypeId} />;
  if (hotelId) {
    const isNewRoomType = pathname.endsWith("/room-types/new");
    return <HotelCrumbs hotelId={hotelId} last={isNewRoomType ? { label: "เพิ่มประเภทห้อง" } : undefined} />;
  }
  if (pathname === "/hotels/new") {
    return <Crumbs items={[{ label: "โรงแรม", href: "/hotels" }, { label: "เพิ่มโรงแรม" }]} />;
  }
  if (pathname.startsWith("/hotels")) return <Crumbs items={[{ label: "โรงแรม" }]} />;
  if (code) return <Crumbs items={[{ label: "การจอง", href: "/bookings" }, { label: code }]} />;
  if (pathname.startsWith("/bookings")) return <Crumbs items={[{ label: "การจอง" }]} />;
  return null;
}
