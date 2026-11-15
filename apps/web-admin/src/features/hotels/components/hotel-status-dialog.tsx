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
        <Button type="button" variant="outline">
          {deactivating ? "ปิดใช้งาน" : "เปิดใช้งานอีกครั้ง"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {deactivating ? `ปิดใช้งาน ${hotel.name}?` : `เปิดใช้งาน ${hotel.name} อีกครั้ง?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {deactivating
              ? "โรงแรมจะไม่แสดงในผลการค้นหาและจองไม่ได้ การจองที่มีอยู่จะยังคงอยู่"
              : "โรงแรมจะแสดงในผลการค้นหาและจองได้อีกครั้ง"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mutation.isError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {formErrorMessage(mutation.error)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>ยกเลิก</AlertDialogCancel>
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
                ? "กำลังปิดใช้งาน…"
                : "กำลังเปิดใช้งาน…"
              : deactivating
                ? "ปิดใช้งาน"
                : "เปิดใช้งานอีกครั้ง"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
