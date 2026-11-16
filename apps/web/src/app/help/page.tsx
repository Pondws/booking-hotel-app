import type { Metadata } from "next";
import { HelpCenter } from "@/features/help/components/help-center";

export const metadata: Metadata = { title: "ศูนย์ช่วยเหลือ · Booking Hotel" };

export default function HelpPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">ศูนย์ช่วยเหลือ</h1>
        <p className="text-sm text-muted-foreground">คำถามที่พบบ่อยเรื่องการจอง การชำระเงิน การยกเลิก ดีล และแต้มสะสม</p>
      </div>
      <HelpCenter />
    </main>
  );
}
