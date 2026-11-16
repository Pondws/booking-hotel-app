"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchX } from "lucide-react";
import {
  ADMIN_SUPPORT_STATUS_FILTERS,
  type AdminSupportListQuery,
  type AdminSupportRequest,
  type AdminSupportStatusFilter,
} from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import { DataTable, DataTableSkeleton, type DataTableColumn } from "@booking/ui/components/data-table";
import { Label } from "@booking/ui/components/label";
import { SelectField } from "@booking/ui/components/select-field";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { formatDateTime } from "@/features/audit-logs/format";
import { HotelFilterSelect } from "@/features/hotels/components/hotel-filter-select";
import { formatDateRange } from "@/features/room-types/format";
import { useSupportRequests } from "../hooks";
import { parseListParams, serializeListParams } from "../list-params";
import { ReplyDialog } from "./reply-dialog";
import { SUPPORT_TOPIC_LABEL } from "./topic-label";

const STATUS_LABELS: Record<AdminSupportStatusFilter, string> = {
  OPEN: "รอตอบกลับ",
  RESOLVED: "ตอบแล้ว",
  all: "ทั้งหมด",
};
const STATUS_OPTIONS = ADMIN_SUPPORT_STATUS_FILTERS.map((v) => ({ value: v, label: STATUS_LABELS[v] }));

const COLUMNS: DataTableColumn<AdminSupportRequest>[] = [
  {
    id: "message",
    header: "ข้อความ",
    cell: (r) => (
      <div className="min-w-0 max-w-md space-y-1">
        <p className="font-medium">{SUPPORT_TOPIC_LABEL[r.topic]}</p>
        <p className="line-clamp-3 whitespace-pre-line text-sm">{r.message}</p>
        {r.reply && (
          <p className="line-clamp-2 border-l-2 border-primary pl-2 text-sm text-muted-foreground">
            {r.resolvedBy ? `${r.resolvedBy.name}: ` : ""}
            {r.reply}
          </p>
        )}
      </div>
    ),
  },
  {
    id: "guest",
    header: "ลูกค้า / การจอง",
    cell: (r) => (
      <div className="min-w-0 space-y-0.5">
        <p className="truncate">{r.booking.guestName}</p>
        <p className="truncate text-xs text-muted-foreground">{r.booking.guestEmail}</p>
        <Link href={`/bookings/${r.booking.code}`} className="font-mono text-xs text-muted-foreground hover:underline">
          {r.booking.code}
        </Link>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatDateRange(r.booking.checkIn, r.booking.checkOut)}
        </p>
      </div>
    ),
  },
  { id: "hotel", header: "โรงแรม", cell: (r) => <span className="truncate">{r.hotel.name}</span> },
  {
    id: "createdAt",
    header: "ส่งเมื่อ",
    className: "whitespace-nowrap tabular-nums",
    cell: (r) => formatDateTime(r.createdAt),
  },
  {
    id: "status",
    header: "สถานะ",
    cell: (r) =>
      r.status === "OPEN" ? <Badge variant="secondary">รอตอบกลับ</Badge> : <Badge variant="outline">ตอบแล้ว</Badge>,
  },
  {
    id: "actions",
    header: <span className="sr-only">การทำงาน</span>,
    cell: (r) => (r.status === "OPEN" ? <ReplyDialog request={r} /> : null),
  },
];

/** Customer messages from booking pages; STAFF see only their hotels' (the API scopes it). Oldest open first. */
export function SupportList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = parseListParams(new URLSearchParams(searchParams.toString()));
  const { data, isPending, isError, isPlaceholderData, refetch } = useSupportRequests(query);

  const navigate = (next: Partial<AdminSupportListQuery>) =>
    router.push(`${pathname}${serializeListParams({ ...query, ...next, page: 1 })}`);
  const hasFilters = query.hotelId !== undefined || query.status !== "OPEN";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="support-hotel">โรงแรม</Label>
          <HotelFilterSelect id="support-hotel" value={query.hotelId} onChange={(hotelId) => navigate({ hotelId })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="support-status">สถานะ</Label>
          <SelectField
            id="support-status"
            className="w-40"
            options={STATUS_OPTIONS}
            value={query.status}
            onValueChange={(status) => navigate({ status })}
          />
        </div>
      </div>

      {isPending ? (
        <DataTableSkeleton />
      ) : isError ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm">โหลดข้อความไม่สำเร็จ</p>
          <Button variant="outline" onClick={() => void refetch()}>
            ลองอีกครั้ง
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <DataTable
            fill
            caption="ข้อความจากลูกค้า"
            columns={COLUMNS}
            rows={data.items}
            getRowKey={(r) => r.id}
            busy={isPlaceholderData}
            emptyIcon={hasFilters ? <SearchX className="size-6" /> : undefined}
            empty={
              <EmptyState
                message={
                  hasFilters ? "ไม่พบข้อความที่ตรงกับตัวกรอง" : "ไม่มีข้อความที่รอตอบกลับ"
                }
                clearHref={hasFilters ? pathname : undefined}
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
                label="หน้ารายการข้อความ"
              />
            }
          />
        </div>
      )}
    </div>
  );
}
