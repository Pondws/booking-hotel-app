"use client";

import Link from "next/link";
import { Button } from "@booking/ui/components/button";
import { Skeleton } from "@booking/ui/components/skeleton";
import { ApiError } from "@/lib/api";

export function RoomTypePageError({
  error,
  hotelId,
  onRetry,
}: {
  error: Error;
  hotelId: string;
  onRetry: () => void;
}) {
  const status = error instanceof ApiError ? error.status : 0;
  if (status === 403 || status === 404) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {status === 403 ? "คุณไม่มีสิทธิ์เข้าถึงโรงแรมนี้" : "ไม่พบประเภทห้อง"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {status === 403 ? "ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าถึง" : "ประเภทห้องอาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง"}
        </p>
        <Button asChild variant="link" className="px-0">
          <Link href={status === 403 ? "/hotels" : `/hotels/${hotelId}`}>
            {status === 403 ? "กลับไปที่รายการโรงแรม" : "กลับไปที่โรงแรม"}
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <div role="alert" className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">โหลดหน้านี้ไม่สำเร็จ</h1>
      <Button variant="outline" onClick={onRetry}>
        ลองอีกครั้ง
      </Button>
    </div>
  );
}

export function RoomTypePageSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-lg" />
      ))}
    </div>
  );
}
