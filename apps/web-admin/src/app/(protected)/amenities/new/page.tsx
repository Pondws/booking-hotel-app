import Link from "next/link";
import { AdminOnly } from "@/components/admin-only";
import { AmenityForm } from "@/features/amenities/components/amenity-form";

export default function NewAmenityPage() {
  return (
    <main className="w-full space-y-6 px-4 py-8">
      <AdminOnly>
        <header className="space-y-1">
          <Link href="/amenities" className="text-sm text-muted-foreground hover:underline">
            สิ่งอำนวยความสะดวก
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">เพิ่มสิ่งอำนวยความสะดวก</h1>
        </header>
        <AmenityForm />
      </AdminOnly>
    </main>
  );
}
