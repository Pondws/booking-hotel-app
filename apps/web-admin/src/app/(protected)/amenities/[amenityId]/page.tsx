"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import { Skeleton } from "@booking/ui/components/skeleton";
import { AdminOnly } from "@/components/admin-only";
import { DetailTabs, DetailTabsList, DetailsPanel, HistoryPanel } from "@/components/detail-tabs";
import { HistoryCard } from "@/components/history-card";
import { AmenityForm } from "@/features/amenities/components/amenity-form";
import { DeleteAmenityDialog, usageText } from "@/features/amenities/components/delete-amenity-dialog";
import { SCOPE_LABEL } from "@/features/amenities/components/scope-label";
import { useAmenity } from "@/features/amenities/hooks";
import { ApiError } from "@/lib/api";

export default function AmenityPage() {
  return (
    <main className="w-full space-y-6 px-4 py-8">
      <AdminOnly>
        <Amenity />
      </AdminOnly>
    </main>
  );
}

function Amenity() {
  const { amenityId } = useParams<{ amenityId: string }>();
  const { data: amenity, isPending, isError, error, refetch } = useAmenity(amenityId);

  if (isPending) {
    return (
      <div className="space-y-6" aria-busy>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">ไม่พบสิ่งอำนวยความสะดวก</h1>
          <p className="text-sm text-muted-foreground">รายการนี้อาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง</p>
          <Button asChild variant="link" className="px-0">
            <Link href="/amenities">กลับไปที่รายการสิ่งอำนวยความสะดวก</Link>
          </Button>
        </div>
      );
    }
    return (
      <div role="alert" className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">โหลดข้อมูลไม่สำเร็จ</h1>
        <Button variant="outline" onClick={() => void refetch()}>
          ลองอีกครั้ง
        </Button>
      </div>
    );
  }

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Link href="/amenities" className="text-sm text-muted-foreground hover:underline">
            สิ่งอำนวยความสะดวก
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{amenity.name}</h1>
            <Badge variant={amenity.scope === "HOTEL" ? "secondary" : "outline"}>{SCOPE_LABEL[amenity.scope]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <code className="font-mono">{amenity.code}</code> · ใช้งานอยู่: {usageText(amenity)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DeleteAmenityDialog amenity={amenity} />
          <Button asChild variant="outline">
            <Link href="/amenities">กลับ</Link>
          </Button>
        </div>
      </header>
      <DetailTabs>
        <DetailTabsList />
        <DetailsPanel>
          {/* Remount when another amenity is opened so the form defaults follow */}
          <AmenityForm key={amenity.id} amenity={amenity} />
        </DetailsPanel>
        <HistoryPanel>
          <HistoryCard filter={{ entityType: "AMENITY", entityId: amenity.id }} />
        </HistoryPanel>
      </DetailTabs>
    </>
  );
}
