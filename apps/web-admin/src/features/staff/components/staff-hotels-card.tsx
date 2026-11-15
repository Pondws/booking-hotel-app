"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import type { AdminStaff } from "@booking/shared";
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
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { Skeleton } from "@booking/ui/components/skeleton";
import { useAdminHotels } from "@/features/hotels/hooks";
import { formErrorMessage } from "@/lib/form-errors";
import { useAssignStaffHotel, useRemoveStaffHotel } from "../hooks";

type StaffHotel = AdminStaff["hotels"][number];

const PICKER_PAGE_SIZE = 8;

/** Hotels this staff member runs — access follows these links on the next request. */
export function StaffHotelsCard({ staff }: { staff: AdminStaff }) {
  const [picking, setPicking] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>โรงแรมที่ดูแล</CardTitle>
          <p className="text-sm text-muted-foreground">
            พนักงานจัดการได้เฉพาะโรงแรมในรายการนี้ การเปลี่ยนแปลงมีผลทันที
          </p>
        </div>
        {!picking && (
          <Button type="button" variant="outline" onClick={() => setPicking(true)}>
            <Plus className="size-4" aria-hidden />
            เพิ่มโรงแรม
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {picking && <HotelPicker staff={staff} onDone={() => setPicking(false)} />}
        {staff.hotels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            ยังไม่ได้มอบหมายโรงแรม พนักงานคนนี้จะยังจัดการอะไรไม่ได้
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {staff.hotels.map((hotel) => (
              <li key={hotel.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/hotels/${hotel.id}`} className="font-medium hover:underline">
                      {hotel.name}
                    </Link>
                    {!hotel.isActive && <Badge variant="outline">ปิดใช้งาน</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{hotel.city}</p>
                </div>
                <RemoveHotelDialog staff={staff} hotel={hotel} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function HotelPicker({ staff, onDone }: { staff: AdminStaff; onDone: () => void }) {
  const [q, setQ] = useState<string | undefined>(undefined);
  const hotels = useAdminHotels({ q, status: "all", page: 1, pageSize: PICKER_PAGE_SIZE });
  const assign = useAssignStaffHotel(staff.id);
  const assigned = new Set(staff.hotels.map((h) => h.id));

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <form
        role="search"
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("q");
          setQ(typeof value === "string" && value.trim() ? value.trim() : undefined);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="staff-hotel-search">ค้นหาโรงแรม</Label>
          <Input id="staff-hotel-search" name="q" placeholder="ชื่อหรือเมือง" autoFocus />
        </div>
        <Button type="submit" variant="outline">
          ค้นหา
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          ปิด
        </Button>
      </form>

      {assign.isError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formErrorMessage(assign.error)}
        </p>
      )}

      {hotels.isPending ? (
        <div className="space-y-2" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : hotels.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-destructive">โหลดรายการโรงแรมไม่สำเร็จ</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void hotels.refetch()}>
            ลองอีกครั้ง
          </Button>
        </div>
      ) : hotels.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {q !== undefined ? "ไม่พบโรงแรมที่ตรงกับคำค้นหา" : "ยังไม่มีโรงแรม"}
        </p>
      ) : (
        <>
          <ul className="divide-y" aria-busy={hotels.isPlaceholderData}>
            {hotels.data.items.map((hotel) => {
              const isAssigned = assigned.has(hotel.id);
              const isAdding = assign.isPending && assign.variables === hotel.id;
              return (
                <li key={hotel.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <span className="font-medium">{hotel.name}</span>{" "}
                    <span className="text-sm text-muted-foreground">{hotel.city}</span>
                    {!hotel.isActive && (
                      <Badge variant="outline" className="ml-2">
                        ปิดใช้งาน
                      </Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={isAssigned ? "ghost" : "outline"}
                    disabled={isAssigned || assign.isPending}
                    aria-label={isAssigned ? `ดูแล ${hotel.name} อยู่แล้ว` : `เพิ่ม ${hotel.name}`}
                    onClick={() => assign.mutate(hotel.id)}
                  >
                    {isAssigned ? "ดูแลอยู่แล้ว" : isAdding ? "กำลังเพิ่ม…" : "เพิ่ม"}
                  </Button>
                </li>
              );
            })}
          </ul>
          {hotels.data.total > hotels.data.items.length && (
            <p className="text-sm text-muted-foreground">
              แสดง {hotels.data.items.length} จาก {hotels.data.total} โรงแรม พิมพ์ชื่อเพื่อค้นหาให้แคบลง
            </p>
          )}
        </>
      )}
    </div>
  );
}

function RemoveHotelDialog({ staff, hotel }: { staff: AdminStaff; hotel: StaffHotel }) {
  const [open, setOpen] = useState(false);
  const mutation = useRemoveStaffHotel(staff.id);
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
        <Button type="button" size="sm" variant="ghost" className="text-destructive" aria-label={`เอา ${hotel.name} ออก`}>
          เอาออก
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>เอา {hotel.name} ออกจาก {staff.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {staff.name} จะเข้าถึงโรงแรมนี้ไม่ได้ทันที เพิ่มกลับได้ภายหลัง
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
              // Stay open to show a failure; close on success
              event.preventDefault();
              mutation.mutate(hotel.id, { onSuccess: () => setOpen(false) });
            }}
          >
            {mutation.isPending ? "กำลังเอาออก…" : "เอาออก"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
