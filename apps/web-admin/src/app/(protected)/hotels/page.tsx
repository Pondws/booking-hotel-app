"use client";

import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@booking/ui/components/button";
import { useMe } from "@/features/auth/hooks";
import { HotelList, HotelTableSkeleton } from "@/features/hotels/components/hotel-list";

export default function HotelsPage() {
  const { data: me } = useMe();
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Hotels</h1>
        {me?.role === "ADMIN" && (
          <Button asChild>
            <Link href="/hotels/new">New hotel</Link>
          </Button>
        )}
      </header>
      <Suspense fallback={<HotelTableSkeleton />}>
        <HotelList />
      </Suspense>
    </main>
  );
}
