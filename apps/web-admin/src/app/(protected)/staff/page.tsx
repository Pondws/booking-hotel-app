"use client";

import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@booking/ui/components/button";
import { DataTableSkeleton } from "@booking/ui/components/data-table";
import { AdminOnly } from "@/components/admin-only";
import { StaffList } from "@/features/staff/components/staff-list";

export default function StaffPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <AdminOnly>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">พนักงาน</h1>
          <Button asChild>
            <Link href="/staff/new">เพิ่มพนักงาน</Link>
          </Button>
        </header>
        <Suspense fallback={<DataTableSkeleton />}>
          <StaffList />
        </Suspense>
      </AdminOnly>
    </main>
  );
}
