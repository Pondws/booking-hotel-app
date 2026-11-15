import { Suspense } from "react";
import { Skeleton } from "@booking/ui/components/skeleton";
import { Dashboard } from "@/features/dashboard/components/dashboard";

export default function AdminHome() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">ภาพรวม</h1>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Dashboard />
      </Suspense>
    </main>
  );
}
