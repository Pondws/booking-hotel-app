"use client";

import { useParams } from "next/navigation";
import { useRoomType } from "@/features/room-types/hooks";
import { RoomTypeForm } from "@/features/room-types/components/room-type-form";
import { RoomTypeActions, RoomTypeHeading } from "@/features/room-types/components/room-type-header";
import { RoomTypePageError, RoomTypePageSkeleton } from "@/features/room-types/components/room-type-page-states";
import { RoomsCard } from "@/features/room-types/components/rooms-card";
import { RatesCard } from "@/features/rate-periods/components/rates-card";

export default function RoomTypePage() {
  const { hotelId, roomTypeId } = useParams<{ hotelId: string; roomTypeId: string }>();
  const { data: roomType, isPending, isError, error, refetch } = useRoomType(hotelId, roomTypeId);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      {isPending ? (
        <RoomTypePageSkeleton />
      ) : isError ? (
        <RoomTypePageError error={error} hotelId={hotelId} onRetry={() => void refetch()} />
      ) : (
        <>
          {/* Remount the form when another room type is opened so its defaults follow */}
          <RoomTypeForm
            key={roomType.id}
            hotelId={hotelId}
            currency={roomType.hotel.currency}
            roomType={roomType}
            heading={<RoomTypeHeading hotel={roomType.hotel} title={roomType.name} roomType={roomType} />}
            actions={<RoomTypeActions roomType={roomType} />}
          />
          <RoomsCard roomType={roomType} />
          <RatesCard roomType={roomType} />
        </>
      )}
    </main>
  );
}
