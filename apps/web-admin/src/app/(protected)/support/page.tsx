import { Suspense } from "react";
import { DataTableSkeleton } from "@booking/ui/components/data-table";
import { SupportList } from "@/features/support/components/support-list";

export default function SupportPage() {
  return (
    <main className="flex w-full flex-col gap-6 px-4 py-8 md:h-screen">
      <h1 className="text-2xl font-semibold tracking-tight">ข้อความจากลูกค้า</h1>
      <Suspense fallback={<DataTableSkeleton />}>
        <SupportList />
      </Suspense>
    </main>
  );
}
