import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireAuth } from "@/features/auth/components/require-auth";
import { WishlistDetailSkeleton, WishlistDetailView } from "@/features/wishlists/components/wishlist-detail-view";

export const metadata: Metadata = { title: "รายการโปรด · Booking Hotel" };

type Props = { params: Promise<{ wishlistId: string }> };

// `params` is runtime data: read it inside <Suspense> so the shell can still prerender
async function WishlistContent({ params }: Props) {
  const { wishlistId } = await params;
  return (
    <RequireAuth>
      <WishlistDetailView wishlistId={wishlistId} />
    </RequireAuth>
  );
}

export default function WishlistDetailPage({ params }: Props) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <Suspense fallback={<WishlistDetailSkeleton />}>
        <WishlistContent params={params} />
      </Suspense>
    </main>
  );
}
