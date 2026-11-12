import { Suspense } from "react";
import { hotelSearchQuerySchema } from "@booking/shared";
import { HotelResults, HotelResultsSkeleton } from "@/features/hotels/components/hotel-results";
import { SearchBar } from "@/features/hotels/components/search-bar";

const FIRST_PAGE = hotelSearchQuerySchema.parse({});

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10">
      <section className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Find your next stay</h1>
          <p className="text-muted-foreground">
            Search by city and dates to see which rooms are free and what they cost.
          </p>
        </div>
        <Suspense>
          <SearchBar />
        </Suspense>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Popular hotels</h2>
        <Suspense fallback={<HotelResultsSkeleton />}>
          <HotelResults query={FIRST_PAGE} />
        </Suspense>
      </section>
    </main>
  );
}
