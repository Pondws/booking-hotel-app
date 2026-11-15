import Link from "next/link";
import type { AdminDashboard, AdminDashboardStay } from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";

type StayList = AdminDashboard["arrivals"];

function Stays({
  title,
  list,
  empty,
  labels,
}: {
  title: string;
  list: StayList;
  empty: string;
  labels: { done: string; pending: string };
}) {
  const more = list.total - list.items.length;
  return (
    <div className="min-w-0 space-y-2">
      <h3 className="text-sm font-medium">
        {title} <span className="text-muted-foreground tabular-nums">({list.total})</span>
      </h3>
      {list.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y">
          {list.items.map((s: AdminDashboardStay) => (
            <li key={s.code} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <Link href={`/bookings/${s.code}`} className="block truncate text-sm hover:underline">
                  {s.guestName}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  ห้อง {s.room.number} · {s.roomType.name} · {s.hotel.name}
                </p>
              </div>
              <Badge variant={s.done ? "outline" : "secondary"}>{s.done ? labels.done : labels.pending}</Badge>
            </li>
          ))}
        </ul>
      )}
      {more > 0 && <p className="text-xs text-muted-foreground">และอีก {more} รายการ</p>}
    </div>
  );
}

export function TodayCard({ data }: { data: AdminDashboard }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>วันนี้</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <Stays
          title="เข้าพัก"
          list={data.arrivals}
          empty="ไม่มีแขกเข้าพักวันนี้"
          labels={{ done: "เช็คอินแล้ว", pending: "รอเข้าพัก" }}
        />
        <Stays
          title="ออก"
          list={data.departures}
          empty="ไม่มีแขกออกวันนี้"
          labels={{ done: "เช็คเอาท์แล้ว", pending: "ยังไม่เช็คเอาท์" }}
        />
      </CardContent>
    </Card>
  );
}
