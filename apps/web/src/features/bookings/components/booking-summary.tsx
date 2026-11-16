"use client";

import Image from "next/image";
import type { AvailabilityQuery, HotelDetail, RoomType } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Skeleton } from "@booking/ui/components/skeleton";
import { formatDate, formatDateRange, formatMoney, guestsLabel } from "@/features/hotels/format";
import { useAvailability } from "@/features/hotels/hooks";
import type { RoomAvailability } from "@/features/hotels/components/room-type-card";
import { PointsForm } from "./points-form";
import { PromoCodeForm } from "./promo-code-form";

type Props = { hotel: HotelDetail; roomType: RoomType; range: AvailabilityQuery; points: number };

/** Live quote for the chosen room type; re-fetched when a hold fails. */
export function BookingSummary({ hotel, roomType, range, points }: Props) {
  const availability = useAvailability(hotel.slug, range);
  const cover = hotel.images[0] ?? roomType.images[0];
  const entry = availability.data?.roomTypes.find((r) => r.roomTypeId === roomType.id);

  return (
    <section aria-labelledby="summary-heading" className="space-y-4 rounded-xl border bg-card p-4 shadow-sm md:sticky md:top-24">
      <h2 id="summary-heading" className="sr-only">
        สรุปการจอง
      </h2>
      <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
        {cover && (
          <Image
            src={cover.url}
            alt={cover.alt ?? hotel.name}
            fill
            sizes="(min-width: 768px) 400px, 100vw"
            className="object-cover"
          />
        )}
      </div>
      <div>
        <p className="text-lg font-semibold">{hotel.name}</p>
        <p className="text-sm text-muted-foreground">{roomType.name}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">วันที่</dt>
        <dd>{formatDateRange(range.checkIn, range.checkOut)}</dd>
        <dt className="text-muted-foreground">ผู้เข้าพัก</dt>
        <dd>{guestsLabel(range.guests)}</dd>
        {entry?.available && (
          <>
            <dt className="text-muted-foreground">จำนวนคืน</dt>
            <dd>{entry.quote.nights}</dd>
          </>
        )}
      </dl>
      <Quote
        isPending={availability.isPending}
        isError={availability.isError}
        isFetching={availability.isFetching}
        retry={() => void availability.refetch()}
        entry={entry}
        points={points}
      />
      <PromoCodeForm
        current={range.promoCode}
        status={availability.data?.promoCode}
        appliedCode={availability.data ? (entry?.quote.discount?.code ?? null) : undefined}
      />
      <PointsForm current={points} total={entry?.available ? entry.quote.total : undefined} />
    </section>
  );
}

type QuoteProps = {
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  retry: () => void;
  entry: RoomAvailability | undefined;
  /** Reward points to take off the quote (the API re-checks the amount when holding). */
  points: number;
};

function Quote({ isPending, isError, isFetching, retry, entry, points }: QuoteProps) {
  if (isPending) {
    return (
      <div className="space-y-2" role="status" aria-busy="true" aria-label="กำลังโหลดราคา">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-6 w-1/3" />
      </div>
    );
  }
  if (isError) {
    return (
      <div role="alert" className="space-y-3">
        <p className="text-sm">ตรวจสอบราคาของวันที่นี้ไม่ได้</p>
        <Button variant="outline" onClick={retry} disabled={isFetching}>
          {isFetching ? "กำลังลองใหม่…" : "ลองใหม่"}
        </Button>
      </div>
    );
  }
  if (!entry || !entry.available) {
    return (
      <p role="status" className="text-sm font-medium text-destructive">
        ห้องประเภทนี้เต็มในวันที่เลือกแล้ว
      </p>
    );
  }

  const { quote } = entry;
  return (
    <div className="space-y-3">
      <ul className="space-y-1 text-sm tabular-nums">
        {quote.nightly.map((night) => (
          <li key={night.date} className="flex justify-between gap-4">
            <span className="text-muted-foreground">{formatDate(night.date)}</span>
            <span>{formatMoney(night.price, quote.currency)}</span>
          </li>
        ))}
      </ul>
      {(quote.discount || points > 0) && (
        <dl className="space-y-1 border-t pt-3 text-sm tabular-nums">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">ราคาห้องพัก</dt>
            <dd>{formatMoney(quote.subtotal, quote.currency)}</dd>
          </div>
          {quote.discount && (
          <div className="flex justify-between gap-4 text-primary">
            <dt>
              ส่วนลด {quote.discount.percentOff}% · {quote.discount.name}
            </dt>
            <dd>−{formatMoney(quote.discount.amount, quote.currency)}</dd>
          </div>
          )}
          {points > 0 && (
            <div className="flex justify-between gap-4 text-primary">
              <dt>ใช้แต้ม {points.toLocaleString("th-TH")} แต้ม</dt>
              <dd>−{formatMoney(points, quote.currency)}</dd>
            </div>
          )}
        </dl>
      )}
      <p className="flex justify-between gap-4 border-t pt-3 text-base font-semibold tabular-nums">
        <span>ราคารวม</span>
        <span>{formatMoney(Math.max(0, quote.total - points), quote.currency)}</span>
      </p>
    </div>
  );
}
