"use client";

import { useMe } from "@/features/auth/hooks";
import { CreateHotelForm } from "@/features/hotels/components/create-hotel-form";
import { ApiStatus } from "@/features/health/components/api-status";
import { HotelList } from "@/features/hotels/components/hotel-list";

export default function AdminHome() {
  const { data: me } = useMe();
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          <p className="text-muted-foreground">Manage hotels.</p>
        </div>
        <ApiStatus />
      </header>
      {me?.role === "ADMIN" && <CreateHotelForm />}
      <HotelList />
    </main>
  );
}
