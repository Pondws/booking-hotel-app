"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Heart, Pencil } from "lucide-react";
import { wishlistInputSchema, type WishlistDetail, type WishlistInput } from "@booking/shared";
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
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { Skeleton } from "@booking/ui/components/skeleton";
import { HotelCard, HotelCardSkeleton } from "@/features/hotels/components/hotel-card";
import { ApiError } from "@/lib/api";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { thaiResolver } from "@/lib/messages-th";
import { useDeleteWishlist, useRenameWishlist, useWishlist } from "../hooks";

const GRID = "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";
const NO_STAY = {};

const BackLink = () => (
  <Link
    href="/wishlist"
    className="inline-flex min-h-6 items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline"
  >
    <ArrowLeft aria-hidden className="size-4" />
    รายการโปรดทั้งหมด
  </Link>
);

export function WishlistDetailView({ wishlistId }: { wishlistId: string }) {
  const { data: list, isPending, isError, error, refetch, isFetching } = useWishlist(wishlistId);

  if (isPending) return <WishlistDetailSkeleton />;
  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">ไม่พบรายการโปรด</h1>
          <p className="text-sm text-muted-foreground">รายการนี้อาจถูกลบไปแล้ว</p>
          <BackLink />
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <BackLink />
        <div className="space-y-3 rounded-xl border p-6 text-center">
          <p className="text-sm">โหลดรายการโปรดไม่ได้ในขณะนี้</p>
          <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? "กำลังลองใหม่…" : "ลองใหม่"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <BackLink />
        {/* Remount after a rename so the form starts from the saved name */}
        <WishlistHeader key={list.name} list={list} />
      </header>
      {list.hotels.length === 0 ? (
        <div className="space-y-2 rounded-xl border p-8 text-center">
          <Heart aria-hidden className="mx-auto size-8 text-muted-foreground" />
          <p className="font-medium">ยังไม่มีที่พักในรายการนี้</p>
          <p className="text-sm text-muted-foreground">กดหัวใจบนโรงแรมที่ถูกใจแล้วเลือกรายการนี้</p>
          <Link href="/hotels" className="inline-flex min-h-6 items-center text-sm underline underline-offset-4">
            ค้นหาที่พัก
          </Link>
        </div>
      ) : (
        <ul className={GRID} aria-label={`ที่พักใน ${list.name}`}>
          {list.hotels.map((hotel) => (
            <li key={hotel.id}>
              <HotelCard hotel={hotel} stay={NO_STAY} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WishlistHeader({ list }: { list: WishlistDetail }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <RenameForm list={list} onDone={() => setEditing(false)} />;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{list.name}</h1>
        <p className="text-sm text-muted-foreground">{list.hotels.length} ที่พัก</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil aria-hidden className="size-4" />
          เปลี่ยนชื่อ
        </Button>
        <DeleteWishlistDialog list={list} />
      </div>
    </div>
  );
}

function RenameForm({ list, onDone }: { list: WishlistDetail; onDone: () => void }) {
  const rename = useRenameWishlist(list.id);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<WishlistInput>({
    resolver: thaiResolver(zodResolver(wishlistInputSchema)),
    defaultValues: { name: list.name },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    rename.mutate(values, {
      onSuccess: onDone,
      onError: (error) => {
        if (!applyServerFieldErrors(error, setError, ["name"])) setFormError(formErrorMessage(error));
      },
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate aria-label="เปลี่ยนชื่อรายการ" className="max-w-sm space-y-2">
      <Label htmlFor="wishlist-rename">ชื่อรายการ</Label>
      <Input id="wishlist-rename" autoFocus aria-invalid={!!errors.name} {...register("name")} />
      {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={rename.isPending}>
          {rename.isPending ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={rename.isPending}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}

function DeleteWishlistDialog({ list }: { list: WishlistDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const remove = useDeleteWishlist(list.id);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (remove.isPending) return;
        if (next) remove.reset();
        setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive">
          ลบรายการ
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ลบ “{list.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            ที่พัก {list.hotels.length} แห่งในรายการนี้จะถูกเอาออกจากรายการด้วย การจองที่มีอยู่ไม่ได้รับผลกระทบ
          </AlertDialogDescription>
        </AlertDialogHeader>
        {remove.isError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {formErrorMessage(remove.error)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction
            disabled={remove.isPending}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={(event) => {
              // Stay open to show a failure
              event.preventDefault();
              remove.mutate(undefined, { onSuccess: () => router.replace("/wishlist") });
            }}
          >
            {remove.isPending ? "กำลังลบ…" : "ลบรายการ"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function WishlistDetailSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="กำลังโหลดรายการโปรด">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-1/3" />
      <div className={GRID}>
        {Array.from({ length: 3 }, (_, i) => (
          <HotelCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
