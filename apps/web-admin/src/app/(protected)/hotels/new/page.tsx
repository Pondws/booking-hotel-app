"use client";

import Link from "next/link";
import { Button } from "@booking/ui/components/button";
import { useMe } from "@/features/auth/hooks";
import { HotelForm } from "@/features/hotels/components/hotel-form";

export default function NewHotelPage() {
  const { data: me } = useMe();
  const heading = (
    <h1 className="text-2xl font-semibold tracking-tight">New hotel</h1>
  );

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      {me?.role === "ADMIN" ? (
        <HotelForm heading={heading} />
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            {heading}
            <Button asChild variant="outline">
              <Link href="/hotels">Back</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have access to this page.
          </p>
        </>
      )}
    </main>
  );
}
