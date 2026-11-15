"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdminAmenity, AmenityScope } from "@booking/shared";
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
import { useAmenities } from "../hooks";
import { usageText } from "./delete-amenity-dialog";
import { SCOPE_LABEL } from "./scope-label";

type ScopeFilter = AmenityScope | "all";

const SCOPE_OPTIONS: { value: ScopeFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "HOTEL", label: SCOPE_LABEL.HOTEL },
  { value: "ROOM", label: SCOPE_LABEL.ROOM },
];

function isScopeFilter(value: string): value is ScopeFilter {
  return SCOPE_OPTIONS.some((o) => o.value === value);
}

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

  return (
    <div className="space-y-4">
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
          columns={COLUMNS}
          rows={data}
          getRowKey={(a) => a.id}
          busy={isFetching}
        />
      )}
    </div>
  );
}
