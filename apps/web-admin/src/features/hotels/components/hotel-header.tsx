"use client";

import type { AdminHotel } from "@booking/shared";
import { useMe } from "@/features/auth/hooks";
import { HotelStatusBadge } from "./hotel-list";
import { HotelStatusDialog } from "./hotel-status-dialog";

/** Title block for the hotel page header (left side of `HotelForm`'s header). */
export function HotelHeading({ hotel }: { hotel: AdminHotel }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{hotel.name}</h1>
        <HotelStatusBadge isActive={hotel.isActive} />
      </div>
      <p className="text-sm text-muted-foreground">
        {hotel.city} · <span className="font-mono">{hotel.slug}</span>
      </p>
    </div>
  );
}

/** ADMIN-only header actions (Deactivate / Reactivate). */
export function HotelAdminActions({ hotel }: { hotel: AdminHotel }) {
  const { data: me } = useMe();
  return me?.role === "ADMIN" ? <HotelStatusDialog hotel={hotel} /> : null;
}
