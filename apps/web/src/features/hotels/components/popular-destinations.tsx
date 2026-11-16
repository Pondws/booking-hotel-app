"use client";

import Image from "next/image";
import Link from "next/link";
import { hotelSearchQuerySchema, type HotelSummary } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Skeleton } from "@booking/ui/components/skeleton";
import { formatMoney } from "../format";
import { useHotelSearch } from "../hooks";
import { searchHref } from "../search-params";

// Same query (and cache entry) as the "recommended hotels" grid on the home page
const FIRST_PAGE = hotelSearchQuerySchema.parse({});
const MAX_CITIES = 4;
const GRID = "grid gap-4 grid-cols-2 lg:grid-cols-4";

type City = {
  name: string;
  hotels: number;
  cover: HotelSummary["coverImage"];
  fromPrice: number | null;
  currency: string;
};

function groupByCity(hotels: HotelSummary[]): City[] {
  const cities = new Map<string, City>();
  for (const h of hotels) {
    const city = cities.get(h.city);
    if (!city) {
      cities.set(h.city, { name: h.city, hotels: 1, cover: h.coverImage, fromPrice: h.fromPrice, currency: h.currency });
      continue;
    }
    city.hotels += 1;
    city.cover ??= h.coverImage;
    if (h.fromPrice !== null && h.currency === city.currency && (city.fromPrice === null || h.fromPrice < city.fromPrice)) {
      city.fromPrice = h.fromPrice;
    }
  }
  return [...cities.values()].sort((a, b) => b.hotels - a.hotels).slice(0, MAX_CITIES);
}

/** City tiles built from the listed hotels (Booking.com's "trending destinations"). */
export function PopularDestinations() {
  const { data, isPending, isError, refetch, isFetching } = useHotelSearch(FIRST_PAGE);

  if (isPending) {
    return (
      <div className={GRID} role="status" aria-busy="true" aria-label="กำลังโหลดจุดหมายยอดนิยม">
        {Array.from({ length: MAX_CITIES }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/3] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <p className="text-sm">โหลดจุดหมายยอดนิยมไม่ได้ในขณะนี้</p>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "กำลังลองใหม่…" : "ลองใหม่"}
        </Button>
      </div>
    );
  }

  const cities = groupByCity(data.items);
  if (cities.length === 0) {
    return <p className="text-sm text-muted-foreground">ยังไม่มีโรงแรมในระบบ แวะกลับมาดูอีกครั้งเร็ว ๆ นี้</p>;
  }

  return (
    <ul className={GRID}>
      {cities.map((city, i) => (
        <li key={city.name}>
          <Link
            href={searchHref({ city: city.name, page: 1 })}
            className="group relative block aspect-[4/3] overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {city.cover && (
              <Image
                src={city.cover.url}
                alt=""
                fill
                priority={i < 2}
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            )}
            {/* Scrim keeps the city name readable on any photo */}
            <span className="absolute inset-x-0 bottom-0 space-y-0.5 bg-gradient-to-t from-foreground/80 to-transparent p-3 pt-10 text-background">
              <span className="block text-lg font-semibold">{city.name}</span>
              <span className="block text-xs">
                {city.hotels} โรงแรม
                {city.fromPrice !== null && ` · เริ่มต้น ${formatMoney(city.fromPrice, city.currency)}`}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
