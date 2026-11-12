"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import type { HotelDetail as HotelDetailData, StayRange } from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import { Skeleton } from "@booking/ui/components/skeleton";
import { cn } from "@booking/ui/lib/utils";
import { ApiError } from "@/lib/api";
import { formatDateRange } from "../format";
import { useAvailability, useHotel } from "../hooks";
import { parseSearchParams, searchHref } from "../search-params";
import { AmenityList } from "./amenity-list";
import { HotelGallery } from "./hotel-gallery";
import { RoomTypeCard, RoomTypeCardSkeleton, type RoomPricing } from "./room-type-card";
import { StayPicker, type Stay } from "./stay-picker";

/** `/hotels/[slug]`: hotel data from the API, stay (dates + guests) from the URL. */
export function HotelDetail({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const { checkIn, checkOut, guests } = parseSearchParams(new URLSearchParams(searchParams.toString()));
  const stay: Stay = { checkIn, checkOut, guests };
  // parseSearchParams already dropped past/over-long/half ranges, so a pair here is a valid stay
  const range: StayRange | null =
    checkIn && checkOut ? { checkIn, checkOut, guests: guests ?? 1 } : null;

  const { data: hotel, isPending, isError, error, refetch, isFetching } = useHotel(slug);

  if (isPending) return <HotelDetailSkeleton />;

  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <div className="space-y-2 rounded-lg border p-6 text-center">
          <h1 className="text-xl font-semibold">Hotel not found</h1>
          <p className="text-sm text-muted-foreground">
            This hotel doesn&apos;t exist or is no longer listed.
          </p>
          <Link href="/hotels" className="inline-flex min-h-6 items-center text-sm underline underline-offset-4">
            Search hotels
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-3 rounded-lg border p-6 text-center">
        <p className="text-sm">We couldn&apos;t load this hotel right now.</p>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "Retrying…" : "Try again"}
        </Button>
      </div>
    );
  }

  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <Link
          href={searchHref({ city: hotel.city, ...stay })}
          className="inline-flex min-h-6 items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Hotels in {hotel.city}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{hotel.name}</h1>
          {hotel.reviewCount > 0 && (
            <Badge variant="outline" className="tabular-nums">
              ★ {hotel.ratingAvg.toFixed(1)} · {hotel.reviewCount === 1 ? "1 review" : `${hotel.reviewCount} reviews`}
            </Badge>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin aria-hidden className="size-4 shrink-0" />
          {hotel.address}
        </p>
      </header>

      <HotelGallery images={hotel.images} name={hotel.name} />

      {(hotel.description || hotel.amenities.length > 0) && (
        <section aria-labelledby="about-heading" className="space-y-3">
          <h2 id="about-heading" className="text-lg font-semibold">
            About this hotel
          </h2>
          {hotel.description && <p className="text-muted-foreground">{hotel.description}</p>}
          <AmenityList amenities={hotel.amenities} />
        </section>
      )}

      <section aria-labelledby="rooms-heading" className="space-y-4">
        <h2 id="rooms-heading" className="text-lg font-semibold">
          Rooms
        </h2>
        <StayPicker value={stay} />
        <RoomList hotel={hotel} slug={slug} range={range} guests={guests} />
      </section>
    </article>
  );
}

type RoomListProps = {
  hotel: HotelDetailData;
  slug: string;
  range: StayRange | null;
  guests: number | undefined;
};

function RoomList({ hotel, slug, range, guests }: RoomListProps) {
  const availability = useAvailability(slug, range);
  // Room types too small for the party are hidden (the availability API leaves them out too)
  const fitting = hotel.roomTypes.filter((rt) => rt.capacity >= (guests ?? 1));

  if (hotel.roomTypes.length === 0) {
    return <p className="text-sm text-muted-foreground">No rooms are listed for this hotel yet.</p>;
  }

  if (fitting.length === 0) {
    return (
      <p className="rounded-lg border p-6 text-center text-sm">
        No rooms here sleep {guests} guests. Try fewer guests.
      </p>
    );
  }

  const pricingFor = (roomTypeId: string): RoomPricing => {
    if (!range || availability.isError) return { kind: "base" };
    if (availability.isPending) return { kind: "loading" };
    const entry = availability.data.roomTypes.find((r) => r.roomTypeId === roomTypeId);
    return entry ? { kind: "quote", availability: entry } : { kind: "base" };
  };

  const quoted = range && availability.isSuccess;
  const allSoldOut = quoted && availability.data.roomTypes.every((r) => !r.available);
  const refreshing = quoted && availability.isFetching;

  return (
    <div className="space-y-3">
      {range && (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {availability.isError
            ? null
            : allSoldOut
              ? `Fully booked for ${formatDateRange(range.checkIn, range.checkOut)}. Try other dates.`
              : `Prices for ${formatDateRange(range.checkIn, range.checkOut)}, ${range.guests === 1 ? "1 guest" : `${range.guests} guests`}.`}
        </p>
      )}
      {range && availability.isError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <p className="text-sm">We couldn&apos;t check prices for these dates. Showing base prices.</p>
          <Button
            variant="outline"
            onClick={() => void availability.refetch()}
            disabled={availability.isFetching}
          >
            {availability.isFetching ? "Retrying…" : "Try again"}
          </Button>
        </div>
      )}
      {!range && (
        <p className="text-sm text-muted-foreground">Add dates to see availability and the total price.</p>
      )}
      <ul aria-busy={refreshing || undefined} className={cn("space-y-3 transition-opacity", refreshing && "opacity-60")}>
        {fitting.map((roomType) => (
          <li key={roomType.id}>
            <RoomTypeCard roomType={roomType} currency={hotel.currency} pricing={pricingFor(roomType.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HotelDetailSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-busy="true" aria-label="Loading hotel">
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="aspect-video w-full" />
      <div className="space-y-3">
        <RoomTypeCardSkeleton />
        <RoomTypeCardSkeleton />
      </div>
    </div>
  );
}
