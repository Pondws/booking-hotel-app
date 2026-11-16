import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@booking/ui/components/skeleton";
import { RequireAuth } from "@/features/auth/components/require-auth";
import { BookingDetail } from "@/features/bookings/components/booking-detail";

export const metadata: Metadata = { title: "รายละเอียดการจอง · Booking Hotel" };

type Props = { params: Promise<{ code: string }> };

// `params` is runtime data: read it inside <Suspense fallback={<DetailFallback />}> so the shell can still prerender
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
      <h1 className="text-2xl font-semibold tracking-tight">รายละเอียดการจอง</h1>
      <Suspense fallback={<DetailFallback />}>
        <BookingContent params={params} />
      </Suspense>
    </main>
  );
}

function DetailFallback() {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label="กำลังโหลดการจอง">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
