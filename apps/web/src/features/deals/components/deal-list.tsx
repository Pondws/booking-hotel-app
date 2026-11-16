"use client";

import Image from "next/image";
import Link from "next/link";
import { Ticket } from "lucide-react";
import type { Deal, PromotionType } from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import { Skeleton } from "@booking/ui/components/skeleton";
import { RatingLine } from "@/features/hotels/components/hotel-card";
import { formatDate, formatMoney } from "@/features/hotels/format";
import { useDeals } from "../hooks";

export const DEAL_TYPE_LABEL: Record<PromotionType, string> = {
  EARLY_BIRD: "จองล่วงหน้า",
  LAST_MINUTE: "นาทีสุดท้าย",
  LONG_STAY: "พักยาว",
  CODE: "โค้ดส่วนลด",
};

/** The conditions in one line, e.g. "เข้าพักอีก 30 วันขึ้นไป · พัก 4 คืนขึ้นไป". */
export function dealConditions(deal: Pick<Deal, "minNights" | "minDaysAhead" | "maxDaysAhead" | "validUntil">) {
  const parts: string[] = [];
  if (deal.minDaysAhead !== null) parts.push(`จองก่อนเข้าพัก ${deal.minDaysAhead} วันขึ้นไป`);
  if (deal.maxDaysAhead !== null) parts.push(`เข้าพักภายใน ${deal.maxDaysAhead} วัน`);
  if (deal.minNights > 1) parts.push(`พัก ${deal.minNights} คืนขึ้นไป`);
  if (deal.validUntil !== null) parts.push(`จองได้ถึง ${formatDate(deal.validUntil)}`);
  return parts.length > 0 ? parts.join(" · ") : "ใช้ได้กับทุกการเข้าพัก";
}

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

/** `/deals`: every bookable deal, best first, with the before/after "from" price. */
export function DealList() {
  const { data, isPending, isError, refetch, isFetching } = useDeals();

  if (isPending) {
    return (
      <div className={GRID} role="status" aria-busy="true" aria-label="กำลังโหลดดีล">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-80 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <p className="text-sm">โหลดดีลไม่ได้ในขณะนี้</p>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "กำลังลองใหม่…" : "ลองใหม่"}
        </Button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="space-y-3 rounded-xl border p-6 text-center">
        <p className="font-medium">ยังไม่มีดีลในตอนนี้</p>
        <p className="text-sm text-muted-foreground">แวะกลับมาดูใหม่ หรือค้นหาที่พักในราคาปกติไปก่อน</p>
        <Button asChild variant="outline">
          <Link href="/hotels">ค้นหาที่พัก</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className={GRID}>
      {data.map((deal, i) => (
        <li key={deal.id}>
          <DealCard deal={deal} priority={i < 3} />
        </li>
      ))}
    </ul>
  );
}

function DealCard({ deal, priority }: { deal: Deal; priority: boolean }) {
  const { hotel } = deal;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <Link
        href={`/hotels/${encodeURIComponent(hotel.slug)}`}
        className="relative block aspect-video bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {hotel.coverImage && (
          <Image
            src={hotel.coverImage.url}
            alt={hotel.coverImage.alt ?? hotel.name}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        )}
        <Badge className="absolute top-3 left-3 text-sm">ลด {deal.percentOff}%</Badge>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-primary">{DEAL_TYPE_LABEL[deal.type]}</p>
          <h2 className="font-semibold">
            <Link href={`/hotels/${encodeURIComponent(hotel.slug)}`} className="hover:underline">
              {hotel.name}
            </Link>
          </h2>
          <p className="text-sm text-muted-foreground">{hotel.city}</p>
          <RatingLine ratingAvg={hotel.ratingAvg} reviewCount={hotel.reviewCount} />
        </div>
        <div className="space-y-1 text-sm">
          <p className="font-medium">{deal.name}</p>
          <p className="text-muted-foreground">{dealConditions(deal)}</p>
          {deal.code && (
            <p className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1">
              <Ticket aria-hidden className="size-4" />
              ใช้โค้ด <span className="font-semibold tracking-wide">{deal.code}</span> ตอนจอง
            </p>
          )}
        </div>
        <p className="mt-auto text-sm">
          <span className="text-muted-foreground">เริ่มต้น </span>
          <s className="text-muted-foreground tabular-nums">
            <span className="sr-only">ราคาปกติ </span>
            {formatMoney(hotel.fromPrice, hotel.currency)}
          </s>{" "}
          <span className="text-lg font-semibold tabular-nums">
            {formatMoney(hotel.discountedFromPrice, hotel.currency)}
          </span>
          <span className="text-muted-foreground"> / คืน</span>
        </p>
      </div>
    </article>
  );
}
