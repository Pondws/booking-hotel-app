"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DASHBOARD_MAX_NIGHTS, adminDashboardQuerySchema, type AdminDashboardQuery } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent } from "@booking/ui/components/card";
import { Label } from "@booking/ui/components/label";
import { Skeleton } from "@booking/ui/components/skeleton";
import { cn } from "@booking/ui/lib/utils";
import { DateFilterField } from "@/features/bookings/components/date-filter-field";
import { HotelFilterSelect } from "@/features/hotels/components/hotel-filter-select";
import { formatMoney } from "@/features/room-types/format";
import { parseDashboardParams, serializeDashboardParams } from "../dashboard-params";
import { formatRate } from "../format";
import { useAdminDashboard } from "../hooks";
import { DailyChart } from "./daily-chart";
import { StatTiles, StatTilesSkeleton } from "./stat-tiles";
import { TodayCard } from "./today-card";

const compact = new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 });

export function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = parseDashboardParams(new URLSearchParams(searchParams.toString()));
  const { data, isPending, isError, isPlaceholderData, refetch } = useAdminDashboard(query);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const navigate = (next: AdminDashboardQuery) => {
    setRangeError(null);
    router.push(`${pathname}${serializeDashboardParams(next)}`);
  };
  const customRange = query.from !== undefined || query.to !== undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="dashboard-hotel">โรงแรม</Label>
          <HotelFilterSelect
            id="dashboard-hotel"
            value={query.hotelId}
            onChange={(hotelId) => navigate({ ...query, hotelId })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dashboard-range">ช่วงวันที่</Label>
          <DateFilterField
            id="dashboard-range"
            value={{ from: data?.from ?? query.from, to: data?.to ?? query.to }}
            onChange={({ from, to }) => {
              const next = { hotelId: query.hotelId, from, to };
              if (!adminDashboardQuerySchema.safeParse(next).success) {
                setRangeError(`เลือกได้ไม่เกิน ${DASHBOARD_MAX_NIGHTS} คืน`);
                return;
              }
              navigate(next);
            }}
          />
        </div>
        {customRange && (
          <Button variant="ghost" onClick={() => navigate({ hotelId: query.hotelId })}>
            30 คืนล่าสุด
          </Button>
        )}
        {rangeError && (
          <p role="alert" className="w-full text-sm text-destructive">
            {rangeError}
          </p>
        )}
      </div>

      {isPending ? (
        <div className="space-y-6">
          <StatTilesSkeleton />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : isError ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm">โหลดภาพรวมไม่สำเร็จ</p>
          <Button variant="outline" onClick={() => void refetch()}>
            ลองอีกครั้ง
          </Button>
        </div>
      ) : data.hotelCount === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">ยังไม่มีโรงแรมที่คุณดูแล จึงยังไม่มีข้อมูลให้แสดง</p>
          </CardContent>
        </Card>
      ) : (
        <div
          aria-busy={isPlaceholderData}
          className={cn("space-y-6 transition-opacity", isPlaceholderData && "opacity-60")}
        >
          <StatTiles data={data} />
          <TodayCard data={data} />
          <DailyChart
            title="อัตราการเข้าพักรายคืน"
            description={`เฉลี่ย ${formatRate(data.occupancy.rate)} จาก ${data.roomCount} ห้องพร้อมขาย`}
            seriesLabel="อัตราการเข้าพัก"
            color="var(--chart-1)"
            data={data.occupancy.daily.map((d) => ({ date: d.date, value: d.rate }))}
            formatValue={(v) => formatRate(v)}
            minMax={1}
          />
          {data.revenue.length === 0 ? (
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground">ไม่มีรายได้ในช่วงวันที่นี้</p>
              </CardContent>
            </Card>
          ) : (
            data.revenue.map((r) => (
              <DailyChart
                key={r.currency}
                title={data.revenue.length > 1 ? `รายได้รายคืน (${r.currency})` : "รายได้รายคืน"}
                description={`รวม ${formatMoney(r.total, r.currency)} · แบ่งยอดการจองตามคืนที่เข้าพัก`}
                seriesLabel="รายได้"
                color="var(--chart-2)"
                data={r.daily.map((d) => ({ date: d.date, value: d.amount }))}
                formatValue={(v) => formatMoney(v, r.currency)}
                formatTick={(v) => compact.format(v)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
