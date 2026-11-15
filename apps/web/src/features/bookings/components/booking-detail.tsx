"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { Booking } from "@booking/shared";
import { Button, buttonVariants } from "@booking/ui/components/button";
import { Skeleton } from "@booking/ui/components/skeleton";
import { formatDate, formatMoney } from "@/features/hotels/format";
import { ApiError } from "@/lib/api";
import { useBooking } from "../hooks";
import { useCountdown } from "../use-countdown";
import { BookingStatusBadge } from "./booking-status-badge";
import { CancelBookingDialog } from "./cancel-booking-dialog";
import { HoldCountdown } from "./hold-countdown";

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
  const { data: booking, isPending, isError, error, refetch, isFetching } = useBooking(code);

  if (isPending) {
    return (
      <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading booking">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <div className="space-y-3 rounded-lg border p-6 text-center">
          <p className="font-medium">Booking not found</p>
          <Link href={BACK} className={buttonVariants({ variant: "outline" })}>
            Back to my bookings
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-3 rounded-lg border p-6 text-center">
        <p className="text-sm">We couldn&apos;t load this booking right now.</p>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "Retrying…" : "Try again"}
        </Button>
      </div>
    );
  }

  return <BookingView booking={booking} refetch={() => void refetch()} />;
}

type ViewProps = { booking: Booking; refetch: () => void };

function BookingView({ booking, refetch }: ViewProps) {
  const holding = booking.status === "PENDING" ? booking.expiresAt : null;
  const { remainingMs, done } = useCountdown(holding);

  // Refetch once per hold deadline: a reply that is still PENDING (clock skew) must not loop
  const refetchedFor = useRef<string | null>(null);
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  });
  useEffect(() => {
    if (holding === null || !done || refetchedFor.current === holding) return;
    refetchedFor.current = holding;
    refetchRef.current();
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
          <HoldCountdown expiresAt={holding} remainingMs={remainingMs} done={done} />
          <p className="text-sm text-muted-foreground">Online payment is coming soon</p>
        </>
      )}

      {ended && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm">
            {booking.status === "EXPIRED"
              ? "This hold expired before it was paid, so the room was released."
              : "This booking was cancelled and the room was released."}
          </p>
          <Link href={bookAgainHref(booking)} className={buttonVariants({ variant: "outline" })}>
            Book again
          </Link>
        </div>
      )}

      <section aria-labelledby="stay-heading" className="space-y-3 rounded-lg border p-4">
        <h2 id="stay-heading" className="sr-only">
          Stay summary
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
          <dt className="text-muted-foreground">Check-in</dt>
          <dd>{formatDate(booking.checkIn)}</dd>
          <dt className="text-muted-foreground">Check-out</dt>
          <dd>{formatDate(booking.checkOut)}</dd>
          <dt className="text-muted-foreground">Nights</dt>
          <dd>{booking.nights}</dd>
          <dt className="text-muted-foreground">Guests</dt>
          <dd>{booking.guests === 1 ? "1 guest" : `${booking.guests} guests`}</dd>
          <dt className="text-muted-foreground">Guest</dt>
          <dd>
            {booking.guestName} · {booking.guestEmail}
          </dd>
        </dl>
        <p className="flex justify-between gap-4 border-t pt-3 text-base font-semibold tabular-nums">
          <span>Total</span>
          <span>{formatMoney(booking.totalAmount, booking.currency)}</span>
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={BACK} className="text-sm underline underline-offset-4">
          Back to my bookings
        </Link>
        {booking.cancellable && <CancelBookingDialog booking={booking} />}
      </div>
    </div>
  );
}
