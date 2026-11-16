"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Plus } from "lucide-react";
import { wishlistInputSchema, type WishlistInput } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@booking/ui/components/dialog";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { Skeleton } from "@booking/ui/components/skeleton";
import { cn } from "@booking/ui/lib/utils";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { thaiResolver } from "@/lib/messages-th";
import { useCreateWishlist, useToggleSaved, useWishlists } from "../hooks";

type Props = {
  hotelId: string;
  hotelName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Airbnb-style: tick the lists this hotel belongs to, or make a new list (which saves it there too). */
export function SaveToWishlistDialog({ hotelId, hotelName, open, onOpenChange }: Props) {
  const { data: lists, isPending, isError, refetch, isFetching } = useWishlists();
  const toggle = useToggleSaved();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>บันทึกลงรายการโปรด</DialogTitle>
          <DialogDescription>{hotelName}</DialogDescription>
        </DialogHeader>

        {isPending ? (
          <div className="space-y-2" role="status" aria-busy="true" aria-label="กำลังโหลดรายการโปรด">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : isError ? (
          <div className="space-y-2">
            <p className="text-sm">โหลดรายการโปรดไม่ได้</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? "กำลังลองใหม่…" : "ลองใหม่"}
            </Button>
          </div>
        ) : (
          <>
            {lists.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีรายการ สร้างรายการแรกด้านล่างได้เลย</p>
            ) : (
              <ul className="space-y-2" aria-label="รายการโปรดของคุณ">
                {lists.map((list) => {
                  const saved = list.hotelIds.includes(hotelId);
                  return (
                    <li key={list.id}>
                      <button
                        type="button"
                        aria-pressed={saved}
                        onClick={() => toggle.mutate({ wishlistId: list.id, hotelId, saved: !saved })}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
                          saved && "border-primary",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{list.name}</span>
                          <span className="text-xs text-muted-foreground">{list.hotelIds.length} ที่พัก</span>
                        </span>
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full border",
                            saved && "border-primary bg-primary text-primary-foreground",
                          )}
                        >
                          {saved && <Check className="size-4" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {toggle.isError && (
              <p role="alert" className="text-sm text-destructive">
                {formErrorMessage(toggle.error)}
              </p>
            )}
            <NewListForm hotelId={hotelId} />
            <Link
              href="/wishlist"
              className="inline-flex min-h-6 items-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ดูรายการโปรดทั้งหมด
            </Link>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewListForm({ hotelId }: { hotelId: string }) {
  const create = useCreateWishlist();
  const toggle = useToggleSaved();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<WishlistInput>({ resolver: thaiResolver(zodResolver(wishlistInputSchema)), defaultValues: { name: "" } });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    create.mutate(values, {
      onSuccess: (list) => {
        reset({ name: "" });
        toggle.mutate({ wishlistId: list.id, hotelId, saved: true });
      },
      onError: (error) => {
        if (!applyServerFieldErrors(error, setError, ["name"])) setFormError(formErrorMessage(error));
      },
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate aria-label="สร้างรายการใหม่" className="space-y-2 border-t pt-4">
      <Label htmlFor={`new-wishlist-${hotelId}`}>สร้างรายการใหม่</Label>
      <div className="flex gap-2">
        <Input
          id={`new-wishlist-${hotelId}`}
          placeholder="เช่น ทริปเชียงใหม่"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        <Button type="submit" disabled={create.isPending}>
          <Plus aria-hidden className="size-4" />
          {create.isPending ? "กำลังสร้าง…" : "สร้าง"}
        </Button>
      </div>
      {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
    </form>
  );
}
