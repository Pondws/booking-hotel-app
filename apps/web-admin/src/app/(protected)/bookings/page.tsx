import { Suspense } from "react";
import { DataTableSkeleton } from "@booking/ui/components/data-table";
import { BookingList } from "@/features/bookings/components/booking-list";

export default function BookingsPage() {
  return (
    <main className="w-full space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">การจอง</h1>
      <Suspense fallback={<DataTableSkeleton />}>
        <BookingList />
      </Suspense>
    </main>
  );
}
