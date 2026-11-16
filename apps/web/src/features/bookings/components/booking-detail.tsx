"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BOOKING_TZ, todayIn, type Booking } from "@booking/shared";
import { Button, buttonVariants } from "@booking/ui/components/button";
import { Skeleton } from "@booking/ui/components/skeleton";
import { formatDate, formatMoney, guestsLabel } from "@/features/hotels/format";
import { PayCard } from "@/features/payments/components/pay-card";
import { ApiError } from "@/lib/api";
import { useBooking } from "../hooks";
import { useCountdown } from "../use-countdown";
import { BookingStatusBadge } from "./booking-status-badge";
import { CancelBookingDialog } from "./cancel-booking-dialog";
import { HoldCountdown } from "./hold-countdown";
import { SupportCard } from "@/features/support/components/support-card";
import { ReviewCard } from "./review-card";

const BACK = "/account/bookings";

function bookAgainHref(booking: Booking): string {
  const sp = new URLSearchParams({
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    guests: String(booking.guests),
  });
  return `/hotels/${encodeURIComponent(booking.hotel.slug)}?${sp.toString()}`;
}

export function BookingDetail({ code }: { code: string }) {
  // Set by the pay card after a successful confirm, until the webhook/sync confirms (or 30 s pass)
  const [polling, setPolling] = useState(false);
  const { data: booking, isError, error, refetch, isFetching } = useBooking(code, { poll: polling });

  // Loaded data stays on screen when a background refetch fails
  if (booking === undefined) {
    if (!isError) {
      return (
        <div className="space-y-4" role="status" aria-busy="true" aria-label="กำลังโหลดการจอง">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      );
    }
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return (
        <div role="alert" className="space-y-3 rounded-xl border p-6 text-center">
          <p className="font-medium">ไม่พบการจอง</p>
          <Link href={BACK} className={buttonVariants({ variant: "outline" })}>
            กลับไปการจองของฉัน
          </Link>
        </div>
      );
    }
    return (
      <div role="alert" className="space-y-3 rounded-xl border p-6 text-center">
        <p className="text-sm">โหลดข้อมูลการจองไม่ได้ในขณะนี้</p>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "กำลังลองใหม่…" : "ลองใหม่"}
        </Button>
      </div>
    );
  }

  return <BookingView booking={booking} refetch={() => refetch()} onStillPending={setPolling} />;
}

type ViewProps = {
  booking: Booking;
  refetch: () => Promise<unknown>;
  onStillPending: (polling: boolean) => void;
};

/** A payment timestamp as a calendar date in the hotel's timezone, e.g. `12 เม.ย. 2570`. */
const formatInstant = (iso: string) => formatDate(todayIn(BOOKING_TZ, new Date(iso)));

