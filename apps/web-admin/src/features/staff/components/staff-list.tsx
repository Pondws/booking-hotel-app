"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AdminStaffListQuery, AdminStaffSummary } from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import { DataTable, DataTableSkeleton, type DataTableColumn } from "@booking/ui/components/data-table";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { useStaffList } from "../hooks";
import { parseListParams, serializeListParams } from "../list-params";

const MAX_HOTEL_BADGES = 3;

const COLUMNS: DataTableColumn<AdminStaffSummary>[] = [
  {
    id: "name",
    header: "ชื่อ",
    className: "font-medium",
    cell: (s) => (
      <Link href={`/staff/${s.id}`} className="hover:underline">
        {s.name}
      </Link>
    ),
  },
  { id: "email", header: "อีเมล", className: "text-muted-foreground", cell: (s) => s.email },
  {
    id: "hotels",
    header: "โรงแรมที่ดูแล",
    cell: (s) =>
      s.hotels.length === 0 ? (
        <span className="text-sm text-muted-foreground">ยังไม่ได้มอบหมาย</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {s.hotels.slice(0, MAX_HOTEL_BADGES).map((h) => (
            <Badge key={h.id} variant="secondary">
              {h.name}
            </Badge>
          ))}
          {s.hotels.length > MAX_HOTEL_BADGES && (
            <Badge variant="outline">+{s.hotels.length - MAX_HOTEL_BADGES}</Badge>
          )}
        </div>
      ),
  },
];

export function StaffList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = parseListParams(new URLSearchParams(searchParams.toString()));
  const { data, isPending, isError, isPlaceholderData, refetch } = useStaffList(query);

  const navigate = (next: Partial<AdminStaffListQuery>) =>
    router.push(`${pathname}${serializeListParams({ ...query, ...next })}`);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <form
        key={query.q ?? ""}
        role="search"
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("q");
          navigate({ q: typeof value === "string" && value.trim() ? value.trim() : undefined, page: 1 });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="staff-search">ค้นหา</Label>
          <Input id="staff-search" name="q" placeholder="ชื่อหรืออีเมล" defaultValue={query.q ?? ""} />
        </div>
        <Button type="submit" variant="outline">
          ค้นหา
        </Button>
      </form>

      {isPending ? (
        <DataTableSkeleton />
      ) : isError ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm">โหลดรายชื่อพนักงานไม่สำเร็จ</p>
          <Button variant="outline" onClick={() => void refetch()}>
            ลองอีกครั้ง
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <DataTable
            fill
            caption="พนักงาน"
            columns={COLUMNS}
            rows={data.items}
            getRowKey={(s) => s.id}
            busy={isPlaceholderData}
            emptyIcon={query.q !== undefined ? <SearchX className="size-6" /> : undefined}
            empty={
              <EmptyState
                message={query.q !== undefined ? "ไม่พบพนักงานที่ตรงกับคำค้นหา" : "ยังไม่มีพนักงาน"}
                clearHref={query.q !== undefined ? pathname : undefined}
                clearLabel="ล้างการค้นหา"
              />
            }
            pagination={
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                pageSize={data.pageSize}
                onPageSizeChange={(pageSize) => navigate({ pageSize, page: 1 })}
                hrefFor={(page) => `${pathname}${serializeListParams({ ...query, page })}`}
                label="หน้ารายชื่อพนักงาน"
              />
            }
          />
        </div>
      )}
    </div>
  );
}
