"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@booking/ui/components/button";
import { Skeleton } from "@booking/ui/components/skeleton";
import { AdminOnly } from "@/components/admin-only";
import { DetailTabs, DetailTabsList, DetailsPanel, HistoryPanel } from "@/components/detail-tabs";
import { HistoryCard } from "@/components/history-card";
import { StaffAccessCard, StaffStatusBadge } from "@/features/staff/components/staff-access-card";
import { StaffHotelsCard } from "@/features/staff/components/staff-hotels-card";
import { StaffProfileCard } from "@/features/staff/components/staff-profile-card";
import { useStaff } from "@/features/staff/hooks";
import { ApiError } from "@/lib/api";

export default function StaffMemberPage() {
  return (
    <main className="w-full space-y-6 px-4 py-8">
      <AdminOnly>
        <StaffMember />
      </AdminOnly>
    </main>
  );
}

function StaffMember() {
  const { userId } = useParams<{ userId: string }>();
  const { data: staff, isPending, isError, error, refetch } = useStaff(userId);

  if (isPending) {
    return (
      <div className="space-y-6" aria-busy>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">ไม่พบพนักงาน</h1>
          <p className="text-sm text-muted-foreground">ลิงก์อาจไม่ถูกต้อง หรือบัญชีนี้ไม่ใช่พนักงาน</p>
          <Button asChild variant="link" className="px-0">
            <Link href="/staff">กลับไปที่รายชื่อพนักงาน</Link>
          </Button>
        </div>
      );
    }
    return (
      <div role="alert" className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">โหลดข้อมูลพนักงานไม่สำเร็จ</h1>
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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{staff.name}</h1>
            {!staff.isActive && <StaffStatusBadge isActive={false} />}
          </div>
          <p className="text-sm text-muted-foreground">{staff.email}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/staff">กลับ</Link>
        </Button>
      </header>
      <DetailTabs>
        <DetailTabsList />
        <DetailsPanel>
          {/* Remount when another staff member is opened so the form defaults follow */}
          <StaffProfileCard key={staff.id} staff={staff} />
          <StaffHotelsCard staff={staff} />
          <StaffAccessCard staff={staff} />
        </DetailsPanel>
        <HistoryPanel>
          <HistoryCard filter={{ entityType: "STAFF", entityId: staff.id }} />
        </HistoryPanel>
      </DetailTabs>
    </>
  );
}
