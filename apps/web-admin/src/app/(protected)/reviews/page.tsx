import { Suspense } from "react";
import { DataTableSkeleton } from "@booking/ui/components/data-table";
import { ReviewList } from "@/features/reviews/components/review-list";

export default function ReviewsPage() {
  return (
    <main className="flex w-full flex-col gap-6 px-4 py-8 md:h-screen">
      <h1 className="text-2xl font-semibold tracking-tight">รีวิว</h1>
      <Suspense fallback={<DataTableSkeleton />}>
        <ReviewList />
      </Suspense>
    </main>
  );
}
