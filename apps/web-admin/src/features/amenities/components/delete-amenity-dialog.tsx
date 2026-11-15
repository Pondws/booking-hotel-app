"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminAmenity } from "@booking/shared";
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
import { useDeleteAmenity } from "../hooks";

export function usageText(a: AdminAmenity): string {
  if (a.scope === "HOTEL") return a.hotelCount === 0 ? "ยังไม่มีโรงแรมใช้" : `${a.hotelCount} โรงแรม`;
  return a.roomTypeCount === 0 ? "ยังไม่มีประเภทห้องใช้" : `${a.roomTypeCount} ประเภทห้อง`;
}

/** Delete from the amenity page, then back to the catalog. The dialog says where it's in use first. */
export function DeleteAmenityDialog({ amenity }: { amenity: AdminAmenity }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const mutation = useDeleteAmenity();
  const inUse = amenity.hotelCount + amenity.roomTypeCount > 0;
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
          ลบ
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ลบ {amenity.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {inUse
              ? `ตอนนี้ใช้อยู่ใน ${usageText(amenity)} รายการนี้จะถูกเอาออกจากทุกแห่งที่ใช้ และย้อนกลับไม่ได้`
              : "ยังไม่มีที่ใดใช้รายการนี้ การลบย้อนกลับไม่ได้"}
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
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={(event) => {
              // Stay open to show a failure; leave the page on success
              event.preventDefault();
              mutation.mutate(amenity.id, { onSuccess: () => router.push("/amenities") });
            }}
          >
            {mutation.isPending ? "กำลังลบ…" : "ลบ"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
