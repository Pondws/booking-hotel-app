import type { Metadata } from "next";
import { Crown } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "สมาชิกรางวัล · Booking Hotel" };

export default function RewardsPage() {
  return (
    <ComingSoon
      icon={Crown}
      title="สมาชิกรางวัล"
      description="ยิ่งพักมาก ยิ่งได้มาก สะสมแต้มจากทุกการเข้าพักแล้วใช้เป็นส่วนลดครั้งถัดไป"
      planned={[
        "สะสมแต้มจากยอดที่ชำระของการเข้าพักที่เสร็จสิ้นแล้ว",
        "ระดับสมาชิกตามจำนวนการเข้าพัก พร้อมราคาพิเศษสำหรับสมาชิก",
        "ใช้แต้มเป็นส่วนลดตอนชำระเงิน",
        "ประวัติแต้มในหน้าบัญชี",
      ]}
    />
  );
}
