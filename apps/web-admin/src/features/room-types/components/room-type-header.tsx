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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@booking/ui/components/card";
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

/** Deactivate / Reactivate, and Delete while nothing depends on the room type — at the bottom of the details tab. */
export function RoomTypeStatusCard({ roomType }: { roomType: AdminRoomType }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>สถานะประเภทห้อง</CardTitle>
        <CardDescription>
          {roomType.isActive
            ? "เปิดใช้งานอยู่ ลูกค้าค้นหาและจองห้องประเภทนี้ได้"
            : "ปิดใช้งานอยู่ ลูกค้าค้นหาและจองห้องประเภทนี้ไม่ได้"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <StatusDialog roomType={roomType} />
          {roomType.deletable && <DeleteDialog roomType={roomType} />}
        </div>
        {!roomType.deletable && (
          <p className="text-sm text-muted-foreground">ลบได้เฉพาะตอนที่ยังไม่มีห้องพักหรือช่วงราคา</p>
        )}
      </CardContent>
    </Card>
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
          {deactivating ? "ปิดใช้งาน" : "เปิดใช้งานอีกครั้ง"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {deactivating ? `ปิดใช้งาน ${roomType.name}?` : `เปิดใช้งาน ${roomType.name} อีกครั้ง?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {deactivating
              ? "ลูกค้าจะค้นหาหรือจองห้องประเภทนี้ไม่ได้ การจองที่มีอยู่จะยังคงอยู่"
              : "ลูกค้าจะค้นหาและจองห้องประเภทนี้ได้อีกครั้ง"}
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
              mutation.mutate(!roomType.isActive, { onSuccess: () => setOpen(false) });
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
          ลบ
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ลบ {roomType.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            ประเภทห้องนี้ยังไม่มีห้องพักหรือช่วงราคา จึงลบออกถาวรได้ การลบนี้ย้อนกลับไม่ได้
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
              event.preventDefault();
              mutation.mutate(undefined, { onSuccess: () => router.replace(`/hotels/${hotelId}`) });
            }}
          >
            {mutation.isPending ? "กำลังลบ…" : "ลบ"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
