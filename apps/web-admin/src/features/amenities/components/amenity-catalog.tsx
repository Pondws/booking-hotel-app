"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdminAmenity, AmenityScope } from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import { DataTable, DataTableSkeleton, type DataTableColumn } from "@booking/ui/components/data-table";
import { Label } from "@booking/ui/components/label";
import { SelectField, type SelectOption } from "@booking/ui/components/select-field";
import { Pagination } from "@/components/pagination";
import { formErrorMessage } from "@/lib/form-errors";
import { useClientPagination } from "@/lib/use-client-pagination";
import { useAmenities } from "../hooks";
import { usageText } from "./delete-amenity-dialog";
import { SCOPE_LABEL } from "./scope-label";

type ScopeFilter = AmenityScope | "all";

const SCOPE_OPTIONS: SelectOption<ScopeFilter>[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "HOTEL", label: SCOPE_LABEL.HOTEL },
  { value: "ROOM", label: SCOPE_LABEL.ROOM },
];

const COLUMNS: DataTableColumn<AdminAmenity>[] = [
  {
    id: "name",
    header: "ชื่อ",
    className: "font-medium",
    cell: (a) => (
      <Link href={`/amenities/${a.id}`} className="hover:underline">
        {a.name}
      </Link>
    ),
  },
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
      <Button asChild size="sm" variant="ghost">
        <Link href={`/amenities/${a.id}`} aria-label={`แก้ไข ${a.name}`}>
          แก้ไข
        </Link>
      </Button>
    ),
  },
];

/** ADMIN — the amenity catalog the hotel / room type forms pick from. Each one opens its own page. */
export function AmenityCatalog() {
  const [scope, setScope] = useState<ScopeFilter>("all");
  const { data, isPending, isError, error, refetch, isFetching } = useAmenities(
    scope === "all" ? undefined : scope,
  );
  const { pageRows, setPage, paginationProps } = useClientPagination(data);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="amenity-scope-filter">ใช้กับ</Label>
        <SelectField
          id="amenity-scope-filter"
          className="w-40"
          options={SCOPE_OPTIONS}
          value={scope}
          onValueChange={(next) => {
            setScope(next);
            setPage(1);
          }}
        />
      </div>

      {isPending ? (
        <DataTableSkeleton />
      ) : isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-destructive">{formErrorMessage(error)}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
            ลองอีกครั้ง
          </Button>
        </div>
      ) : (
        <DataTable
          fill
          caption="สิ่งอำนวยความสะดวก"
          columns={COLUMNS}
          rows={pageRows}
          getRowKey={(a) => a.id}
          busy={isFetching}
          empty={
            scope === "all" ? "ยังไม่มีสิ่งอำนวยความสะดวกในระบบ" : `ยังไม่มีสิ่งอำนวยความสะดวกของ${SCOPE_LABEL[scope]}`
          }
          pagination={
            <Pagination
              {...paginationProps}
              label="หน้ารายการสิ่งอำนวยความสะดวก"
            />
          }
        />
      )}
    </div>
  );
}
