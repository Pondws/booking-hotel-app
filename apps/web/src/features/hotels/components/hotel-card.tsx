"use client";

import Image from "next/image";
import Link from "next/link";
import type { HotelSearchQuery, HotelSummary } from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Skeleton } from "@booking/ui/components/skeleton";
import { formatMoney } from "../format";
import { usePrefetchHotel } from "../hooks";
import { toSearchParams } from "../search-params";

type Props = {
  hotel: HotelSummary;
  /** The stay being searched, carried to the detail page. */
  stay: Pick<HotelSearchQuery, "checkIn" | "checkOut" | "guests">;
  /** Load the image eagerly (first row of results). */
  priority?: boolean;
};

export function HotelCard({ hotel, stay, priority = false }: Props) {
  const prefetch = usePrefetchHotel();
  const qs = toSearchParams(stay).toString();
  const href = `/hotels/${hotel.slug}${qs ? `?${qs}` : ""}`;
  const warm = () => prefetch(hotel.slug);

  return (
    <Link
      href={href}
      onMouseEnter={warm}
      onFocus={warm}
      className="group block rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow group-hover:shadow-md">
        <div className="relative aspect-[4/3] bg-muted">
          {hotel.coverImage && (
            <Image
              src={hotel.coverImage.url}
              alt={hotel.coverImage.alt ?? hotel.name}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          )}
        </div>
        <CardHeader className="gap-1 px-4 pt-4">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="leading-snug">{hotel.name}</CardTitle>
            {hotel.reviewCount > 0 && (
              <Badge variant="outline" className="shrink-0 tabular-nums">
                ★ {hotel.ratingAvg.toFixed(1)}
              </Badge>
            )}
          </div>
          <CardDescription>
            {hotel.city}
            {" · "}
            {reviewsLabel(hotel.reviewCount)}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pt-3 pb-4 text-sm">
          {hotel.fromPrice === null ? (
            <span className="text-muted-foreground">Price on request</span>
          ) : (
            <p>
              <span className="text-muted-foreground">from </span>
              <span className="text-base font-semibold tabular-nums">
                {formatMoney(hotel.fromPrice, hotel.currency)}
              </span>
              <span className="text-muted-foreground"> / night</span>
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function reviewsLabel(count: number): string {
  if (count === 0) return "No reviews yet";
  return count === 1 ? "1 review" : `${count} reviews`;
}

/** Same shape as HotelCard: image block + title + two text lines. */
export function HotelCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}
