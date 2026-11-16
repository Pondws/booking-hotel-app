"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { BOOKING_TZ, todayIn, type AdminRatePeriod, type AdminRoomType } from "@booking/shared";
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
import { DataTable, DataTableSkeleton, type DataTableColumn } from "@booking/ui/components/data-table";
import { formatDateRange, formatMoney } from "@/features/room-types/format";
import { Pagination } from "@/components/pagination";
import { formErrorMessage } from "@/lib/form-errors";
import { useClientPagination } from "@/lib/use-client-pagination";
import { useDeleteRatePeriod, useRatePeriods } from "../hooks";
import { RatePeriodForm } from "./rate-period-form";

type Editor = { mode: "new" } | { mode: "edit"; period: AdminRatePeriod } | null;

/** Seasonal prices of a room type: a period replaces the base price for the nights it covers. */
export function RatesCard({ roomType }: { roomType: AdminRoomType }) {
  const hotelId = roomType.hotel.id;
  const currency = roomType.hotel.currency;
  const { data: periods, isPending, isError, error, refetch, isFetching } = useRatePeriods(
    hotelId,
    roomType.id,
  );
  const [editor, setEditor] = useState<Editor>(null);
  const { pageRows, paginationProps } = useClientPagination(periods);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>ราคา</CardTitle>
          <p className="text-sm text-muted-foreground">
            ราคาพื้นฐาน {formatMoney(roomType.basePrice, currency)} ต่อคืน ช่วงราคาจะใช้แทนราคาพื้นฐานในคืนที่ครอบคลุม
            การจองที่มีอยู่จะใช้ราคาเดิม
          </p>
        </div>
        {editor === null && (
          <Button type="button" variant="outline" onClick={() => setEditor({ mode: "new" })}>
            <Plus className="size-4" aria-hidden />
            เพิ่มช่วงราคา
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {editor !== null && (
          <RatePeriodForm
            // Remount per period so the defaults follow
            key={editor.mode === "edit" ? editor.period.id : "new"}
            hotelId={hotelId}
            roomTypeId={roomType.id}
            currency={currency}
            period={editor.mode === "edit" ? editor.period : undefined}
            onDone={() => setEditor(null)}
          />
        )}
        {isPending ? (
          <DataTableSkeleton rows={2} />
        ) : isError ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-destructive">{formErrorMessage(error)}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
              ลองอีกครั้ง
            </Button>
          </div>
        ) : (
          <DataTable
            caption={`ช่วงราคาของ ${roomType.name}`}
            columns={columns(roomType, currency, (period) => setEditor({ mode: "edit", period }))}
            rows={pageRows}
            getRowKey={(p) => p.id}
            busy={isFetching}
            empty="ยังไม่มีช่วงราคา ทุกคืนใช้ราคาพื้นฐาน"
            pagination={
              <Pagination
                {...paginationProps}
                label="หน้ารายการช่วงราคา"
              />
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

function PeriodStatus({ period, today }: { period: AdminRatePeriod; today: string }) {
  if (period.endDate <= today) return <Badge variant="outline">สิ้นสุดแล้ว</Badge>;
  if (period.startDate <= today) return <Badge variant="secondary">กำลังใช้</Badge>;
  return null;
}

function columns(
  roomType: AdminRoomType,
  currency: string,
  onEdit: (period: AdminRatePeriod) => void,
): DataTableColumn<AdminRatePeriod>[] {
  const today = todayIn(BOOKING_TZ);
  return [
    {
      id: "name",
      header: "ชื่อ",
      className: "font-medium",
      cell: (p) => p.name ?? <span className="text-muted-foreground">ไม่มีชื่อ</span>,
    },
    {
      id: "dates",
      header: "คืน",
      cell: (p) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="tabular-nums">{formatDateRange(p.startDate, p.endDate)}</span>
          <span className="text-muted-foreground">
            {p.nights} คืน
          </span>
          <PeriodStatus period={p} today={today} />
        </div>
      ),
    },
    {
      id: "price",
      header: "ต่อคืน",
      className: "text-right tabular-nums",
      cell: (p) => formatMoney(p.price, currency),
    },
    {
      id: "actions",
      header: <span className="sr-only">การดำเนินการ</span>,
      className: "text-right",
      cell: (p) => (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`แก้ไข ${p.name ?? formatDateRange(p.startDate, p.endDate)}`}
            onClick={() => onEdit(p)}
          >
            แก้ไข
          </Button>
          <DeletePeriodDialog roomType={roomType} period={p} />
        </div>
      ),
    },
  ];
}

function DeletePeriodDialog({ roomType, period }: { roomType: AdminRoomType; period: AdminRatePeriod }) {
  const [open, setOpen] = useState(false);
  const mutation = useDeleteRatePeriod(roomType.hotel.id, roomType.id);
  const dates = formatDateRange(period.startDate, period.endDate);
  const title = period.name ?? dates;
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
        <Button type="button" size="sm" variant="ghost" className="text-destructive" aria-label={`ลบ ${title}`}>
          ลบ
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ลบ {title}?</AlertDialogTitle>
          <AlertDialogDescription>
            คืนวันที่ {dates} จะกลับไปใช้ราคาพื้นฐานสำหรับการจองใหม่ การจองที่มีอยู่จะใช้ราคาเดิม
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
              mutation.mutate(period.id, { onSuccess: () => setOpen(false) });
            }}
          >
            {mutation.isPending ? "กำลังลบ…" : "ลบ"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
