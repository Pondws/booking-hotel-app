"use client";

import Link from "next/link";
import type { AdminHotel } from "@booking/shared";
import { useMe } from "@/features/auth/hooks";
import { HotelStatusBadge } from "./hotel-list";
import { HotelStatusDialog } from "./hotel-status-dialog";

export function HotelHeader({ hotel }: { hotel: AdminHotel }) {
  const { data: me } = useMe();
  return (
    <header className="space-y-1">
      <Link href="/hotels" className="text-sm text-muted-foreground hover:underline">
        ← Hotels
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{hotel.name}</h1>
            <HotelStatusBadge isActive={hotel.isActive} />
          </div>
          <p className="text-sm text-muted-foreground">
            {hotel.city} · <span className="font-mono">{hotel.slug}</span>
          </p>
        </div>
        {me?.role === "ADMIN" && <HotelStatusDialog hotel={hotel} />}
      </div>
    </header>
  );
}
