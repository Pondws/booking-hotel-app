import type { Metadata } from "next";
import { BadgePercent } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "ดีลพิเศษ · Booking Hotel" };

export default function DealsPage() {
  return (
    <ComingSoon
      icon={BadgePercent}
      title="ดีลพิเศษ"
      description="รวมโปรโมชันจากโรงแรม ส่วนลดจองล่วงหน้า และดีลนาทีสุดท้าย ในราคาที่ระบบคำนวณจริง"
      planned={[
        "ดีลจองล่วงหน้า (early bird) และดีลนาทีสุดท้าย",
        "ส่วนลดเมื่อพักหลายคืน",
        "โค้ดส่วนลดตอนชำระเงิน",
        "ราคาก่อน/หลังส่วนลดแสดงคู่กันทุกครั้ง",
      ]}
    />
  );
}
