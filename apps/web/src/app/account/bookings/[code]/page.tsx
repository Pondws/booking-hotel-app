import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireAuth } from "@/features/auth/components/require-auth";
import { BookingDetail } from "@/features/bookings/components/booking-detail";

export const metadata: Metadata = { title: "Booking · Booking Hotel" };

type Props = { params: Promise<{ code: string }> };

// `params` is runtime data: read it inside <Suspense> so the shell can still prerender
async function BookingContent({ params }: Props) {
  const { code } = await params;
  return (
    <RequireAuth>
      <BookingDetail code={code} />
    </RequireAuth>
  );
}

export default function BookingPage({ params }: Props) {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Your booking</h1>
      <Suspense>
        <BookingContent params={params} />
      </Suspense>
    </main>
  );
}
