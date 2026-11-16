import type { Metadata } from "next";
import { Suspense } from "react";
import { HotelResultsSkeleton } from "@/features/hotels/components/hotel-results";
import { HotelSearchView } from "@/features/hotels/components/hotel-search-view";

export const metadata: Metadata = { title: "ค้นหาที่พัก · Booking Hotel" };

export default function HotelsPage() {
  return (
    <main>
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8">
            <h1 className="text-2xl font-semibold tracking-tight">ค้นหาที่พัก</h1>
            <HotelResultsSkeleton />
          </div>
        }
      >
        <HotelSearchView />
      </Suspense>
    </main>
  );
}
