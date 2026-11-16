import type { Metadata } from "next";
import { DestinationGrid } from "@/features/destinations/components/destination-grid";
import { TripIdeas } from "@/features/destinations/components/trip-ideas";

export const metadata: Metadata = { title: "จุดหมายปลายทาง · Booking Hotel" };

export default function DestinationsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-12 px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">จุดหมายปลายทาง</h1>
        <p className="text-sm text-muted-foreground">เลือกเมืองเพื่อดูโรงแรมทั้งหมด หรือเริ่มจากไอเดียทริปด้านล่าง</p>
      </div>
      <section aria-labelledby="cities-heading" className="space-y-4">
        <h2 id="cities-heading" className="text-xl font-semibold">
          เมืองทั้งหมด
        </h2>
        <DestinationGrid />
      </section>
      <section aria-labelledby="ideas-heading" className="space-y-4">
        <div className="space-y-1">
          <h2 id="ideas-heading" className="text-xl font-semibold">
            ไอเดียทริปตามธีม
          </h2>
          <p className="text-sm text-muted-foreground">ค้นหาทุกเมืองตามสไตล์การเที่ยว แล้วปรับตัวกรองต่อได้ในหน้าผลค้นหา</p>
        </div>
        <TripIdeas />
      </section>
    </main>
  );
}
