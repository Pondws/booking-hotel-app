import { AdminOnly } from "@/components/admin-only";
import { AmenityCatalog } from "@/features/amenities/components/amenity-catalog";

export default function AmenitiesPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">สิ่งอำนวยความสะดวก</h1>
        <p className="text-sm text-muted-foreground">รายการที่ใช้เลือกในฟอร์มโรงแรมและประเภทห้อง</p>
      </header>
      <AdminOnly>
        <AmenityCatalog />
      </AdminOnly>
    </main>
  );
}
