import Image from "next/image";
import { ChevronDown, Users } from "lucide-react";
import type { Availability, RoomType } from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@booking/ui/components/card";
import { Skeleton } from "@booking/ui/components/skeleton";
import { formatDate, formatMoney } from "../format";
import { amenityIcon } from "./amenity-list";

export type RoomAvailability = Availability["roomTypes"][number];

/** `base`: no dates chosen; `loading`: dates chosen, prices on the way; `quote`: live result. */
export type RoomPricing =
  | { kind: "base" }
  | { kind: "loading" }
  | { kind: "quote"; availability: RoomAvailability };

type Props = {
  roomType: RoomType;
  currency: string;
  pricing: RoomPricing;
};

export function RoomTypeCard({ roomType, currency, pricing }: Props) {
  const image = roomType.images[0];
  const soldOut = pricing.kind === "quote" && !pricing.availability.available;
  const hintId = `book-hint-${roomType.id}`;

  return (
    <Card className="gap-0 overflow-hidden py-0 sm:flex-row">
      <div className="relative aspect-[4/3] bg-muted sm:w-56 sm:shrink-0">
        {image && (
          <Image
            src={image.url}
            alt={image.alt ?? roomType.name}
            fill
            sizes="(min-width: 640px) 224px, 100vw"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col">
        <CardHeader className="gap-1 px-4 pt-4">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="leading-snug">{roomType.name}</CardTitle>
            {soldOut && (
              <Badge variant="secondary" className="shrink-0">
                Sold out
              </Badge>
            )}
          </div>
          <CardDescription className="flex items-center gap-1.5">
            <Users aria-hidden className="size-4" />
            Sleeps {roomType.capacity}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pt-3 text-sm">
          {roomType.description && <p className="text-muted-foreground">{roomType.description}</p>}
          {roomType.amenities.length > 0 && (
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {roomType.amenities.map((amenity) => {
                const Icon = amenityIcon(amenity.code);
                return (
                  <li key={amenity.code} className="flex items-center gap-1">
                    <Icon aria-hidden className="size-4 text-muted-foreground" />
                    {amenity.name}
                  </li>
                );
              })}
            </ul>
          )}
          <Price roomType={roomType} currency={currency} pricing={pricing} />
        </CardContent>
        <CardFooter className="mt-auto flex-col items-stretch gap-1 px-4 pt-3 pb-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <p id={hintId} className="text-sm text-muted-foreground sm:order-first">
            Booking opens soon
          </p>
          <Button disabled aria-describedby={hintId}>
            Book
          </Button>
        </CardFooter>
      </div>
    </Card>
  );
}

function Price({ roomType, currency, pricing }: Props) {
  if (pricing.kind === "base") {
    return (
      <p>
        <span className="text-muted-foreground">from </span>
        <span className="text-base font-semibold tabular-nums">
          {formatMoney(roomType.basePrice, currency)}
        </span>
        <span className="text-muted-foreground"> / night</span>
      </p>
    );
  }

  if (pricing.kind === "loading") {
    return (
      <div className="space-y-1.5" role="status" aria-busy="true" aria-label="Loading price">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }

  const { availability } = pricing;
  if (!availability.available) {
    return <p className="text-muted-foreground">No rooms left for these dates.</p>;
  }

  const { quote } = availability;
  return (
    <div className="space-y-1">
      <p>
        <span className="text-base font-semibold tabular-nums">
          {formatMoney(quote.total, quote.currency)}
        </span>
        <span className="text-muted-foreground">
          {" "}
          total · {quote.nights === 1 ? "1 night" : `${quote.nights} nights`}
        </span>
      </p>
      {availability.availableRooms <= 3 && (
        <p className="text-muted-foreground">
          {availability.availableRooms === 1
            ? "Only 1 room left"
            : `Only ${availability.availableRooms} rooms left`}
        </p>
      )}
      <details className="group">
        <summary className="flex min-h-6 w-fit cursor-pointer list-none items-center gap-1 rounded-sm text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          Price per night
          <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <ul className="mt-2 space-y-1">
          {quote.nightly.map((night) => (
            <li key={night.date} className="flex justify-between gap-4 tabular-nums">
              <span className="text-muted-foreground">{formatDate(night.date)}</span>
              <span>{formatMoney(night.price, quote.currency)}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** Same shape as RoomTypeCard: image block + title + two text lines. */
export function RoomTypeCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card sm:flex">
      <Skeleton className="aspect-[4/3] rounded-none sm:w-56 sm:shrink-0" />
      <div className="flex-1 space-y-2 p-4">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}
