"use client";

import Link from "next/link";
import { Car, Coffee, Laptop, Star, Users, Waves, type LucideIcon } from "lucide-react";
import type { HotelSearchQuery } from "@booking/shared";
import { Skeleton } from "@booking/ui/components/skeleton";
import { useHotelAmenities } from "@/features/hotels/hooks";
import { searchHref } from "@/features/hotels/search-params";

type Idea = {
  title: string;
  body: string;
  icon: LucideIcon;
  query: Partial<HotelSearchQuery>;
  /** Shown only when the admin catalog has this hotel amenity, so the link isn't empty by design. */
  needsAmenity?: string;
};

// Themes are search shortcuts built on the /hotels filters (11.1): no separate theme data to maintain
const IDEAS: Idea[] = [
  {
    title: "ทะเลและสระว่ายน้ำ",
    body: "ที่พักมีสระว่ายน้ำ พักผ่อนได้เต็มวัน",
    icon: Waves,
    query: { amenities: ["pool"] },
    needsAmenity: "pool",
  },
  { title: "ทริปครอบครัว", body: "ห้องพักสำหรับ 4 คนขึ้นไป", icon: Users, query: { guests: 4 } },
  {
    title: "รวมอาหารเช้า",
    body: "เริ่มวันเที่ยวได้ทันทีไม่ต้องหาร้าน",
    icon: Coffee,
    query: { amenities: ["breakfast"] },
    needsAmenity: "breakfast",
  },
  {
    title: "ขับรถเที่ยวเอง",
    body: "ที่พักมีที่จอดรถ",
    icon: Car,
    query: { amenities: ["parking"] },
    needsAmenity: "parking",
  },
  {
    title: "ทำงานระหว่างเที่ยว",
    body: "มี Wi-Fi พร้อมใช้ เหมาะกับ workation",
    icon: Laptop,
    query: { amenities: ["wifi"] },
    needsAmenity: "wifi",
  },
  {
    title: "รีวิวดีเยี่ยม",
    body: "คะแนนรีวิว 4.5 ขึ้นไป",
    icon: Star,
    query: { minRating: 4.5, sort: "rating_desc" },
  },
];

const GRID = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";

export function TripIdeas() {
  const { data: amenities, isPending, isError } = useHotelAmenities();

  if (isPending) {
    return (
      <div className={GRID} role="status" aria-busy="true" aria-label="กำลังโหลดไอเดียทริป">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  // If the amenity list fails, keep the themes that don't depend on it rather than showing an error
  const codes = new Set(isError ? [] : amenities.map((a) => a.code));
  const ideas = IDEAS.filter((idea) => idea.needsAmenity === undefined || codes.has(idea.needsAmenity));

  return (
    <ul className={GRID}>
      {ideas.map(({ title, body, icon: Icon, query }) => (
        <li key={title}>
          <Link
            href={searchHref({ ...query, page: 1 })}
            className="flex h-full items-center gap-3 rounded-xl border bg-card p-4 outline-none transition-shadow hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Icon aria-hidden className="size-5" />
            </span>
            <span className="min-w-0 space-y-0.5">
              <span className="block font-medium">{title}</span>
              <span className="block text-sm text-muted-foreground">{body}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
