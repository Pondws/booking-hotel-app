"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { bookingListQuerySchema } from "@booking/shared";
import { Button, buttonVariants } from "@booking/ui/components/button";
import { cn } from "@booking/ui/lib/utils";
import { Pagination } from "@/components/pagination";
import { useMyBookings } from "../hooks";
import { BookingCard, BookingCardSkeleton } from "./booking-card";

const LIST = "space-y-3";

function pageHref(page: number): string {
  return page > 1 ? `/account/bookings?page=${page}` : "/account/bookings";
}

export function BookingList() {
  const searchParams = useSearchParams();
  const parsed = bookingListQuerySchema.shape.page.safeParse(searchParams.get("page") ?? undefined);
  const page = parsed.success ? parsed.data : 1;
  const { data, isError, refetch, isFetching, isPlaceholderData } = useMyBookings(page);

  // Loaded data stays on screen when a background refetch fails
  if (data === undefined) {
    if (!isError) {
      return (
        <div className={LIST} role="status" aria-busy="true" aria-label="กำลังโหลดการจอง">
          {Array.from({ length: 3 }, (_, i) => (
            <BookingCardSkeleton key={i} />
          ))}
        </div>
      );
    }
    return (
      <div role="alert" className="space-y-3 rounded-lg border p-6 text-center">
        <p className="text-sm">โหลดรายการจองไม่ได้ในขณะนี้</p>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "กำลังลองใหม่…" : "ลองใหม่"}
        </Button>
      </div>
    );
  }

  if (data.items.length === 0) {
    // A page past the end still knows the real total
    if (data.total > 0) {
      return (
        <div className="space-y-2 rounded-lg border p-6 text-center">
          <p className="font-medium">ไม่มีการจองในหน้านี้แล้ว</p>
          <Link href={pageHref(1)} className="inline-flex min-h-6 items-center text-sm underline underline-offset-4">
            กลับไปหน้าแรก
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-3 rounded-lg border p-6 text-center">
        <p className="font-medium">ยังไม่มีการจอง</p>
        <p className="text-sm text-muted-foreground">เริ่มวางแผนทริปถัดไป แล้วการจองจะแสดงที่นี่</p>
        <Link href="/hotels" className={buttonVariants({ variant: "outline" })}>
          ค้นหาที่พัก
        </Link>
      </div>
    );
  }

  const busy = isPlaceholderData && isFetching;
  return (
    <section aria-labelledby="bookings-heading" className="space-y-4">
      <h2 id="bookings-heading" className="sr-only">
        การจองของคุณ
      </h2>
      <div aria-busy={busy} className={cn(LIST, "transition-opacity", busy && "opacity-60")}>
        {data.items.map((booking) => (
          <BookingCard key={booking.code} booking={booking} />
        ))}
      </div>
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        hrefFor={pageHref}
        label="หน้ารายการจอง"
      />
    </section>
  );
}
