"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { bookingListQuerySchema } from "@booking/shared";
import { Button, buttonVariants } from "@booking/ui/components/button";
import { cn } from "@booking/ui/lib/utils";
import { Pagination } from "@/components/pagination";
import { useMyBookings } from "../hooks";
import { BookingCard, BookingCardSkeleton } from "./booking-card";

const LIST = "space-y-3";

function pageHref(page: number): string {
  return page > 1 ? `/account/bookings?page=${page}` : "/account/bookings";
}

export function BookingList() {
  const searchParams = useSearchParams();
  const parsed = bookingListQuerySchema.shape.page.safeParse(searchParams.get("page") ?? undefined);
  const page = parsed.success ? parsed.data : 1;
  const { data, isError, refetch, isFetching, isPlaceholderData } = useMyBookings(page);

  // Loaded data stays on screen when a background refetch fails
  if (data === undefined) {
    if (!isError) {
      return (
        <div className={LIST} role="status" aria-busy="true" aria-label="Loading bookings">
          {Array.from({ length: 3 }, (_, i) => (
            <BookingCardSkeleton key={i} />
          ))}
        </div>
      );
    }
    return (
      <div role="alert" className="space-y-3 rounded-lg border p-6 text-center">
        <p className="text-sm">We couldn&apos;t load your bookings right now.</p>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "Retrying…" : "Try again"}
        </Button>
      </div>
    );
  }

  if (data.items.length === 0) {
    // A page past the end still knows the real total
    if (data.total > 0) {
      return (
        <div className="space-y-2 rounded-lg border p-6 text-center">
          <p className="font-medium">There are no more bookings on this page.</p>
          <Link href={pageHref(1)} className="inline-flex min-h-6 items-center text-sm underline underline-offset-4">
            Back to the first page
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-3 rounded-lg border p-6 text-center">
        <p className="font-medium">No bookings yet</p>
        <Link href="/hotels" className={buttonVariants({ variant: "outline" })}>
          Find a hotel
        </Link>
      </div>
    );
  }

  const busy = isPlaceholderData && isFetching;
  return (
    <section aria-labelledby="bookings-heading" className="space-y-4">
      <h2 id="bookings-heading" className="sr-only">
        Your bookings
      </h2>
      <div aria-busy={busy} className={cn(LIST, "transition-opacity", busy && "opacity-60")}>
        {data.items.map((booking) => (
          <BookingCard key={booking.code} booking={booking} />
        ))}
      </div>
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        hrefFor={pageHref}
        label="Bookings pages"
      />
    </section>
  );
}