function BookingView({ booking, refetch, onStillPending }: ViewProps) {
  const holding = booking.status === "PENDING" ? booking.expiresAt : null;
  const { remainingMs, done } = useCountdown(holding);

  // Refetch once per hold deadline: a reply that is still PENDING (clock skew) must not loop
  const refetchedFor = useRef<string | null>(null);
  // Deadline whose one refetch has settled: a still-PENDING reply then reads "Expiring shortly…"
  const [settledFor, setSettledFor] = useState<string | null>(null);
  // Keeps the cancel dialog mounted while open, even if the hold expires underneath it
  const [cancelActive, setCancelActive] = useState(false);
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  });
  useEffect(() => {
    if (holding === null || !done || refetchedFor.current === holding) return;
    refetchedFor.current = holding;
    void refetchRef.current().finally(() => setSettledFor(holding));
  }, [holding, done]);

  const { hotel } = booking;
  const ended = booking.status === "EXPIRED" || booking.status === "CANCELLED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-sm text-muted-foreground">{booking.code}</p>
        <BookingStatusBadge status={booking.status} />
      </div>

      {holding !== null && (
        <>
          <HoldCountdown expiresAt={holding} remainingMs={remainingMs} done={done} settled={settledFor === holding} />
          {booking.payable && !done && <PayCard booking={booking} onStillPending={onStillPending} />}
        </>
      )}

      {booking.status === "CONFIRMED" && booking.payment?.paidAt && (
        <p className="rounded-xl border p-4 text-sm">ชำระเงินแล้วเมื่อ {formatInstant(booking.payment.paidAt)}</p>
      )}
      {booking.payment?.status === "REFUNDED" && booking.payment.refundedAt && (
        <p className="rounded-xl border p-4 text-sm">
          คืนเงินแล้วเมื่อ {formatInstant(booking.payment.refundedAt)} —{" "}
          {formatMoney(booking.totalAmount, booking.currency)} เข้าบัตรที่ใช้ชำระ
        </p>
      )}

      {ended && (
        <div className="space-y-3 rounded-xl border p-4">
          <p className="text-sm">
            {booking.status === "EXPIRED"
              ? "หมดเวลาชำระเงินก่อนชำระ ห้องจึงถูกปล่อยคืนแล้ว"
              : "การจองนี้ถูกยกเลิกและปล่อยห้องคืนแล้ว"}
          </p>
          <Link href={bookAgainHref(booking)} className={buttonVariants({ variant: "outline" })}>
            จองอีกครั้ง
          </Link>
        </div>
      )}

      <section aria-labelledby="stay-heading" className="space-y-3 rounded-xl border p-4">
        <h2 id="stay-heading" className="sr-only">
          สรุปการเข้าพัก
        </h2>
        <div>
          <Link
            href={`/hotels/${encodeURIComponent(hotel.slug)}`}
            className="text-lg font-semibold underline-offset-4 hover:underline"
          >
            {hotel.name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {booking.roomType.name} · {hotel.city}
          </p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">เช็คอิน</dt>
          <dd className="tabular-nums">
            {formatDate(booking.checkIn)} ตั้งแต่ {hotel.checkInTime}
          </dd>
          <dt className="text-muted-foreground">เช็คเอาท์</dt>
          <dd className="tabular-nums">
            {formatDate(booking.checkOut)} ก่อน {hotel.checkOutTime}
          </dd>
          <dt className="text-muted-foreground">จำนวนคืน</dt>
          <dd>{booking.nights}</dd>
          <dt className="text-muted-foreground">ผู้เข้าพัก</dt>
          <dd>{guestsLabel(booking.guests)}</dd>
          <dt className="text-muted-foreground">ผู้จอง</dt>
          <dd>
            {booking.guestName} · {booking.guestEmail}
          </dd>
        </dl>
        {(booking.discountAmount > 0 || booking.pointsRedeemed > 0) && (
          <dl className="space-y-1 border-t pt-3 text-sm tabular-nums">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">ราคาห้องพัก</dt>
              <dd>{formatMoney(booking.subtotalAmount, booking.currency)}</dd>
            </div>
            {booking.discountAmount > 0 && (
              <div className="flex justify-between gap-4 text-primary">
                <dt>ส่วนลด{booking.discountLabel ? ` · ${booking.discountLabel}` : ""}</dt>
                <dd>−{formatMoney(booking.discountAmount, booking.currency)}</dd>
              </div>
            )}
            {booking.pointsRedeemed > 0 && (
              <div className="flex justify-between gap-4 text-primary">
                <dt>ใช้แต้ม {booking.pointsRedeemed.toLocaleString("th-TH")} แต้ม</dt>
                <dd>−{formatMoney(booking.pointsRedeemed, booking.currency)}</dd>
              </div>
            )}
          </dl>
        )}
        {booking.pointsEarned > 0 && (
          <p className="text-sm text-primary">ได้รับ {booking.pointsEarned.toLocaleString("th-TH")} แต้มจากการเข้าพักนี้</p>
        )}
        <p className="flex justify-between gap-4 border-t pt-3 text-base font-semibold tabular-nums">
          <span>ราคารวม</span>
          <span>{formatMoney(booking.totalAmount, booking.currency)}</span>
        </p>
      </section>

      <ReviewCard booking={booking} />

      <SupportCard code={booking.code} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={BACK} className="text-sm underline underline-offset-4">
          กลับไปการจองของฉัน
        </Link>
        {(booking.cancellable || cancelActive) && (
          <CancelBookingDialog booking={booking} onActiveChange={setCancelActive} />
        )}
      </div>
    </div>
  );
}
