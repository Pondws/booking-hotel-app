"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { AdminRoomTypeSummary } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { DataTable, DataTableSkeleton, type DataTableColumn } from "@booking/ui/components/data-table";
import { Pagination } from "@/components/pagination";
import { HotelStatusBadge } from "@/features/hotels/components/hotel-list";
import { useClientPagination } from "@/lib/use-client-pagination";
import { formatMoney } from "../format";
import { useRoomTypes } from "../hooks";

function columns(hotelId: string, currency: string): DataTableColumn<AdminRoomTypeSummary>[] {
  return [
    {
      id: "name",
      header: "ชื่อ",
      className: "font-medium",
      cell: (rt) => (
        <Link href={`/hotels/${hotelId}/room-types/${rt.id}`} className="hover:underline">
          {rt.name}
        </Link>
      ),
    },
    { id: "capacity", header: "ผู้เข้าพัก", className: "text-right tabular-nums", cell: (rt) => rt.capacity },
    {
      id: "basePrice",
      header: "ราคาพื้นฐาน / คืน",
      className: "text-right tabular-nums",
      cell: (rt) => formatMoney(rt.basePrice, currency),
    },
    {
      id: "rooms",
      header: "ห้องที่เปิดใช้งาน",
      className: "text-right tabular-nums",
      cell: (rt) => `${rt.activeRoomCount} / ${rt.roomCount}`,
    },
    { id: "status", header: "สถานะ", cell: (rt) => <HotelStatusBadge isActive={rt.isActive} /> },
  ];
}

/** Room types of one hotel, shown under the hotel form. */
export function RoomTypeList({ hotelId, currency }: { hotelId: string; currency: string }) {
  const { data, isPending, isError, refetch, isFetching } = useRoomTypes(hotelId);
  const { pageRows, paginationProps } = useClientPagination(data);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>ประเภทห้อง</CardTitle>
        <Button asChild variant="outline">
          <Link href={`/hotels/${hotelId}/room-types/new`}>
            <Plus className="size-4" aria-hidden />
            เพิ่มประเภทห้อง
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <DataTableSkeleton rows={3} />
        ) : isError ? (
          <div role="alert" className="space-y-2">
            <p className="text-sm">โหลดรายการประเภทห้องไม่สำเร็จ</p>
            <Button variant="outline" onClick={() => void refetch()}>
              ลองอีกครั้ง
            </Button>
          </div>
        ) : (
          <DataTable
            caption="ประเภทห้อง"
            columns={columns(hotelId, currency)}
            rows={pageRows}
            getRowKey={(rt) => rt.id}
            busy={isFetching}
            empty="ยังไม่มีประเภทห้อง เพิ่มอย่างน้อย 1 ประเภทเพื่อให้ลูกค้าจองโรงแรมนี้ได้"
            pagination={
              <Pagination
                {...paginationProps}
                label="หน้ารายการประเภทห้อง"
              />
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
