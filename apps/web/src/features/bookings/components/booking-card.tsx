import Image from "next/image";
import Link from "next/link";
import type { Booking } from "@booking/shared";
import { Card } from "@booking/ui/components/card";
import { Skeleton } from "@booking/ui/components/skeleton";
import { formatDateRange, formatMoney, nightsLabel } from "@/features/hotels/format";
import { BookingStatusBadge } from "./booking-status-badge";

export function BookingCard({ booking }: { booking: Booking }) {
  const { hotel } = booking;
  return (
    <Link
      href={`/account/bookings/${encodeURIComponent(booking.code)}`}
      className="group block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Card className="flex-row gap-4 rounded-xl p-3 transition-shadow group-hover:shadow-md">
        <div className="relative hidden aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-md bg-muted sm:block">
          {hotel.coverImage && (
            <Image
              src={hotel.coverImage.url}
              alt={hotel.coverImage.alt ?? hotel.name}
              fill
              sizes="112px"
              className="object-cover"
            />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-mono text-sm text-muted-foreground">{booking.code}</p>
            <BookingStatusBadge status={booking.status} />
          </div>
          <p className="truncate font-semibold">{hotel.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatDateRange(booking.checkIn, booking.checkOut)}
            {" · "}
            {nightsLabel(booking.nights)}
          </p>
          <p className="text-sm font-medium tabular-nums">
            {formatMoney(booking.totalAmount, booking.currency)}
          </p>
        </div>
      </Card>
    </Link>
  );
}

export function BookingCardSkeleton() {
  return (
    <Card className="flex-row gap-4 p-3">
      <Skeleton className="hidden aspect-[4/3] w-28 shrink-0 sm:block" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    </Card>
  );
}
