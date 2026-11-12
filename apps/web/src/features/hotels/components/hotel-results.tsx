"use client";

import Link from "next/link";
import type { HotelSearchQuery } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { cn } from "@booking/ui/lib/utils";
import { useHotelSearch } from "../hooks";
import { searchHref } from "../search-params";
import { HotelCard, HotelCardSkeleton } from "./hotel-card";
import { Pagination } from "./pagination";

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

export function HotelResultsSkeleton() {
  return (
    <div className={GRID} aria-busy="true" aria-label="Loading hotels">
      {Array.from({ length: 6 }, (_, i) => (
        <HotelCardSkeleton key={i} />
      ))}
    </div>
  );
}

function hasFilters(q: HotelSearchQuery): boolean {
  return q.city !== undefined || q.checkIn !== undefined || q.guests !== undefined;
}

export function HotelResults({ query }: { query: HotelSearchQuery }) {
  const { data, isPending, isError, refetch, isFetching, isPlaceholderData } = useHotelSearch(query);

  if (isPending) return <HotelResultsSkeleton />;

  if (isError) {
    return (
      <div className="space-y-3 rounded-lg border p-6 text-center">
        <p className="text-sm">We couldn&apos;t load hotels right now.</p>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "Retrying…" : "Try again"}
        </Button>
      </div>
    );
  }

  const stay = { checkIn: query.checkIn, checkOut: query.checkOut, guests: query.guests };
  const hrefFor = (page: number) => searchHref({ ...query, page });

  if (data.items.length === 0) {
    // A page past the end still knows the real total
    if (data.total > 0) {
      return (
        <div className="space-y-2 rounded-lg border p-6 text-center">
          <p className="font-medium">There are no more results on this page.</p>
          <Link href={hrefFor(1)} className="text-sm underline underline-offset-4">
            Back to the first page
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-2 rounded-lg border p-6 text-center">
        {hasFilters(query) ? (
          <>
            <p className="font-medium">No hotels match these filters.</p>
            <p className="text-sm text-muted-foreground">
              Try another city, fewer guests or different dates.
            </p>
            <Link href="/hotels" className="text-sm underline underline-offset-4">
              Clear filters
            </Link>
          </>
        ) : (
          <p className="font-medium">No hotels are listed yet. Check back soon.</p>
        )}
      </div>
    );
  }

  const busy = isPlaceholderData && isFetching;

  return (
    <section aria-labelledby="results-heading" className="space-y-4">
      <h2 id="results-heading" className="sr-only">
        Results
      </h2>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {data.total === 1 ? "1 hotel" : `${data.total} hotels`}
        {query.checkIn ? " with rooms available for your dates" : ""}
      </p>
      <div aria-busy={busy} className={cn(GRID, "transition-opacity", busy && "opacity-60")}>
        {data.items.map((hotel, i) => (
          <HotelCard key={hotel.id} hotel={hotel} stay={stay} priority={i < 3} />
        ))}
      </div>
      <Pagination page={data.page} totalPages={data.totalPages} hrefFor={hrefFor} />
    </section>
  );
}
