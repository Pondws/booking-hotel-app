import Link from "next/link";
import { Button } from "@booking/ui/components/button";
import { AdminOnly } from "@/components/admin-only";
import { AmenityCatalog } from "@/features/amenities/components/amenity-catalog";

export default function AmenitiesPage() {
  return (
    <main className="flex w-full flex-col gap-6 px-4 py-8 md:h-screen">
      <AdminOnly>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">สิ่งอำนวยความสะดวก</h1>
            <p className="text-sm text-muted-foreground">รายการที่ใช้เลือกในฟอร์มโรงแรมและประเภทห้อง</p>
          </div>
          <Button asChild>
            <Link href="/amenities/new">เพิ่มสิ่งอำนวยความสะดวก</Link>
          </Button>
        </header>
        <AmenityCatalog />
      </AdminOnly>
    </main>
  );
}
