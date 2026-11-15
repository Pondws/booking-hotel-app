"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { AdminAmenity, AmenityScope } from "@booking/shared";
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
import { DataTable, DataTableSkeleton, type DataTableColumn } from "@booking/ui/components/data-table";
import { Label } from "@booking/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@booking/ui/components/select";
import { formErrorMessage } from "@/lib/form-errors";
import { useAmenities, useDeleteAmenity } from "../hooks";
import { AmenityForm } from "./amenity-form";
import { SCOPE_LABEL } from "./scope-label";

type ScopeFilter = AmenityScope | "all";
type Editor = { mode: "new" } | { mode: "edit"; amenity: AdminAmenity } | null;

const SCOPE_OPTIONS: { value: ScopeFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "HOTEL", label: SCOPE_LABEL.HOTEL },
  { value: "ROOM", label: SCOPE_LABEL.ROOM },
];

function isScopeFilter(value: string): value is ScopeFilter {
  return SCOPE_OPTIONS.some((o) => o.value === value);
}

function usageText(a: AdminAmenity): string {
  if (a.scope === "HOTEL") return a.hotelCount === 0 ? "ยังไม่มีโรงแรมใช้" : `${a.hotelCount} โรงแรม`;
  return a.roomTypeCount === 0 ? "ยังไม่มีประเภทห้องใช้" : `${a.roomTypeCount} ประเภทห้อง`;
}

/** ADMIN — the amenity catalog the hotel / room type forms pick from. */
export function AmenityCatalog() {
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [editor, setEditor] = useState<Editor>(null);
  const { data, isPending, isError, error, refetch, isFetching } = useAmenities(
    scope === "all" ? undefined : scope,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Label htmlFor="amenity-scope-filter">ใช้กับ</Label>
          <Select
            value={scope}
            onValueChange={(value) => {
              if (isScopeFilter(value)) setScope(value);
            }}
          >
            <SelectTrigger id="amenity-scope-filter" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {editor === null && (
          <Button type="button" onClick={() => setEditor({ mode: "new" })}>
            <Plus className="size-4" aria-hidden />
            เพิ่มสิ่งอำนวยความสะดวก
          </Button>
        )}
      </div>

      {editor !== null && (
        <AmenityForm
          key={editor.mode === "edit" ? editor.amenity.id : "new"}
          amenity={editor.mode === "edit" ? editor.amenity : undefined}
          onDone={() => setEditor(null)}
        />
      )}

      {isPending ? (
        <DataTableSkeleton />
      ) : isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-destructive">{formErrorMessage(error)}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
            ลองอีกครั้ง
          </Button>
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {scope === "all" ? "ยังไม่มีสิ่งอำนวยความสะดวกในระบบ" : `ยังไม่มีสิ่งอำนวยความสะดวกของ${SCOPE_LABEL[scope]}`}
        </p>
      ) : (
        <DataTable
          caption="สิ่งอำนวยความสะดวก"
          columns={columns((amenity) => setEditor({ mode: "edit", amenity }))}
          rows={data}
          getRowKey={(a) => a.id}
          busy={isFetching}
        />
      )}
    </div>
  );
}

function columns(onEdit: (amenity: AdminAmenity) => void): DataTableColumn<AdminAmenity>[] {
  return [
    { id: "name", header: "ชื่อ", className: "font-medium", cell: (a) => a.name },
    {
      id: "code",
      header: "รหัส",
      cell: (a) => <code className="font-mono text-sm text-muted-foreground">{a.code}</code>,
    },
    {
      id: "scope",
      header: "ใช้กับ",
      cell: (a) => <Badge variant={a.scope === "HOTEL" ? "secondary" : "outline"}>{SCOPE_LABEL[a.scope]}</Badge>,
    },
    { id: "usage", header: "ใช้งานอยู่", className: "text-muted-foreground", cell: usageText },
    {
      id: "actions",
      header: <span className="sr-only">การดำเนินการ</span>,
      className: "text-right",
      cell: (a) => (
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" aria-label={`แก้ไข ${a.name}`} onClick={() => onEdit(a)}>
            แก้ไข
          </Button>
          <DeleteAmenityDialog amenity={a} />
        </div>
      ),
    },
  ];
}

function DeleteAmenityDialog({ amenity }: { amenity: AdminAmenity }) {
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
        <Button type="button" size="sm" variant="ghost" className="text-destructive" aria-label={`ลบ ${amenity.name}`}>
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
              // Stay open to show a failure; close on success
              event.preventDefault();
              mutation.mutate(amenity.id, { onSuccess: () => setOpen(false) });
            }}
          >
            {mutation.isPending ? "กำลังลบ…" : "ลบ"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
