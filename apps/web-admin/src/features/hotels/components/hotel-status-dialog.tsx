"use client";

import { useState } from "react";
import type { AdminHotel } from "@booking/shared";
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
import { formErrorMessage } from "@/lib/form-errors";
import { useSetHotelStatus } from "../hooks";

/** ADMIN only — Deactivate / Reactivate behind a confirm dialog. */
export function HotelStatusDialog({ hotel }: { hotel: AdminHotel }) {
  const [open, setOpen] = useState(false);
  const mutation = useSetHotelStatus(hotel.id);
  const deactivating = hotel.isActive;

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
        <Button variant="outline">{deactivating ? "Deactivate" : "Reactivate"}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {deactivating ? `Deactivate ${hotel.name}?` : `Reactivate ${hotel.name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {deactivating
              ? "It disappears from search and can't be booked. Existing bookings are kept."
              : "It shows up in search again and can be booked."}
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
              mutation.mutate(!hotel.isActive, { onSuccess: () => setOpen(false) });
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
