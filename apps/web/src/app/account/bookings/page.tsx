import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@booking/ui/components/skeleton";
import { RequireAuth } from "@/features/auth/components/require-auth";
import { BookingList } from "@/features/bookings/components/booking-list";

export const metadata: Metadata = { title: "My bookings · Booking Hotel" };

export default function MyBookingsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">My bookings</h1>
      <Suspense fallback={<ListFallback />}>
        <RequireAuth>
          <BookingList />
        </RequireAuth>
      </Suspense>
    </main>
  );
}

function ListFallback() {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading bookings">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
