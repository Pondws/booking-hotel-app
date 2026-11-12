import type { Metadata } from "next";
import { Suspense } from "react";
import { HotelResultsSkeleton } from "@/features/hotels/components/hotel-results";
import { HotelSearchView } from "@/features/hotels/components/hotel-search-view";

export const metadata: Metadata = { title: "Search hotels · Booking Hotel" };

export default function HotelsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Find a hotel</h1>
      <Suspense fallback={<HotelResultsSkeleton />}>
        <HotelSearchView />
      </Suspense>
    </main>
  );
}
