import type { Metadata } from "next";
import { Suspense } from "react";
import { HotelDetail, HotelDetailSkeleton } from "@/features/hotels/components/hotel-detail";

export const metadata: Metadata = { title: "Hotel · Booking Hotel" };

type Props = { params: Promise<{ slug: string }> };

export default function HotelPage({ params }: Props) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      {/* Params and search params are request data: stream them behind the skeleton */}
      <Suspense fallback={<HotelDetailSkeleton />}>
        <HotelDetailForSlug params={params} />
      </Suspense>
    </main>
  );
}

async function HotelDetailForSlug({ params }: Props) {
  const { slug } = await params;
  return <HotelDetail slug={slug} />;
}
