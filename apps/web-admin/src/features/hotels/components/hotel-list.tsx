"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AdminHotelListQuery, AdminHotelSummary } from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import {
  DataTable,
  DataTableSkeleton,
  type DataTableColumn,
} from "@booking/ui/components/data-table";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@booking/ui/components/select";
import { Pagination } from "@/components/pagination";
import { useMe } from "@/features/auth/hooks";
import { useAdminHotels } from "../hooks";
import { parseListParams, serializeListParams } from "../list-params";

const STATUS_OPTIONS = [
  { value: "all", label: "ทุกสถานะ" },
  { value: "active", label: "เปิดใช้งาน" },
  { value: "inactive", label: "ปิดใช้งาน" },
] as const;

const dateFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

function isStatus(value: string): value is AdminHotelListQuery["status"] {
  return STATUS_OPTIONS.some((o) => o.value === value);
}

export function HotelStatusBadge({ isActive }: { isActive: boolean }) {
  return <Badge variant={isActive ? "secondary" : "outline"}>{isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}</Badge>;
}

const COLUMNS: DataTableColumn<AdminHotelSummary>[] = [
  {
    id: "name",
    header: "ชื่อ",
    className: "font-medium",
    cell: (hotel) => (
      <Link href={`/hotels/${hotel.id}`} className="hover:underline">
        {hotel.name}
      </Link>
    ),
  },
  { id: "city", header: "เมือง", cell: (hotel) => hotel.city },
  { id: "status", header: "สถานะ", cell: (hotel) => <HotelStatusBadge isActive={hotel.isActive} /> },
  {
    id: "updated",
    header: "อัปเดตล่าสุด",
    className: "text-muted-foreground tabular-nums",
    cell: (hotel) => dateFormat.format(new Date(hotel.updatedAt)),
  },
];

export function HotelList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = parseListParams(new URLSearchParams(searchParams.toString()));
  const { data: me } = useMe();
  const { data, isPending, isError, isPlaceholderData, refetch } = useAdminHotels(query);

  const navigate = (next: Partial<AdminHotelListQuery>) =>
    router.push(`${pathname}${serializeListParams({ ...query, ...next })}`);
  const hasFilters = query.q !== undefined || query.status !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
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
            <Label htmlFor="hotel-search">ค้นหา</Label>
            <Input id="hotel-search" name="q" placeholder="ชื่อหรือเมือง" defaultValue={query.q ?? ""} />
          </div>
          <Button type="submit" variant="outline">
            ค้นหา
          </Button>
        </form>
        <div className="space-y-2">
          <Label htmlFor="hotel-status">สถานะ</Label>
          <Select
            value={query.status}
            onValueChange={(value) => {
              if (isStatus(value)) navigate({ status: value, page: 1 });
            }}
          >
            <SelectTrigger id="hotel-status" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isPending ? (
        <DataTableSkeleton />
      ) : isError ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm">โหลดรายการโรงแรมไม่สำเร็จ</p>
          <Button variant="outline" onClick={() => void refetch()}>
            ลองอีกครั้ง
          </Button>
        </div>
      ) : data.items.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {hasFilters
              ? "ไม่พบโรงแรมที่ตรงกับตัวกรอง"
              : me?.role === "ADMIN"
                ? "ยังไม่มีโรงแรม"
                : "ยังไม่มีโรงแรมที่มอบหมายให้คุณ"}
          </p>
          {hasFilters && (
            <Button asChild variant="link" className="px-0">
              <Link href={pathname}>ล้างตัวกรอง</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {data.total} โรงแรม
          </p>
          <DataTable
            caption="โรงแรม"
            columns={COLUMNS}
            rows={data.items}
            getRowKey={(hotel) => hotel.id}
            busy={isPlaceholderData}
          />
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            hrefFor={(page) => `${pathname}${serializeListParams({ ...query, page })}`}
            label="หน้ารายการโรงแรม"
          />
        </div>
      )}
    </div>
  );
}
