import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireAuth } from "@/features/auth/components/require-auth";
import { BookingDetail } from "@/features/bookings/components/booking-detail";

export const metadata: Metadata = { title: "Booking · Booking Hotel" };

export default async function BookingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Your booking</h1>
      <Suspense>
        <RequireAuth>
          <BookingDetail code={code} />
        </RequireAuth>
      </Suspense>
    </main>
  );
}
