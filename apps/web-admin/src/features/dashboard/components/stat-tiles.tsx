import type { AdminDashboard } from "@booking/shared";
import { Card, CardContent } from "@booking/ui/components/card";
import { Skeleton } from "@booking/ui/components/skeleton";
import { formatMoney } from "@/features/room-types/format";
import { formatRate } from "../format";

function StatTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="space-y-1 px-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5";

export function StatTiles({ data }: { data: AdminDashboard }) {
  const [main, ...others] = data.revenue;
  const revenueHint = [`${data.nights} คืน · ตามคืนที่เข้าพัก`, ...others.map((r) => formatMoney(r.total, r.currency))];
  return (
    <section aria-label="สรุป" className={GRID}>
      <StatTile label="เข้าพักวันนี้" value={String(data.arrivals.total)} hint={`เช็คอินแล้ว ${data.arrivals.done}`} />
      <StatTile
        label="ออกวันนี้"
        value={String(data.departures.total)}
        hint={`เช็คเอาท์แล้ว ${data.departures.done}`}
      />
      <StatTile label="กำลังเข้าพัก" value={String(data.inHouse)} hint={`ห้องพร้อมขาย ${data.roomCount} ห้อง`} />
      <StatTile
        label="อัตราการเข้าพัก"
        value={formatRate(data.occupancy.rate)}
        hint={`${data.occupancy.roomNightsSold} จาก ${data.occupancy.roomNightsAvailable} ห้อง-คืน`}
      />
      <StatTile
        label="รายได้"
        value={main ? formatMoney(main.total, main.currency) : formatMoney(0, "THB")}
        hint={revenueHint.join(" · ")}
      />
    </section>
  );
}

export function StatTilesSkeleton() {
  return (
    <div className={GRID}>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-26 rounded-xl" />
      ))}
    </div>
  );
}
