"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Heart, Plus } from "lucide-react";
import { wishlistInputSchema, type WishlistInput, type WishlistSummary } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { Skeleton } from "@booking/ui/components/skeleton";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { thaiResolver } from "@/lib/messages-th";
import { useCreateWishlist, useWishlists } from "../hooks";

const GRID = "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";

export function WishlistOverview() {
  const { data: lists, isPending, isError, refetch, isFetching } = useWishlists();

  if (isPending) return <WishlistOverviewSkeleton />;
  if (isError) {
    return (
      <div className="space-y-3 rounded-xl border p-6 text-center">
        <p className="text-sm">โหลดรายการโปรดไม่ได้ในขณะนี้</p>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "กำลังลองใหม่…" : "ลองใหม่"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {lists.length === 0 ? (
        <div className="space-y-2 rounded-xl border p-8 text-center">
          <Heart aria-hidden className="mx-auto size-8 text-muted-foreground" />
          <p className="font-medium">ยังไม่มีรายการโปรด</p>
          <p className="text-sm text-muted-foreground">
            กดหัวใจบนโรงแรมที่ถูกใจเพื่อบันทึก หรือสร้างรายการด้านล่างไว้ก่อนก็ได้
          </p>
          <Link href="/hotels" className="inline-flex min-h-6 items-center text-sm underline underline-offset-4">
            ค้นหาที่พัก
          </Link>
        </div>
      ) : (
        <ul className={GRID} aria-label="รายการโปรดของคุณ">
          {lists.map((list) => (
            <li key={list.id}>
              <WishlistTile list={list} />
            </li>
          ))}
        </ul>
      )}
      <CreateWishlistForm />
    </div>
  );
}

function WishlistTile({ list }: { list: WishlistSummary }) {
  return (
    <Link
      href={`/wishlist/${list.id}`}
      className="group block space-y-2 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
        {list.coverImage ? (
          <Image
            src={list.coverImage.url}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <Heart aria-hidden className="absolute top-1/2 left-1/2 size-8 -translate-1/2 text-muted-foreground" />
        )}
      </div>
      <div>
        <p className="truncate font-medium group-hover:underline">{list.name}</p>
        <p className="text-sm text-muted-foreground">{list.hotelIds.length} ที่พัก</p>
      </div>
    </Link>
  );
}

function CreateWishlistForm() {
  const create = useCreateWishlist();
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
      onSuccess: () => reset({ name: "" }),
      onError: (error) => {
        if (!applyServerFieldErrors(error, setError, ["name"])) setFormError(formErrorMessage(error));
      },
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate aria-label="สร้างรายการใหม่" className="max-w-sm space-y-2">
      <Label htmlFor="wishlist-new-name">สร้างรายการใหม่</Label>
      <div className="flex gap-2">
        <Input
          id="wishlist-new-name"
          placeholder="เช่น ทะเลปลายปี"
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

export function WishlistOverviewSkeleton() {
  return (
    <div className={GRID} role="status" aria-busy="true" aria-label="กำลังโหลดรายการโปรด">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[4/3] rounded-xl" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  );
}
