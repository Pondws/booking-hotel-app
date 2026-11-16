"use client";

import { useState } from "react";
import type { AdminReview } from "@booking/shared";
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
import { useSetReviewVisibility } from "../hooks";

/** Hide a visible review or show a hidden one, after a confirm that says what changes for guests. */
export function ReviewVisibilityDialog({ review }: { review: AdminReview }) {
  const [open, setOpen] = useState(false);
  const mutation = useSetReviewVisibility(review.id);
  const hide = !review.isHidden;
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
        <Button type="button" variant="outline" size="sm" className={hide ? "text-destructive" : undefined}>
          {hide ? "ซ่อน" : "แสดง"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{hide ? "ซ่อนรีวิวนี้?" : "แสดงรีวิวนี้อีกครั้ง?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {hide
              ? `รีวิวของ ${review.guestName} จะไม่แสดงในหน้าโรงแรม ${review.hotel.name} และไม่นับในคะแนนเฉลี่ย`
              : `รีวิวของ ${review.guestName} จะกลับมาแสดงในหน้าโรงแรม ${review.hotel.name} และนับในคะแนนเฉลี่ย`}
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
            className={hide ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            onClick={(event) => {
              // Stay open to show a failure
              event.preventDefault();
              mutation.mutate({ isHidden: hide }, { onSuccess: () => setOpen(false) });
            }}
          >
            {mutation.isPending ? "กำลังบันทึก…" : hide ? "ซ่อน" : "แสดง"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
