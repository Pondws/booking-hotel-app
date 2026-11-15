"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminRoomType } from "@booking/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@booking/ui/components/alert-dialog";
import { Button } from "@booking/ui/components/button";
import { HotelStatusBadge } from "@/features/hotels/components/hotel-list";
import { formErrorMessage } from "@/lib/form-errors";
import { useDeleteRoomType, useSetRoomTypeStatus } from "../hooks";

/** Breadcrumb back to the hotel + title block. */
export function RoomTypeHeading({
  hotel,
  title,
  roomType,
}: {
  hotel: { id: string; name: string };
  title: string;
  roomType?: AdminRoomType;
}) {
  return (
    <div className="space-y-1">
      <Link href={`/hotels/${hotel.id}`} className="text-sm text-muted-foreground hover:underline">
        {hotel.name}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {roomType && <HotelStatusBadge isActive={roomType.isActive} />}
      </div>
    </div>
  );
}

/** Deactivate / Reactivate, and Delete while nothing depends on the room type. */
export function RoomTypeActions({ roomType }: { roomType: AdminRoomType }) {
  return (
    <>
      <StatusDialog roomType={roomType} />
      {roomType.deletable && <DeleteDialog roomType={roomType} />}
    </>
  );
}

function StatusDialog({ roomType }: { roomType: AdminRoomType }) {
  const [open, setOpen] = useState(false);
  const mutation = useSetRoomTypeStatus(roomType.hotel.id, roomType.id);
  const deactivating = roomType.isActive;
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        if (next) mutation.reset();
        setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline">
          {deactivating ? "Deactivate" : "Reactivate"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {deactivating ? `Deactivate ${roomType.name}?` : `Reactivate ${roomType.name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {deactivating
              ? "Guests can no longer find or book it. Existing bookings are kept."
              : "Guests can find and book it again."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mutation.isError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {formErrorMessage(mutation.error)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(event) => {
              // Stay open to show a failure; close on success
              event.preventDefault();
              mutation.mutate(!roomType.isActive, { onSuccess: () => setOpen(false) });
            }}
          >
            {mutation.isPending
              ? deactivating
                ? "Deactivating…"
                : "Reactivating…"
              : deactivating
                ? "Deactivate"
                : "Reactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteDialog({ roomType }: { roomType: AdminRoomType }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const hotelId = roomType.hotel.id;
  const mutation = useDeleteRoomType(hotelId, roomType.id);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        if (next) mutation.reset();
        setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className="text-destructive">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {roomType.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            It has no rooms or rates yet, so it can be removed for good. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mutation.isError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {formErrorMessage(mutation.error)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault();
              mutation.mutate(undefined, { onSuccess: () => router.replace(`/hotels/${hotelId}`) });
            }}
          >
            {mutation.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
