"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";
import type { HotelSearchQuery } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { cn } from "@booking/ui/lib/utils";
import { useHotelSearch } from "../hooks";
import { searchHref } from "../search-params";
import { HotelCard, HotelCardSkeleton } from "./hotel-card";
import { Pagination } from "@/components/pagination";

const GRID = "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";

export function HotelResultsSkeleton() {
  return (
    <div className={GRID} role="status" aria-busy="true" aria-label="กำลังโหลดโรงแรม">
      {Array.from({ length: 6 }, (_, i) => (
        <HotelCardSkeleton key={i} />
      ))}
    </div>
  );
}

function hasFilters(q: HotelSearchQuery): boolean {
  return q.city !== undefined || q.checkIn !== undefined || q.guests !== undefined;
}

type Props = {
  query: HotelSearchQuery;
  /** `/hotels` shows the count line; the home page doesn't. */
  showCount?: boolean;
};

export function HotelResults({ query, showCount = false }: Props) {
  const { data, isPending, isError, refetch, isFetching, isPlaceholderData } = useHotelSearch(query);

  if (isPending) return <HotelResultsSkeleton />;

  if (isError) {
    return (
      <div className="space-y-3 rounded-xl border p-6 text-center">
        <p className="text-sm">โหลดรายการโรงแรมไม่ได้ในขณะนี้</p>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "กำลังลองใหม่…" : "ลองใหม่"}
        </Button>
      </div>
    );
  }

  const stay = { checkIn: query.checkIn, checkOut: query.checkOut, guests: query.guests };
  const hrefFor = (page: number) => searchHref({ ...query, page });

  if (data.items.length === 0) {
    // A page past the end still knows the real total
    if (data.total > 0) {
      return (
        <div className="space-y-2 rounded-xl border p-6 text-center">
          <p className="font-medium">ไม่มีผลลัพธ์ในหน้านี้แล้ว</p>
          <Link href={hrefFor(1)} className="inline-flex min-h-6 items-center text-sm underline underline-offset-4">
            กลับไปหน้าแรก
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-2 rounded-xl border p-8 text-center">
        <SearchX aria-hidden className="mx-auto size-8 text-muted-foreground" />
        {hasFilters(query) ? (
          <>
            <p className="font-medium">ไม่พบโรงแรมที่ตรงกับการค้นหา</p>
            <p className="text-sm text-muted-foreground">ลองเปลี่ยนเมือง ลดจำนวนผู้เข้าพัก หรือเลือกวันอื่น</p>
            <Link href="/hotels" className="inline-flex min-h-6 items-center text-sm underline underline-offset-4">
              ล้างตัวกรอง
            </Link>
          </>
        ) : (
          <p className="font-medium">ยังไม่มีโรงแรมในระบบ แวะกลับมาดูอีกครั้งเร็ว ๆ นี้</p>
        )}
      </div>
    );
  }

  const busy = isPlaceholderData && isFetching;

  return (
    <section aria-labelledby="results-heading" className="space-y-4">
      <h2 id="results-heading" className="sr-only">
        ผลการค้นหา
      </h2>
      <p aria-live="polite" className={cn("text-sm text-muted-foreground", !showCount && "sr-only")}>
        {query.city ? `${query.city}: ` : ""}พบ {data.total.toLocaleString("th-TH")} โรงแรม
        {query.checkIn ? " ที่มีห้องว่างในวันที่คุณเลือก" : ""}
      </p>
      <div aria-busy={busy} className={cn(GRID, "transition-opacity", busy && "opacity-60")}>
        {data.items.map((hotel, i) => (
          <HotelCard key={hotel.id} hotel={hotel} stay={stay} priority={i < 3} />
        ))}
      </div>
      <Pagination page={data.page} totalPages={data.totalPages} hrefFor={hrefFor} />
    </section>
  );
}
