import type { Metadata } from "next";
import { MapPinned } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "จุดหมายปลายทาง · Booking Hotel" };

export default function DestinationsPage() {
  return (
    <ComingSoon
      icon={MapPinned}
      title="จุดหมายปลายทาง"
      description="สำรวจเมืองต่าง ๆ พร้อมไอเดียเที่ยว แล้วดูโรงแรมที่ว่างในแต่ละเมือง"
      planned={[
        "หน้ารวมเมือง พร้อมรูป จำนวนโรงแรม และราคาเริ่มต้น",
        "ค้นหาจากแผนที่ (map view) ในหน้าผลการค้นหา",
        "ไอเดียทริปตามธีม: ทะเล ภูเขา เมืองเก่า",
        "แนะนำเมืองใกล้เคียงเมื่อเมืองที่ค้นหาเต็ม",
      ]}
    />
  );
}
