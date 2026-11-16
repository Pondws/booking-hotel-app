import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";
import { HOLD_MINUTES } from "@booking/shared";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "ศูนย์ช่วยเหลือ · Booking Hotel" };

export default function HelpPage() {
  return (
    <ComingSoon
      icon={LifeBuoy}
      title="ศูนย์ช่วยเหลือ"
      description="คำถามที่พบบ่อยและช่องทางติดต่อเรื่องการจอง การชำระเงิน และการยกเลิก"
      planned={[
        "คำถามที่พบบ่อย ค้นหาได้",
        "ติดต่อทีมงานจากหน้าการจองโดยตรง",
        "แชทกับโรงแรมก่อนเข้าพัก",
      ]}
      anchors={[
        {
          id: "cancellation",
          title: "นโยบายการยกเลิก",
          body: "ยกเลิกการจองได้จนถึงก่อนวันเช็คอิน ถ้าชำระเงินแล้วจะได้รับเงินคืนเต็มจำนวนเข้าบัตรที่ใช้ชำระ",
        },
        {
          id: "payment",
          title: "การชำระเงิน",
          body: `เมื่อกดจอง ระบบจะกันห้องไว้ให้ ${HOLD_MINUTES} นาทีเพื่อชำระเงินด้วยบัตรเครดิต/เดบิตผ่าน Stripe ถ้าไม่ชำระภายในเวลา ห้องจะถูกปล่อยคืน`,
        },
      ]}
    />
  );
}
