import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireAuth } from "@/features/auth/components/require-auth";
import { BookingList } from "@/features/bookings/components/booking-list";

export const metadata: Metadata = { title: "My bookings · Booking Hotel" };

export default function MyBookingsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">My bookings</h1>
      <Suspense>
        <RequireAuth>
          <BookingList />
        </RequireAuth>
      </Suspense>
    </main>
  );
}
