import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireAuth } from "@/features/auth/components/require-auth";
import { WishlistOverview, WishlistOverviewSkeleton } from "@/features/wishlists/components/wishlist-overview";

export const metadata: Metadata = { title: "รายการโปรด · Booking Hotel" };

export default function WishlistPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">รายการโปรด</h1>
        <p className="text-sm text-muted-foreground">โรงแรมที่คุณบันทึกไว้ แยกเป็นรายการตามทริป</p>
      </div>
      <Suspense fallback={<WishlistOverviewSkeleton />}>
        <RequireAuth>
          <WishlistOverview />
        </RequireAuth>
      </Suspense>
    </main>
  );
}
