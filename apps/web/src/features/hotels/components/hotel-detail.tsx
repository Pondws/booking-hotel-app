"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarX2, Clock, MapPin, ShieldCheck } from "lucide-react";
import type { HotelDetail as HotelDetailData, StayRange } from "@booking/shared";
import { Button, buttonVariants } from "@booking/ui/components/button";
import { Skeleton } from "@booking/ui/components/skeleton";
import { cn } from "@booking/ui/lib/utils";
import { ApiError } from "@/lib/api";
import { formatDateRange, formatMoney, guestsLabel } from "../format";
import { useAvailability, useHotel } from "../hooks";
import { parseSearchParams, searchHref } from "../search-params";
import { AmenityList } from "./amenity-list";
import { RatingLine } from "./hotel-card";
import { WishlistHeart } from "@/features/wishlists/components/wishlist-heart";
import { HotelGallery } from "./hotel-gallery";
import { ReviewsSection } from "./reviews-section";
import { RoomTypeCard, RoomTypeCardSkeleton, type RoomPricing } from "./room-type-card";
import { StayPicker, type Stay } from "./stay-picker";

/** `/hotels/[slug]`: hotel data from the API, stay (dates + guests) from the URL. */
export function HotelDetail({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const { checkIn, checkOut, guests } = parseSearchParams(new URLSearchParams(searchParams.toString()));
  const stay: Stay = { checkIn, checkOut, guests };
  // parseSearchParams already dropped past/over-long/half ranges, so a pair here is a valid stay
  const range: StayRange | null =
    checkIn && checkOut ? { checkIn, checkOut, guests: guests ?? 1 } : null;

  const { data: hotel, isPending, isError, error, refetch, isFetching } = useHotel(slug);

  if (isPending) return <HotelDetailSkeleton />;

  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <div className="space-y-2 rounded-xl border p-8 text-center">
          <h1 className="text-xl font-semibold">ไม่พบโรงแรม</h1>
          <p className="text-sm text-muted-foreground">โรงแรมนี้ไม่มีอยู่หรือปิดรับจองแล้ว</p>
          <Link href="/hotels" className="inline-flex min-h-6 items-center text-sm underline underline-offset-4">
            ค้นหาโรงแรมอื่น
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-3 rounded-xl border p-6 text-center">
        <p className="text-sm">โหลดข้อมูลโรงแรมไม่ได้ในขณะนี้</p>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "กำลังลองใหม่…" : "ลองใหม่"}
        </Button>
      </div>
    );
  }

  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <Link
          href={searchHref({ city: hotel.city, ...stay })}
          className="inline-flex min-h-6 items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          <ArrowLeft aria-hidden className="size-4" />
          โรงแรมใน {hotel.city}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{hotel.name}</h1>
          <WishlistHeart hotelId={hotel.id} hotelName={hotel.name} variant="inline" className="shrink-0" />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {hotel.reviewCount > 0 ? (
            <a href="#reviews" className="rounded-md underline-offset-4 hover:underline">
              <RatingLine ratingAvg={hotel.ratingAvg} reviewCount={hotel.reviewCount} />
            </a>
          ) : (
            <RatingLine ratingAvg={0} reviewCount={0} />
          )}
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin aria-hidden className="size-4 shrink-0" />
            {hotel.address}
          </p>
          {/* Desktop shows this in the side card */}
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground lg:hidden">
            <Clock aria-hidden className="size-4 shrink-0" />
            <span className="tabular-nums">
              เช็คอินตั้งแต่ {hotel.checkInTime} · เช็คเอาท์ก่อน {hotel.checkOutTime}
            </span>
          </p>
        </div>
      </header>

      <HotelGallery images={hotel.images} name={hotel.name} />

      <div className="grid gap-10 lg:grid-cols-3 lg:items-start">
        <div className="space-y-10 lg:col-span-2">
          {(hotel.description || hotel.amenities.length > 0) && (
            <section aria-labelledby="about-heading" className="space-y-4">
              <h2 id="about-heading" className="text-xl font-semibold">
                เกี่ยวกับที่พักนี้
              </h2>
              {hotel.description && <p className="leading-relaxed text-muted-foreground">{hotel.description}</p>}
              {hotel.amenities.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">สิ่งอำนวยความสะดวกยอดนิยม</h3>
                  <AmenityList amenities={hotel.amenities} />
                </div>
              )}
            </section>
          )}

          <section id="rooms" aria-labelledby="rooms-heading" className="scroll-mt-24 space-y-4">
            <h2 id="rooms-heading" className="text-xl font-semibold">
              ห้องพัก
            </h2>
            <StayPicker value={stay} />
            <RoomList hotel={hotel} slug={slug} range={range} guests={guests} />
          </section>

          <ReviewsSection slug={slug} ratingAvg={hotel.ratingAvg} reviewCount={hotel.reviewCount} />
        </div>

        <StaySummary hotel={hotel} />
      </div>
    </article>
  );
}

