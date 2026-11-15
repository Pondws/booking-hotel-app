"use client";

import { useState } from "react";
import type { Booking } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
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
import { ApiError } from "@/lib/api";
import { useCancelBooking } from "../hooks";

export function CancelBookingDialog({ booking }: { booking: Booking }) {
  const [open, setOpen] = useState(false);
  const cancel = useCancelBooking(booking.hotel.slug);

  const onOpenChange = (next: boolean) => {
    if (cancel.isPending) return;
    if (next) cancel.reset();
    setOpen(next);
  };

  const message =
    cancel.error instanceof ApiError ? cancel.error.message : "Could not cancel this booking. Try again.";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Cancel booking</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            {booking.hotel.name} · {booking.code}. The room will be released and you can book again later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {cancel.isError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {message}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancel.isPending}>Keep booking</AlertDialogCancel>
          <AlertDialogAction
            disabled={cancel.isPending}
            onClick={(event) => {
              // Stay open to show a failure; close ourselves on success
              event.preventDefault();
              cancel.mutate(booking.code, { onSuccess: () => setOpen(false) });
            }}
          >
            {cancel.isPending ? "Cancelling…" : "Yes, cancel booking"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
