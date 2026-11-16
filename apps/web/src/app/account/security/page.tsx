import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "ความปลอดภัยของบัญชี · Booking Hotel" };

export default function AccountSecurityPage() {
  return (
    <ComingSoon
      icon={KeyRound}
      title="ความปลอดภัยของบัญชี"
      description="จัดการรหัสผ่านและอุปกรณ์ที่เข้าสู่ระบบอยู่"
      planned={[
        "แก้ไขชื่อและเบอร์โทรศัพท์",
        "เปลี่ยนรหัสผ่าน (ต้องใส่รหัสเดิม) และออกจากระบบอุปกรณ์อื่นทั้งหมด",
        "ลืมรหัสผ่าน: รับลิงก์ตั้งรหัสใหม่ทางอีเมล",
      ]}
    />
  );
}
