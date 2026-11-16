"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import type { HotelSearchQuery, HotelSummary } from "@booking/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Skeleton } from "@booking/ui/components/skeleton";
import { WishlistHeart } from "@/features/wishlists/components/wishlist-heart";
import { formatMoney, ratingWord, reviewsLabel } from "../format";
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
    // The heart is a sibling of the link (no button inside an <a>), laid over the photo
    <div className="relative h-full">
      <Link
        href={href}
        onMouseEnter={warm}
        onFocus={warm}
        className="group block h-full rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Card className="h-full gap-0 overflow-hidden rounded-xl py-0 transition-shadow group-hover:shadow-lg">
          <div className="relative aspect-[4/3] overflow-hidden bg-muted">
            {hotel.coverImage && (
              <Image
                src={hotel.coverImage.url}
                alt={hotel.coverImage.alt ?? hotel.name}
                fill
                priority={priority}
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            )}
          </div>
          <CardHeader className="gap-1.5 px-4 pt-4">
            <CardTitle className="line-clamp-2 leading-snug">{hotel.name}</CardTitle>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin aria-hidden className="size-4 shrink-0" />
              {hotel.city}
            </p>
            <RatingLine ratingAvg={hotel.ratingAvg} reviewCount={hotel.reviewCount} />
          </CardHeader>
          <CardContent className="mt-auto px-4 pt-3 pb-4 text-right text-sm">
            {hotel.fromPrice === null ? (
              <span className="text-muted-foreground">สอบถามราคา</span>
            ) : (
              <p>
                <span className="text-muted-foreground">เริ่มต้น </span>
                <span className="text-lg font-semibold tabular-nums">
                  {formatMoney(hotel.fromPrice, hotel.currency)}
                </span>
                <span className="text-muted-foreground"> / คืน</span>
              </p>
            )}
          </CardContent>
        </Card>
      </Link>
      <WishlistHeart hotelId={hotel.id} hotelName={hotel.name} className="absolute top-3 right-3" />
    </div>
  );
}

/** Booking.com-style score: a solid badge with the average, the word for it and the review count. */
export function RatingLine({ ratingAvg, reviewCount }: { ratingAvg: number; reviewCount: number }) {
  if (reviewCount === 0) {
    return <p className="text-sm text-muted-foreground">{reviewsLabel(0)}</p>;
  }
  return (
    <p className="flex items-center gap-2 text-sm">
      <span className="rounded-md bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground tabular-nums">
        {ratingAvg.toFixed(1)}
      </span>
      <span className="font-medium">{ratingWord(ratingAvg)}</span>
      <span className="text-muted-foreground">· {reviewsLabel(reviewCount)}</span>
    </p>
  );
}

/** Same shape as HotelCard: image block + title + three text lines. */
export function HotelCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="ml-auto h-5 w-1/3" />
      </div>
    </div>
  );
}
