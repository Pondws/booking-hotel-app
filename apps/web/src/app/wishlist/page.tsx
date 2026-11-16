import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "รายการโปรด · Booking Hotel" };

export default function WishlistPage() {
  return (
    <ComingSoon
      icon={Heart}
      title="รายการโปรด"
      description="บันทึกโรงแรมที่ถูกใจไว้เปรียบเทียบทีหลัง แล้วกลับมาจองได้ในคลิกเดียว"
      planned={[
        "กดหัวใจบนการ์ดโรงแรมและหน้ารายละเอียดเพื่อบันทึก",
        "แยกรายการโปรดเป็นหลายลิสต์ เช่น ทริปเชียงใหม่, ทะเลปลายปี",
        "เห็นราคาล่าสุดของวันที่ที่เลือกในทุกโรงแรมของลิสต์",
        "ซิงค์กับบัญชี ใช้ได้ทุกอุปกรณ์",
      ]}
    />
  );
}
