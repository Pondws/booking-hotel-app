"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { BOOKING_TZ, todayIn, type AdminPromotion } from "@booking/shared";
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
import { Pagination } from "@/components/pagination";
import { formatDate } from "@/features/room-types/format";
import { formErrorMessage } from "@/lib/form-errors";
import { useClientPagination } from "@/lib/use-client-pagination";
import { useDeletePromotion, usePromotions } from "../hooks";
import { PromotionForm } from "./promotion-form";
import { PROMOTION_TYPE_LABEL } from "./promotion-type-label";

type Editor = { mode: "new" } | { mode: "edit"; promotion: AdminPromotion } | null;

function conditions(p: AdminPromotion): string {
  const parts: string[] = [];
  if (p.minDaysAhead !== null) parts.push(`ล่วงหน้า ≥ ${p.minDaysAhead} วัน`);
  if (p.maxDaysAhead !== null) parts.push(`ภายใน ${p.maxDaysAhead} วัน`);
  if (p.minNights > 1) parts.push(`≥ ${p.minNights} คืน`);
  if (p.code) parts.push(`โค้ด ${p.code}`);
  return parts.length > 0 ? parts.join(" · ") : "ทุกการเข้าพัก";
}

function PromotionStatus({ p, today }: { p: AdminPromotion; today: string }) {
  if (!p.isActive) return <Badge variant="outline">ปิดใช้งาน</Badge>;
  if (p.validUntil !== null && p.validUntil < today) return <Badge variant="outline">หมดเขตแล้ว</Badge>;
  if (p.validFrom !== null && p.validFrom > today) return <Badge variant="secondary">ยังไม่เริ่ม</Badge>;
  return <Badge>ใช้งานอยู่</Badge>;
}

/** A hotel's deals (11.5). The best eligible one comes off each new quote; deals never stack. */
export function PromotionsCard({ hotelId }: { hotelId: string }) {
  const { data, isPending, isError, error, refetch, isFetching } = usePromotions(hotelId);
  const [editor, setEditor] = useState<Editor>(null);
  const { pageRows, paginationProps } = useClientPagination(data);
  const today = todayIn(BOOKING_TZ);

  const columns: DataTableColumn<AdminPromotion>[] = [
    {
      id: "name",
      header: "โปรโมชัน",
      cell: (p) => (
        <div className="space-y-0.5">
          <p className="font-medium">{p.name}</p>
          <p className="text-sm text-muted-foreground">
            {PROMOTION_TYPE_LABEL[p.type]} · {conditions(p)}
          </p>
        </div>
      ),
    },
    { id: "percent", header: "ส่วนลด", className: "tabular-nums", cell: (p) => `${p.percentOff}%` },
    {
      id: "window",
      header: "ช่วงที่จองได้",
      cell: (p) =>
        p.validFrom === null && p.validUntil === null ? (
          <span className="text-muted-foreground">ไม่จำกัด</span>
        ) : (
          <span className="tabular-nums">
            {p.validFrom ? formatDate(p.validFrom) : "…"} – {p.validUntil ? formatDate(p.validUntil) : "…"}
          </span>
        ),
    },
    {
      id: "status",
      header: "สถานะ",
      cell: (p) => (
        <div className="flex flex-wrap items-center gap-2">
          <PromotionStatus p={p} today={today} />
          <span className="text-sm text-muted-foreground">{p.bookingCount} การจอง</span>
        </div>
      ),
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
            aria-label={`แก้ไข ${p.name}`}
            onClick={() => setEditor({ mode: "edit", promotion: p })}
          >
            แก้ไข
          </Button>
          <DeletePromotionDialog hotelId={hotelId} promotion={p} />
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>โปรโมชัน</CardTitle>
          <p className="text-sm text-muted-foreground">
            ส่วนลดเป็นเปอร์เซ็นต์จากราคาห้อง แสดงในหน้าดีลพิเศษและคำนวณให้อัตโนมัติตอนลูกค้าจอง
          </p>
        </div>
        {editor === null && (
          <Button type="button" variant="outline" onClick={() => setEditor({ mode: "new" })}>
            <Plus className="size-4" aria-hidden />
            เพิ่มโปรโมชัน
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {editor !== null && (
          <PromotionForm
            key={editor.mode === "edit" ? editor.promotion.id : "new"}
            hotelId={hotelId}
            promotion={editor.mode === "edit" ? editor.promotion : undefined}
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
            caption="โปรโมชันของโรงแรม"
            columns={columns}
            rows={pageRows}
            getRowKey={(p) => p.id}
            busy={isFetching}
            empty="ยังไม่มีโปรโมชัน ลูกค้าจ่ายราคาปกติ"
            pagination={<Pagination {...paginationProps} label="หน้ารายการโปรโมชัน" />}
          />
        )}
      </CardContent>
    </Card>
  );
}

function DeletePromotionDialog({ hotelId, promotion }: { hotelId: string; promotion: AdminPromotion }) {
  const [open, setOpen] = useState(false);
  const mutation = useDeletePromotion(hotelId);
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
        <Button type="button" size="sm" variant="ghost" className="text-destructive" aria-label={`ลบ ${promotion.name}`}>
          ลบ
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ลบ {promotion.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            การจองใหม่จะไม่ได้รับส่วนลดนี้อีก การจองที่มีอยู่ ({promotion.bookingCount}) ยังคงราคาและส่วนลดเดิม
            ถ้าแค่อยากหยุดชั่วคราว ให้แก้ไขแล้วปิดใช้งานแทน
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
              mutation.mutate(promotion.id, { onSuccess: () => setOpen(false) });
            }}
          >
            {mutation.isPending ? "กำลังลบ…" : "ลบ"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
