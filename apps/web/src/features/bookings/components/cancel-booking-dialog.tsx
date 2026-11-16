"use client";

import { useQueryClient } from "@tanstack/react-query";
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
import { formatMoney } from "@/features/hotels/format";
import { ApiError } from "@/lib/api";
import { toThai } from "@/lib/messages-th";
import { bookingKeys, useCancelBooking } from "../hooks";

type Props = { booking: Booking; /** True while the dialog is open, so the parent keeps it mounted. */ onActiveChange: (active: boolean) => void };

export function CancelBookingDialog({ booking, onActiveChange }: Props) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const cancel = useCancelBooking(booking.hotel.slug);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    onActiveChange(next);
  };

  const onOpenChange = (next: boolean) => {
    if (cancel.isPending) return;
    if (next) cancel.reset();
    else if (cancel.isError) {
      // Refresh only once the message has been read: the booking is no longer cancellable and this dialog unmounts
      void queryClient.invalidateQueries({ queryKey: bookingKeys.detail(booking.code) });
      void queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    }
    changeOpen(next);
  };

  const message =
    cancel.error instanceof ApiError ? toThai(cancel.error.message) : "ยกเลิกการจองไม่สำเร็จ กรุณาลองใหม่";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">ยกเลิกการจอง</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ยกเลิกการจองนี้?</AlertDialogTitle>
          <AlertDialogDescription>
            {booking.hotel.name} · {booking.code} ห้องจะถูกปล่อยคืน และคุณจองใหม่ได้ภายหลัง
            {booking.payment?.status === "SUCCEEDED" &&
              ` คุณจะได้รับเงินคืนเต็มจำนวน ${formatMoney(booking.totalAmount, booking.currency)}`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {cancel.isError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {message}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancel.isPending}>เก็บการจองไว้</AlertDialogCancel>
          <AlertDialogAction
            disabled={cancel.isPending}
            onClick={(event) => {
              // Stay open to show a failure; close ourselves on success
              event.preventDefault();
              cancel.mutate(booking.code, { onSuccess: () => changeOpen(false) });
            }}
          >
            {cancel.isPending ? "กำลังยกเลิก…" : "ยืนยันยกเลิกการจอง"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
