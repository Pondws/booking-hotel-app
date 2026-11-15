"use client";

import Link from "next/link";
import { useMe } from "@/features/auth/hooks";
import { CreateHotelForm } from "@/features/hotels/components/create-hotel-form";

export default function NewHotelPage() {
  const { data: me } = useMe();
  const isAdmin = me?.role === "ADMIN";

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/hotels" className="text-sm text-muted-foreground hover:underline">
          ← Hotels
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New hotel</h1>
      </div>
      {isAdmin ? (
        <CreateHotelForm />
      ) : (
        <p className="text-sm text-muted-foreground">You don&apos;t have access to this page.</p>
      )}
    </main>
  );
}
