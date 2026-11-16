"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Star } from "lucide-react";
import {
  ADMIN_REVIEW_VISIBILITY_FILTERS,
  type AdminReview,
  type AdminReviewListQuery,
  type AdminReviewVisibilityFilter,
} from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import { DataTable, DataTableSkeleton, type DataTableColumn } from "@booking/ui/components/data-table";
import { Label } from "@booking/ui/components/label";
import { SelectField } from "@booking/ui/components/select-field";
import { Pagination } from "@/components/pagination";
import { formatDateTime } from "@/features/audit-logs/format";
import { HotelFilterSelect } from "@/features/hotels/components/hotel-filter-select";
import { useAdminReviews } from "../hooks";
import { parseListParams, serializeListParams } from "../list-params";
import { ReviewVisibilityDialog } from "./review-visibility-dialog";

const VISIBILITY_LABELS: Record<AdminReviewVisibilityFilter, string> = {
  all: "ทุกสถานะ",
  visible: "แสดงอยู่",
  hidden: "ซ่อนแล้ว",
};

const VISIBILITY_OPTIONS = ADMIN_REVIEW_VISIBILITY_FILTERS.map((v) => ({ value: v, label: VISIBILITY_LABELS[v] }));

const COLUMNS: DataTableColumn<AdminReview>[] = [
  {
    id: "review",
    header: "รีวิว",
    cell: (r) => (
      <div className="min-w-0 max-w-md space-y-1">
        <p className="flex items-center gap-1 font-medium tabular-nums">
          <Star className="size-4 fill-primary text-primary" aria-hidden />
          <span>
            {r.rating}
            <span className="sr-only"> จาก 5 ดาว</span>
          </span>
        </p>
        {r.comment ? (
          <p className="line-clamp-3 whitespace-pre-line text-sm">{r.comment}</p>
        ) : (
          <p className="text-sm text-muted-foreground">ไม่มีความเห็น</p>
        )}
      </div>
    ),
  },
  {
    id: "guest",
    header: "ผู้เข้าพัก",
    cell: (r) => (
      <div className="min-w-0">
        <p className="truncate">{r.guestName}</p>
        <Link href={`/bookings/${r.bookingCode}`} className="font-mono text-xs text-muted-foreground hover:underline">
          {r.bookingCode}
        </Link>
      </div>
    ),
  },
  { id: "hotel", header: "โรงแรม", cell: (r) => <span className="truncate">{r.hotel.name}</span> },
  {
    id: "createdAt",
    header: "วันที่รีวิว",
    className: "whitespace-nowrap tabular-nums",
    cell: (r) => formatDateTime(r.createdAt),
  },
  {
    id: "status",
    header: "สถานะ",
    cell: (r) =>
      r.isHidden ? <Badge variant="outline">ซ่อนแล้ว</Badge> : <Badge variant="secondary">แสดงอยู่</Badge>,
  },
  { id: "actions", header: <span className="sr-only">การทำงาน</span>, cell: (r) => <ReviewVisibilityDialog review={r} /> },
];

export function ReviewList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = parseListParams(new URLSearchParams(searchParams.toString()));
  const { data, isPending, isError, isPlaceholderData, refetch } = useAdminReviews(query);

  const navigate = (next: Partial<AdminReviewListQuery>) =>
    router.push(`${pathname}${serializeListParams({ ...query, ...next, page: 1 })}`);
  const hasFilters = query.hotelId !== undefined || query.visibility !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="review-hotel">โรงแรม</Label>
          <HotelFilterSelect
            id="review-hotel"
            value={query.hotelId}
            onChange={(hotelId) => navigate({ hotelId })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="review-visibility">สถานะ</Label>
          <SelectField
            id="review-visibility"
            className="w-40"
            options={VISIBILITY_OPTIONS}
            value={query.visibility}
            onValueChange={(visibility) => navigate({ visibility })}
          />
        </div>
      </div>

      {isPending ? (
        <DataTableSkeleton />
      ) : isError ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm">โหลดรายการรีวิวไม่สำเร็จ</p>
          <Button variant="outline" onClick={() => void refetch()}>
            ลองอีกครั้ง
          </Button>
        </div>
      ) : data.items.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {hasFilters ? "ไม่พบรีวิวที่ตรงกับตัวกรอง" : "ยังไม่มีรีวิว"}
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
            {data.total} รีวิว
          </p>
          <DataTable
            caption="รีวิว"
            columns={COLUMNS}
            rows={data.items}
            getRowKey={(r) => r.id}
            busy={isPlaceholderData}
          />
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            hrefFor={(page) => `${pathname}${serializeListParams({ ...query, page })}`}
            label="หน้ารายการรีวิว"
          />
        </div>
      )}
    </div>
  );
}
