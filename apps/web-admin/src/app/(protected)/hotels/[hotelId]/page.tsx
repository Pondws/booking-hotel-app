"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@booking/ui/components/button";
import { Skeleton } from "@booking/ui/components/skeleton";
import { useAdminHotel } from "@/features/hotels/hooks";
import { HotelForm } from "@/features/hotels/components/hotel-form";
import {
  HotelAdminActions,
  HotelHeading,
} from "@/features/hotels/components/hotel-header";
import { RoomTypeList } from "@/features/room-types/components/room-type-list";
import { ApiError } from "@/lib/api";

export default function HotelPage() {
  const { hotelId } = useParams<{ hotelId: string }>();
  const {
    data: hotel,
    isPending,
    isError,
    error,
    refetch,
  } = useAdminHotel(hotelId);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      {isPending ? (
        <HotelPageSkeleton />
      ) : isError ? (
        <HotelPageError error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          {/* Remount the form when another hotel is opened so its defaults follow */}
          <HotelForm
            key={hotel.id}
            hotel={hotel}
            heading={<HotelHeading hotel={hotel} />}
            actions={<HotelAdminActions hotel={hotel} />}
          />
          <RoomTypeList hotelId={hotel.id} currency={hotel.currency} />
        </>
      )}
    </main>
  );
}

function HotelPageError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  const status = error instanceof ApiError ? error.status : 0;
  if (status === 403 || status === 404) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {status === 403
            ? "คุณไม่มีสิทธิ์เข้าถึงโรงแรมนี้"
            : "ไม่พบโรงแรม"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {status === 403
            ? "ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าถึง"
            : "โรงแรมอาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง"}
        </p>
        <Button asChild variant="link" className="px-0">
          <Link href="/hotels">กลับไปที่รายการโรงแรม</Link>
        </Button>
      </div>
    );
  }
  return (
    <div role="alert" className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">
        โหลดข้อมูลโรงแรมไม่สำเร็จ
      </h1>
      <Button variant="outline" onClick={onRetry}>
        ลองอีกครั้ง
      </Button>
    </div>
  );
}

function HotelPageSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-lg" />
      ))}
    </div>
  );
}
