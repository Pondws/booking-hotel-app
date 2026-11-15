"use client";

import { useParams } from "next/navigation";
import { useAdminHotel } from "@/features/hotels/hooks";
import { RoomTypeForm } from "@/features/room-types/components/room-type-form";
import { RoomTypeHeading } from "@/features/room-types/components/room-type-header";
import { RoomTypePageError, RoomTypePageSkeleton } from "@/features/room-types/components/room-type-page-states";

export default function NewRoomTypePage() {
  const { hotelId } = useParams<{ hotelId: string }>();
  const { data: hotel, isPending, isError, error, refetch } = useAdminHotel(hotelId);

  return (
    <main className="w-full space-y-6 px-4 py-8">
      {isPending ? (
        <RoomTypePageSkeleton />
      ) : isError ? (
        <RoomTypePageError error={error} hotelId={hotelId} onRetry={() => void refetch()} />
      ) : (
        <RoomTypeForm
          hotelId={hotel.id}
          currency={hotel.currency}
          heading={<RoomTypeHeading hotel={hotel} title="เพิ่มประเภทห้อง" />}
        />
      )}
    </main>
  );
}
