"use client";

import { useParams } from "next/navigation";
import { useAdminBooking } from "@/features/bookings/hooks";
import {
  BookingDetail,
  BookingPageError,
  BookingPageSkeleton,
} from "@/features/bookings/components/booking-detail";

export default function BookingPage() {
  const { code } = useParams<{ code: string }>();
  const { data: booking, isPending, isError, error, refetch } = useAdminBooking(code);

  return (
    <main className="w-full px-4 py-8">
      {isPending ? (
        <BookingPageSkeleton />
      ) : isError ? (
        <BookingPageError error={error} onRetry={() => void refetch()} />
      ) : (
        <BookingDetail booking={booking} />
      )}
    </main>
  );
}