/** Sticky side card on desktop (Airbnb's booking box): price from, house rules, jump to rooms. */
function StaySummary({ hotel }: { hotel: HotelDetailData }) {
  const prices = hotel.roomTypes.map((rt) => rt.basePrice);
  const fromPrice = prices.length > 0 ? Math.min(...prices) : null;

  return (
    <aside aria-label="สรุปที่พัก" className="hidden space-y-4 rounded-xl border bg-card p-5 shadow-sm lg:sticky lg:top-24 lg:block">
      {fromPrice !== null && (
        <p>
          <span className="text-sm text-muted-foreground">เริ่มต้น </span>
          <span className="text-2xl font-semibold tabular-nums">{formatMoney(fromPrice, hotel.currency)}</span>
          <span className="text-sm text-muted-foreground"> / คืน</span>
        </p>
      )}
      <ul className="space-y-2 text-sm">
        <li className="flex items-start gap-2">
          <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="tabular-nums">
            เช็คอินตั้งแต่ {hotel.checkInTime} · เช็คเอาท์ก่อน {hotel.checkOutTime}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <CalendarX2 aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ยกเลิกได้ก่อนวันเช็คอิน คืนเงินเต็มจำนวน
        </li>
        <li className="flex items-start gap-2">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ชำระเงินปลอดภัยผ่าน Stripe
        </li>
      </ul>
      <a href="#rooms" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
        เลือกห้องพัก
      </a>
    </aside>
  );
}

type RoomListProps = {
  hotel: HotelDetailData;
  slug: string;
  range: StayRange | null;
  guests: number | undefined;
};

function RoomList({ hotel, slug, range, guests }: RoomListProps) {
  const availability = useAvailability(slug, range);
  // Room types too small for the party are hidden (the availability API leaves them out too)
  const fitting = hotel.roomTypes.filter((rt) => rt.capacity >= (guests ?? 1));

  if (hotel.roomTypes.length === 0) {
    return <p className="text-sm text-muted-foreground">โรงแรมนี้ยังไม่มีห้องพักให้จอง</p>;
  }

  if (fitting.length === 0) {
    return (
      <p className="rounded-xl border p-6 text-center text-sm">
        ไม่มีห้องที่รองรับ {guestsLabel(guests ?? 1)} ลองลดจำนวนผู้เข้าพัก
      </p>
    );
  }

  const pricingFor = (roomTypeId: string): RoomPricing => {
    if (!range || availability.isError) return { kind: "base" };
    if (availability.isPending) return { kind: "loading" };
    const entry = availability.data.roomTypes.find((r) => r.roomTypeId === roomTypeId);
    return entry ? { kind: "quote", availability: entry } : { kind: "base" };
  };

  const quoted = range && availability.isSuccess;
  const allSoldOut = quoted && availability.data.roomTypes.every((r) => !r.available);
  const refreshing = quoted && availability.isFetching;

  return (
    <div className="space-y-3">
      {range && (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {availability.isError
            ? null
            : allSoldOut
              ? `ห้องเต็มทุกประเภทในวันที่ ${formatDateRange(range.checkIn, range.checkOut)} ลองเลือกวันอื่น`
              : `ราคาสำหรับ ${formatDateRange(range.checkIn, range.checkOut)}, ${guestsLabel(range.guests)}`}
        </p>
      )}
      {range && availability.isError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <p className="text-sm">ตรวจสอบราคาของวันที่นี้ไม่ได้ จึงแสดงราคาเริ่มต้นแทน</p>
          <Button
            variant="outline"
            onClick={() => void availability.refetch()}
            disabled={availability.isFetching}
          >
            {availability.isFetching ? "กำลังลองใหม่…" : "ลองใหม่"}
          </Button>
        </div>
      )}
      {!range && (
        <p className="text-sm text-muted-foreground">เลือกวันที่เพื่อดูห้องว่างและราคารวม</p>
      )}
      <ul aria-busy={refreshing || undefined} className={cn("space-y-3 transition-opacity", refreshing && "opacity-60")}>
        {fitting.map((roomType) => (
          <li key={roomType.id}>
            <RoomTypeCard
              roomType={roomType}
              currency={hotel.currency}
              pricing={pricingFor(roomType.id)}
              hotelSlug={slug}
              range={range}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HotelDetailSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-busy="true" aria-label="กำลังโหลดข้อมูลโรงแรม">
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="aspect-video w-full rounded-xl md:aspect-[2/1]" />
      <div className="grid gap-10 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <RoomTypeCardSkeleton />
          <RoomTypeCardSkeleton />
        </div>
        <Skeleton className="hidden h-56 w-full rounded-xl lg:block" />
      </div>
    </div>
  );
}
