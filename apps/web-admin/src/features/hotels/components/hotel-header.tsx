"use client";

import type { AdminHotel } from "@booking/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@booking/ui/components/card";
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

/** ADMIN only — Deactivate / Reactivate, at the bottom of the details tab (kept out of the form header). */
export function HotelStatusCard({ hotel }: { hotel: AdminHotel }) {
  const { data: me } = useMe();
  if (me?.role !== "ADMIN") return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>สถานะโรงแรม</CardTitle>
        <CardDescription>
          {hotel.isActive
            ? "เปิดใช้งานอยู่ ลูกค้าค้นหาและจองโรงแรมนี้ได้"
            : "ปิดใช้งานอยู่ ลูกค้าค้นหาและจองโรงแรมนี้ไม่ได้"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <HotelStatusDialog hotel={hotel} />
      </CardContent>
    </Card>
  );
}
