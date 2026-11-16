"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@booking/ui/components/button";
import { Skeleton } from "@booking/ui/components/skeleton";
import { cn } from "@booking/ui/lib/utils";
import { formatMoney } from "@/features/hotels/format";
import { searchHref } from "@/features/hotels/search-params";
import { useDestinations } from "../hooks";

type Props = {
  /** Show only the first N cities (home page); all when omitted (/destinations). */
  limit?: number;
  className?: string;
};

const GRID = "grid grid-cols-2 gap-4 lg:grid-cols-4";

/** City tiles (Booking.com "trending destinations"): photo, name, hotel count, starting price → search. */
export function DestinationGrid({ limit, className }: Props) {
  const { data, isPending, isError, refetch, isFetching } = useDestinations();

  if (isPending) {
    return (
      <div className={cn(GRID, className)} role="status" aria-busy="true" aria-label="กำลังโหลดจุดหมายปลายทาง">
        {Array.from({ length: limit ?? 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/3] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <p className="text-sm">โหลดจุดหมายปลายทางไม่ได้ในขณะนี้</p>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "กำลังลองใหม่…" : "ลองใหม่"}
        </Button>
      </div>
    );
  }

  const cities = limit === undefined ? data : data.slice(0, limit);
  if (cities.length === 0) {
    return <p className="text-sm text-muted-foreground">ยังไม่มีโรงแรมในระบบ แวะกลับมาดูอีกครั้งเร็ว ๆ นี้</p>;
  }

  return (
    <ul className={cn(GRID, className)}>
      {cities.map((city, i) => (
        <li key={city.city}>
          <Link
            href={searchHref({ city: city.city, page: 1 })}
            className="group relative block aspect-[4/3] overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {city.coverImage && (
              <Image
                src={city.coverImage.url}
                alt=""
                fill
                priority={i < 2}
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            )}
            {/* Scrim keeps the city name readable on any photo */}
            <span className="absolute inset-x-0 bottom-0 space-y-0.5 bg-gradient-to-t from-foreground/80 to-transparent p-3 pt-10 text-background">
              <span className="block text-lg font-semibold">{city.city}</span>
              <span className="block text-xs">
                {city.hotelCount.toLocaleString("th-TH")} โรงแรม
                {city.fromPrice !== null && ` · เริ่มต้น ${formatMoney(city.fromPrice, city.currency)}`}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
