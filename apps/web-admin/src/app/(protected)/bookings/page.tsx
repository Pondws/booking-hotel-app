import { Suspense } from "react";
import { DataTableSkeleton } from "@booking/ui/components/data-table";
import { BookingList } from "@/features/bookings/components/booking-list";

export default function BookingsPage() {
  return (
    <main className="flex w-full flex-col gap-6 px-4 py-8 md:h-screen">
      <h1 className="text-2xl font-semibold tracking-tight">การจอง</h1>
      <Suspense fallback={<DataTableSkeleton />}>
        <BookingList />
      </Suspense>
    </main>
  );
}
