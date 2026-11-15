"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ADMIN_BOOKING_STATUS_FILTERS,
  type AdminBookingListQuery,
  type AdminBookingStatusFilter,
  type AdminBookingSummary,
} from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { DataTable, DataTableSkeleton, type DataTableColumn } from "@booking/ui/components/data-table";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@booking/ui/components/select";
import { Pagination } from "@/components/pagination";
import { useAdminHotels } from "@/features/hotels/hooks";
import { formatDateRange, formatMoney } from "@/features/room-types/format";
import { useAdminBookings } from "../hooks";
import { parseListParams, serializeListParams } from "../list-params";
import { BookingStatusBadge, PaymentStatusBadge, STAGE_LABELS } from "./booking-badges";
import { DateFilterField } from "./date-filter-field";

const ALL_HOTELS = "all";

/** Staff see their own hotels here; 50 covers every real chain we manage. */
const HOTEL_OPTIONS_QUERY = { status: "all", page: 1, pageSize: 50 } as const;

function isStatusFilter(value: string): value is AdminBookingStatusFilter {
  return ADMIN_BOOKING_STATUS_FILTERS.some((s) => s === value);
}

const COLUMNS: DataTableColumn<AdminBookingSummary>[] = [
  {
    id: "code",
    header: "รหัส",
    className: "font-mono font-medium",
    cell: (b) => (
      <Link href={`/bookings/${b.code}`} className="hover:underline">
        {b.code}
      </Link>
    ),
  },
  {
    id: "guest",
    header: "ผู้เข้าพัก",
    cell: (b) => (
      <div className="min-w-0">
        <p className="truncate">{b.guestName}</p>
        <p className="truncate text-xs text-muted-foreground">{b.guestEmail}</p>
      </div>
    ),
  },
  {
    id: "room",
    header: "โรงแรม / ห้อง",
    cell: (b) => (
      <div className="min-w-0">
        <p className="truncate">{b.hotel.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {b.roomType.name} · ห้อง {b.room.number}
        </p>
      </div>
    ),
  },
  {
    id: "stay",
    header: "วันที่เข้าพัก",
    className: "tabular-nums",
    cell: (b) => (
      <div>
        <p className="whitespace-nowrap">{formatDateRange(b.checkIn, b.checkOut)}</p>
        <p className="text-xs text-muted-foreground">{b.nights} คืน</p>
      </div>
    ),
  },
  { id: "status", header: "สถานะ", cell: (b) => <BookingStatusBadge status={b.status} checkedIn={b.checkedIn} /> },
  {
    id: "payment",
    header: "การชำระเงิน",
    cell: (b) => <PaymentStatusBadge status={b.paymentStatus} bookingStatus={b.status} />,
  },
  {
    id: "total",
    header: "ยอดรวม",
    className: "text-right font-semibold tabular-nums",
    cell: (b) => formatMoney(b.totalAmount, b.currency),
  },
];

export function BookingList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = parseListParams(new URLSearchParams(searchParams.toString()));
  const { data, isPending, isError, isPlaceholderData, refetch } = useAdminBookings(query);
  const hotels = useAdminHotels(HOTEL_OPTIONS_QUERY);

  const navigate = (next: Partial<AdminBookingListQuery>) =>
    router.push(`${pathname}${serializeListParams({ ...query, ...next, page: 1 })}`);
  const hasFilters =
    query.hotelId !== undefined ||
    query.status !== "all" ||
    query.from !== undefined ||
    query.to !== undefined ||
    query.q !== undefined;

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
            navigate({ q: typeof value === "string" && value.trim() ? value.trim() : undefined });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="booking-search">ค้นหา</Label>
            <Input
              id="booking-search"
              name="q"
              placeholder="รหัส ชื่อ หรืออีเมล"
              defaultValue={query.q ?? ""}
            />
          </div>
          <Button type="submit" variant="outline">
            ค้นหา
          </Button>
        </form>
        <div className="space-y-2">
          <Label htmlFor="booking-hotel">โรงแรม</Label>
          <Select
            value={query.hotelId ?? ALL_HOTELS}
            onValueChange={(value) => navigate({ hotelId: value === ALL_HOTELS ? undefined : value })}
          >
            <SelectTrigger id="booking-hotel" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_HOTELS}>ทุกโรงแรม</SelectItem>
              {hotels.data?.items.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="booking-status">สถานะ</Label>
          <Select
            value={query.status}
            onValueChange={(value) => {
              if (isStatusFilter(value)) navigate({ status: value });
            }}
          >
            <SelectTrigger id="booking-status" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADMIN_BOOKING_STATUS_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "ทุกสถานะ" : STAGE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="booking-dates">วันที่เข้าพัก</Label>
          <DateFilterField
            id="booking-dates"
            value={{ from: query.from, to: query.to }}
            onChange={({ from, to }) => navigate({ from, to })}
          />
        </div>
      </div>

      {isPending ? (
        <DataTableSkeleton />
      ) : isError ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm">โหลดรายการการจองไม่สำเร็จ</p>
          <Button variant="outline" onClick={() => void refetch()}>
            ลองอีกครั้ง
          </Button>
        </div>
      ) : data.items.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {hasFilters ? "ไม่พบการจองที่ตรงกับตัวกรอง" : "ยังไม่มีการจอง"}
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
            {data.total} การจอง
          </p>
          <DataTable
            caption="การจอง"
            columns={COLUMNS}
            rows={data.items}
            getRowKey={(b) => b.code}
            busy={isPlaceholderData}
          />
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            hrefFor={(page) => `${pathname}${serializeListParams({ ...query, page })}`}
            label="หน้ารายการการจอง"
          />
        </div>
      )}
    </div>
  );
}
