import type { Metadata } from "next";
import { DealList } from "@/features/deals/components/deal-list";

export const metadata: Metadata = { title: "ดีลพิเศษ · Booking Hotel" };

export default function DealsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">ดีลพิเศษ</h1>
        <p className="text-sm text-muted-foreground">
          ส่วนลดจองล่วงหน้า ดีลนาทีสุดท้าย พักยาว และโค้ดส่วนลด ระบบเลือกดีลที่คุ้มที่สุดให้อัตโนมัติ (ใช้ได้ทีละ 1 ดีล)
          ราคาจริงขึ้นกับวันที่เข้าพัก
        </p>
      </div>
      <DealList />
    </main>
  );
}
