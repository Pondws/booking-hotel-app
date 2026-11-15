"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CreateBookingData } from "@booking/shared";
import { Button, buttonVariants } from "@booking/ui/components/button";
import { Skeleton } from "@booking/ui/components/skeleton";
import { useAvailability, useHotel } from "@/features/hotels/hooks";
import { ApiError } from "@/lib/api";
import { parseBookParams } from "../book-params";
import { BookingSummary } from "./booking-summary";
import { GuestForm } from "./guest-form";

/** `/book`: stay + room type from the URL, live quote, guest form that places the hold. */
export function BookView() {
  const searchParams = useSearchParams();
  const { hotel: slug, input } = parseBookParams(new URLSearchParams(searchParams.toString()));

  if (slug === null || input === null) return <ChooseDatesFirst slug={slug} />;
  return <BookHotel slug={slug} input={input} />;
}

function ChooseDatesFirst({ slug }: { slug: string | null }) {
  return (
    <div className="space-y-3 rounded-lg border p-6 text-center">
      <h2 className="text-lg font-semibold">Choose your dates first</h2>
      <p className="text-sm text-muted-foreground">
        Pick a room and your stay dates, then come back here to book.
      </p>
      <Link
        href={slug ? `/hotels/${encodeURIComponent(slug)}` : "/hotels"}
        className={buttonVariants({ variant: "outline" })}
      >
        {slug ? "Back to the hotel" : "Find a hotel"}
      </Link>
    </div>
  );
}

function BookHotel({ slug, input }: { slug: string; input: CreateBookingData }) {
  const { data: hotel, isPending, isError, error, refetch, isFetching } = useHotel(slug);
  const range = { checkIn: input.checkIn, checkOut: input.checkOut, guests: input.guests };
  // Same query key as BookingSummary, so this shares its cache entry
  const availability = useAvailability(slug, range);

  if (isPending) return <BookViewSkeleton />;

  if (isError) {
    if (error instanceof ApiError && error.status === 404) return <ChooseDatesFirst slug={null} />;
    return (
      <div role="alert" className="space-y-3 rounded-lg border p-6 text-center">
        <p className="text-sm">We couldn&apos;t load this hotel right now.</p>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "Retrying…" : "Try again"}
        </Button>
      </div>
    );
  }

  const roomType = hotel.roomTypes.find((rt) => rt.id === input.roomTypeId);
  if (!roomType || roomType.capacity < input.guests) return <ChooseDatesFirst slug={slug} />;

  const entry = availability.data?.roomTypes.find((r) => r.roomTypeId === roomType.id);
  const canHold = entry?.available === true;

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_20rem] md:items-start">
      <GuestForm
        key={`${input.roomTypeId}|${input.checkIn}|${input.checkOut}|${input.guests}`}
        hotelSlug={slug} stay={input} canHold={canHold} />
      <BookingSummary hotel={hotel} roomType={roomType} range={range} />
    </div>
  );
}

export function BookViewSkeleton() {
  return (
    <div
      className="grid gap-8 md:grid-cols-[1fr_20rem]"
      role="status"
      aria-busy="true"
      aria-label="Loading booking"
    >
      <div className="space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
